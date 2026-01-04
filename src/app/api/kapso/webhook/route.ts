import { openai } from "@ai-sdk/openai";
import { WhatsAppClient } from "@kapso/whatsapp-cloud-api";
import { put } from "@vercel/blob";
import {
	experimental_transcribe as transcribe,
	generateText,
	stepCountIs,
} from "ai";
import { and, eq, gte, lt } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { ExpenseCategory } from "@/db/schema";
import type {
	GetExpensesByCategoryParams,
	GetExpensesSummaryParams,
	LogExpenseParams,
} from "@/lib/ai/tools";
import { tools } from "@/lib/ai/tools";
import {
	type CategoryBreakdown,
	type ExpenseAddedData,
	type ExpensesSummaryData,
	renderExpenseAdded,
	renderExpensesSummary,
} from "@/lib/images";
import { logger } from "@/lib/logger";

// Initialize WhatsApp client lazily
function getWhatsAppClient() {
	const apiKey = process.env.KAPSO_API_KEY;
	if (!apiKey) {
		throw new Error("KAPSO_API_KEY environment variable is required");
	}
	return new WhatsAppClient({
		baseUrl: "https://api.kapso.ai/meta/whatsapp",
		kapsoApiKey: apiKey,
	});
}

// Kapso structured webhook payload types
interface KapsoWebhookMessage {
	id: string;
	timestamp: string;
	type: string;
	text?: { body: string };
	image?: { id: string; mime_type?: string; sha256?: string; caption?: string };
	audio?: { id: string; mime_type?: string; sha256?: string };
	voice?: { id: string; mime_type?: string; sha256?: string };
	from: string;
	kapso?: {
		direction: "inbound" | "outbound";
		status: string;
		content?: string;
		media_url?: string;
		media_data?: {
			url: string;
			filename?: string;
			content_type?: string;
			byte_size?: number;
		};
	};
}

interface KapsoWebhookConversation {
	id: string;
	phone_number: string;
	phone_number_id: string;
}

interface KapsoWebhookDataItem {
	message: KapsoWebhookMessage;
	conversation: KapsoWebhookConversation;
	phone_number_id: string;
	is_new_conversation: boolean;
}

interface KapsoWebhookPayload {
	type: string;
	batch: boolean;
	data: KapsoWebhookDataItem[];
	batch_info?: {
		size: number;
		window_ms: number;
		first_sequence: number;
		last_sequence: number;
		conversation_id: string;
	};
	// Legacy non-batch format (kept for backward compatibility)
	message?: KapsoWebhookMessage;
	conversation?: KapsoWebhookConversation;
	phone_number_id?: string;
	is_new_conversation?: boolean;
	test?: boolean;
}

// Kapso API message response types
interface KapsoMessage {
	id: string;
	timestamp: string;
	type: string;
	from?: string;
	to?: string;
	text?: { body: string };
	image?: { id: string; caption?: string };
	kapso?: {
		direction: "inbound" | "outbound";
		status: string;
		content?: string;
	};
}

interface KapsoMessagesResponse {
	data: KapsoMessage[];
	paging?: {
		cursors?: {
			before?: string;
			after?: string;
		};
	};
}

/**
 * Download media from a URL (Kapso-mirrored or direct)
 */
async function downloadMediaFromUrl(
	url: string,
	contentType?: string,
): Promise<{ data: Buffer; mimeType: string } | null> {
	try {
		console.log(
			"[downloadMediaFromUrl] Downloading from:",
			url.substring(0, 80) + "...",
		);

		const response = await fetch(url);

		if (!response.ok) {
			console.error("[downloadMediaFromUrl] Failed:", response.status);
			return null;
		}

		const arrayBuffer = await response.arrayBuffer();
		const buffer = Buffer.from(arrayBuffer);

		console.log("[downloadMediaFromUrl] Downloaded bytes:", buffer.length);

		// Validate we got actual image data
		if (buffer.length < 100) {
			console.error(
				"[downloadMediaFromUrl] Data too small, likely not an image",
			);
			return null;
		}

		// Use provided content type, response header, or detect from magic bytes
		let mimeType = contentType || response.headers.get("content-type") || "";
		if (
			!mimeType ||
			mimeType === "application/octet-stream" ||
			mimeType === "image/*"
		) {
			mimeType = detectImageMimeType(buffer);
		}

		console.log("[downloadMediaFromUrl] Mime type:", mimeType);

		return {
			data: buffer,
			mimeType,
		};
	} catch (error) {
		console.error("[downloadMediaFromUrl] Error:", error);
		return null;
	}
}

/**
 * Download audio from a URL (Kapso-mirrored or direct)
 */
async function downloadAudioFromUrl(
	url: string,
	contentType?: string,
): Promise<{ data: Buffer; mimeType: string } | null> {
	try {
		console.log(
			"[downloadAudioFromUrl] Downloading from:",
			url.substring(0, 80) + "...",
		);

		const response = await fetch(url);

		if (!response.ok) {
			console.error("[downloadAudioFromUrl] Failed:", response.status);
			return null;
		}

		const arrayBuffer = await response.arrayBuffer();
		const buffer = Buffer.from(arrayBuffer);

		console.log("[downloadAudioFromUrl] Downloaded bytes:", buffer.length);

		// Validate we got actual audio data
		if (buffer.length < 100) {
			console.error(
				"[downloadAudioFromUrl] Data too small, likely not audio",
			);
			return null;
		}

		// Use provided content type or response header
		const mimeType =
			contentType || response.headers.get("content-type") || "audio/ogg";

		console.log("[downloadAudioFromUrl] Mime type:", mimeType);

		return {
			data: buffer,
			mimeType,
		};
	} catch (error) {
		console.error("[downloadAudioFromUrl] Error:", error);
		return null;
	}
}

/**
 * Transcribe audio using OpenAI Whisper
 */
async function transcribeAudio(audioBuffer: Buffer): Promise<string | null> {
	try {
		console.log("[transcribeAudio] Starting transcription...");

		const result = await transcribe({
			model: openai.transcription("whisper-1"),
			audio: audioBuffer,
		});

		console.log("[transcribeAudio] Transcription result:", result.text);

		return result.text;
	} catch (error) {
		console.error("[transcribeAudio] Error:", error);
		return null;
	}
}

/**
 * Fetch recent conversation messages from Kapso API
 */
async function getConversationMessages(
	phoneNumberId: string,
	conversationId: string,
	limit = 20,
): Promise<Array<{ role: "user" | "assistant"; content: string }>> {
	const apiKey = process.env.KAPSO_API_KEY;
	if (!apiKey) {
		throw new Error("KAPSO_API_KEY environment variable is required");
	}

	const url = new URL(
		`https://api.kapso.ai/meta/whatsapp/v24.0/${phoneNumberId}/messages`,
	);
	url.searchParams.set("conversation_id", conversationId);
	url.searchParams.set("limit", limit.toString());

	let data: KapsoMessagesResponse;
	try {
		const response = await fetch(url.toString(), {
			headers: {
				"X-API-Key": apiKey,
			},
		});

		if (!response.ok) {
			console.error("Failed to fetch conversation messages:", response.status);
			return [];
		}

		data = await response.json();
	} catch (fetchError) {
		console.error("Error fetching messages:", fetchError);
		return [];
	}

	if (!data.data || data.data.length === 0) {
		return [];
	}

	// Convert to AI SDK message format, filtering for text messages only
	// Messages come newest-first, we need to reverse for chronological order
	// Note: Inbound messages have "from" field, outbound messages have "to" field
	const messages = data.data
		.filter((msg) => {
			const hasContent =
				msg.type === "text" && (msg.kapso?.content || msg.text?.body);
			return hasContent;
		})
		.map((msg) => {
			// Determine role: if "from" exists, it's an inbound (user) message
			// if "to" exists (and no "from"), it's an outbound (assistant) message
			const isInbound = !!msg.from;
			return {
				role: (isInbound ? "user" : "assistant") as "user" | "assistant",
				content: msg.kapso?.content || msg.text?.body || "",
			};
		})
		.reverse();

	// Remove the last message (current one) as it will be added separately
	if (messages.length > 0) {
		messages.pop();
	}

	return messages;
}

/**
 * Get or create user by phone number
 */
async function getOrCreateUser(phoneNumber: string) {
	const db = getDb();

	// Try to find existing user
	const existingUser = await db.query.users.findFirst({
		where: eq(schema.users.phoneNumber, phoneNumber),
	});

	if (existingUser) {
		return existingUser;
	}

	// Create new user
	const [newUser] = await db
		.insert(schema.users)
		.values({
			phoneNumber,
			timezone: "America/Bogota", // Default for Colombian/Peruvian users
		})
		.returning();

	return newUser;
}

/**
 * Save expense to database
 */
async function saveExpense(
	userId: string,
	params: LogExpenseParams,
	rawMessage: string,
) {
	const db = getDb();

	const [entry] = await db
		.insert(schema.expenses)
		.values({
			userId,
			description: params.description,
			amount: params.amount.toString(),
			currency: "USD",
			category: params.category,
			vendor: params.vendor,
			spentAt: new Date(params.spentAt),
			rawMessage,
		})
		.returning();

	return entry;
}

/**
 * Get date range boundaries for a period
 */
function getDateRangeForPeriod(
	period: "day" | "week" | "month" | "year",
	referenceDate: Date,
): { start: Date; end: Date; label: string } {
	const year = referenceDate.getFullYear();
	const month = referenceDate.getMonth();
	const date = referenceDate.getDate();
	const day = referenceDate.getDay();

	switch (period) {
		case "day": {
			// Colombia is UTC-5
			const startOfDayUTC = new Date(Date.UTC(year, month, date, 5, 0, 0, 0));
			const endOfDayUTC = new Date(Date.UTC(year, month, date + 1, 5, 0, 0, 0));
			return { start: startOfDayUTC, end: endOfDayUTC, label: "Today" };
		}
		case "week": {
			// Start of week (Sunday)
			const startOfWeek = new Date(year, month, date - day);
			const startOfWeekUTC = new Date(
				Date.UTC(
					startOfWeek.getFullYear(),
					startOfWeek.getMonth(),
					startOfWeek.getDate(),
					5,
					0,
					0,
					0,
				),
			);
			const endOfWeekUTC = new Date(
				Date.UTC(
					startOfWeek.getFullYear(),
					startOfWeek.getMonth(),
					startOfWeek.getDate() + 7,
					5,
					0,
					0,
					0,
				),
			);
			return { start: startOfWeekUTC, end: endOfWeekUTC, label: "This Week" };
		}
		case "month": {
			const startOfMonthUTC = new Date(Date.UTC(year, month, 1, 5, 0, 0, 0));
			const endOfMonthUTC = new Date(Date.UTC(year, month + 1, 1, 5, 0, 0, 0));
			return {
				start: startOfMonthUTC,
				end: endOfMonthUTC,
				label: "This Month",
			};
		}
		case "year": {
			const startOfYearUTC = new Date(Date.UTC(year, 0, 1, 5, 0, 0, 0));
			const endOfYearUTC = new Date(Date.UTC(year + 1, 0, 1, 5, 0, 0, 0));
			return { start: startOfYearUTC, end: endOfYearUTC, label: "This Year" };
		}
	}
}

/**
 * Get expenses summary for a user
 */
async function getExpensesSummary(
	userId: string,
	params: GetExpensesSummaryParams,
) {
	const db = getDb();

	// Parse reference date or use today
	const referenceDate = params.date
		? new Date(params.date + "T12:00:00")
		: getColombiaTime();

	const { start, end, label } = getDateRangeForPeriod(
		params.period,
		referenceDate,
	);

	// Build where conditions
	const whereConditions = [
		eq(schema.expenses.userId, userId),
		gte(schema.expenses.spentAt, start),
		lt(schema.expenses.spentAt, end),
	];

	if (params.category) {
		whereConditions.push(eq(schema.expenses.category, params.category));
	}

	const entries = await db.query.expenses.findMany({
		where: and(...whereConditions),
	});

	// Calculate totals and group by category
	const byCategory = new Map<
		ExpenseCategory,
		{ total: number; count: number }
	>();

	let totalAmount = 0;

	for (const entry of entries) {
		const amount = Number(entry.amount);
		totalAmount += amount;

		const existing = byCategory.get(entry.category) || { total: 0, count: 0 };
		byCategory.set(entry.category, {
			total: existing.total + amount,
			count: existing.count + 1,
		});
	}

	const categoryBreakdown: CategoryBreakdown[] = Array.from(
		byCategory.entries(),
	).map(([category, data]) => ({
		category,
		total: data.total,
		count: data.count,
	}));

	return {
		periodLabel: label,
		startDate: start,
		endDate: end,
		totalAmount,
		entryCount: entries.length,
		byCategory: categoryBreakdown,
	};
}

/**
 * Get expenses breakdown by category for a date range
 */
async function getExpensesByCategory(
	userId: string,
	params: GetExpensesByCategoryParams,
) {
	const db = getDb();

	// Parse dates and create timezone-aware boundaries
	const [startYear, startMonth, startDay] = params.startDate
		.split("-")
		.map(Number);
	const [endYear, endMonth, endDay] = params.endDate.split("-").map(Number);

	const startUTC = new Date(
		Date.UTC(startYear, startMonth - 1, startDay, 5, 0, 0, 0),
	);
	const endUTC = new Date(
		Date.UTC(endYear, endMonth - 1, endDay + 1, 5, 0, 0, 0),
	);

	const entries = await db.query.expenses.findMany({
		where: and(
			eq(schema.expenses.userId, userId),
			gte(schema.expenses.spentAt, startUTC),
			lt(schema.expenses.spentAt, endUTC),
		),
	});

	// Group by category
	const byCategory = new Map<
		ExpenseCategory,
		{ total: number; count: number }
	>();

	let totalAmount = 0;

	for (const entry of entries) {
		const amount = Number(entry.amount);
		totalAmount += amount;

		const existing = byCategory.get(entry.category) || { total: 0, count: 0 };
		byCategory.set(entry.category, {
			total: existing.total + amount,
			count: existing.count + 1,
		});
	}

	const categoryBreakdown: CategoryBreakdown[] = Array.from(
		byCategory.entries(),
	).map(([category, data]) => ({
		category,
		total: data.total,
		count: data.count,
	}));

	return {
		periodLabel: "Custom Range",
		startDate: new Date(params.startDate),
		endDate: new Date(params.endDate),
		totalAmount,
		entryCount: entries.length,
		byCategory: categoryBreakdown,
	};
}

/**
 * Upload image to Vercel Blob and return public URL
 */
async function uploadImage(buffer: Buffer, filename: string): Promise<string> {
	const blob = await put(filename, buffer, {
		access: "public",
		contentType: "image/png",
		addRandomSuffix: true,
	});
	return blob.url;
}

/**
 * Get current time in Colombia timezone
 */
function getColombiaTime(): Date {
	return new Date(
		new Date().toLocaleString("en-US", { timeZone: "America/Bogota" }),
	);
}

/**
 * Detect image mime type from buffer magic bytes
 */
function detectImageMimeType(buffer: Buffer): string {
	// Check magic bytes
	if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
		return "image/jpeg";
	}
	if (
		buffer[0] === 0x89 &&
		buffer[1] === 0x50 &&
		buffer[2] === 0x4e &&
		buffer[3] === 0x47
	) {
		return "image/png";
	}
	if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
		return "image/gif";
	}
	if (
		buffer[0] === 0x52 &&
		buffer[1] === 0x49 &&
		buffer[2] === 0x46 &&
		buffer[3] === 0x46
	) {
		// RIFF header - could be WebP
		if (
			buffer[8] === 0x57 &&
			buffer[9] === 0x45 &&
			buffer[10] === 0x42 &&
			buffer[11] === 0x50
		) {
			return "image/webp";
		}
	}
	// Default to jpeg for WhatsApp images
	return "image/jpeg";
}

export async function POST(request: Request) {
	const payload: KapsoWebhookPayload = await request.json();

	// Handle batch format - extract first item from data array
	let message: KapsoWebhookMessage | undefined;
	let conversation: KapsoWebhookConversation | undefined;
	let phoneNumberId: string | undefined;

	if (payload.batch && payload.data?.length > 0) {
		// New batch format
		const firstItem = payload.data[0];
		message = firstItem.message;
		conversation = firstItem.conversation;
		phoneNumberId = firstItem.phone_number_id;
	} else {
		// Legacy non-batch format
		message = payload.message;
		conversation = payload.conversation;
		phoneNumberId = payload.phone_number_id;
	}

	// Only respond to inbound text, image, or audio messages
	if (message?.kapso?.direction !== "inbound") {
		return new Response("OK", { status: 200 });
	}

	const isTextMessage = message?.type === "text";
	const isImageMessage = message?.type === "image";
	const isAudioMessage = message?.type === "audio";

	if (!isTextMessage && !isImageMessage && !isAudioMessage) {
		return new Response("OK", { status: 200 });
	}

	const senderNumber = message.from.replace(/\D/g, ""); // Remove non-digits

	if (!phoneNumberId) {
		return new Response("OK", { status: 200 });
	}

	// Get text content from message
	let userTextMessage = isTextMessage
		? message.text?.body
		: message.image?.caption;

	// Log incoming message details
	logger.logIncomingMessage({
		messageId: message.id,
		from: senderNumber,
		type: message.type,
		hasText: !!userTextMessage,
		hasImage: isImageMessage,
		hasAudio: isAudioMessage,
		textContent: userTextMessage,
		conversationId: conversation?.id,
	});

	// Get image data if present - use Kapso-mirrored URL from webhook payload
	let imageData: { data: Buffer; mimeType: string } | null = null;
	if (isImageMessage) {
		// Try Kapso-mirrored URLs first (these don't require auth)
		const mediaUrl = message.kapso?.media_url || message.kapso?.media_data?.url;

		if (mediaUrl) {
			imageData = await downloadMediaFromUrl(
				mediaUrl,
				message.kapso?.media_data?.content_type || message.image?.mime_type,
			);
		} else {
			console.error("[POST] No media URL in webhook payload for image message");
		}
	}

	// Get audio data and transcribe if present
	let transcribedText: string | null = null;
	if (isAudioMessage) {
		const mediaUrl = message.kapso?.media_url || message.kapso?.media_data?.url;

		if (mediaUrl) {
			const audioData = await downloadAudioFromUrl(
				mediaUrl,
				message.kapso?.media_data?.content_type || message.audio?.mime_type,
			);

			if (audioData) {
				transcribedText = await transcribeAudio(audioData.data);
				if (transcribedText) {
					// Use transcribed text as the user message
					userTextMessage = transcribedText;
					console.log("[POST] Transcribed audio:", transcribedText);
				}
			}
		} else {
			console.error("[POST] No media URL in webhook payload for audio message");
		}
	}

	// Need either text, image, or transcribed audio to proceed
	if (!userTextMessage && !imageData) {
		return new Response("OK", { status: 200 });
	}

	try {
		// Get or create user
		const user = await getOrCreateUser(senderNumber);

		// Fetch conversation history from Kapso API
		const conversationId = conversation?.id;
		let conversationHistory: Array<{
			role: "user" | "assistant";
			content: string;
		}> = [];

		if (conversationId) {
			conversationHistory = await getConversationMessages(
				phoneNumberId,
				conversationId,
			);
		}

		const currentTime = getColombiaTime();
		const currentDateStr = currentTime.toISOString().split("T")[0];

		// System prompt for the expense tracking agent
		const systemPrompt = `You are a friendly expense tracking assistant on WhatsApp for users in Colombia and Peru. Your job is to help users log their expenses and track their spending.

Current date/time in Colombia: ${currentTime.toISOString()}
Current date: ${currentDateStr}

WHEN A USER SENDS AN IMAGE OF A RECEIPT:
1. Analyze the image to extract expense information
2. Identify: the total amount, what was purchased, and the store/vendor name if visible
3. Log the expense using the logExpense tool
4. If you can't read the receipt clearly, ask the user for clarification

WHEN A USER SENDS A VOICE MESSAGE:
- Voice messages are automatically transcribed before reaching you
- Treat the transcribed text as if the user typed it directly
- Process it normally to log expenses or answer questions

WHEN A USER TELLS YOU THEY BOUGHT OR SPENT MONEY:
1. Parse the message to extract:
   - Amount (look for numbers with $, USD, dollars, bucks, etc.)
   - What they bought (description)
   - Where they bought it (vendor, if mentioned)
   - When (default to now, but look for "yesterday", "last week", etc.)

2. Use the logExpense tool to record it:
   - description: Brief description of what was purchased
   - amount: The amount in USD
   - category: Infer from context:
     * food_dining: restaurants, groceries, coffee, food delivery, meals
     * transportation: gas, uber, taxi, bus, car maintenance, parking
     * shopping: electronics, clothes, furniture, online shopping, Amazon
     * entertainment: movies, games, streaming (Netflix, Spotify), concerts, hobbies
     * bills_utilities: electricity, water, internet, phone bill, rent, insurance
     * health: medicine, doctor, pharmacy, gym membership, medical
     * education: books, courses, tuition, school supplies, training
     * travel: hotels, flights, vacation expenses, Airbnb
     * other: anything that doesn't fit above
   - vendor: Store or vendor name if mentioned
   - spentAt: ISO timestamp, infer from context ("yesterday" = yesterday's date, "just now" = current time)

3. AFTER LOGGING AN EXPENSE:
   - Keep your response short: just acknowledge or ask a follow-up
   - Examples: "Got it!", "Logged!", "Anything else?", "That's a big purchase!"
   - The image already shows all the details, don't repeat them

WHEN USER ASKS ABOUT THEIR SPENDING:
1. For period summaries ("how much this week?", "spending this month?"):
   - Use getExpensesSummary with appropriate period (day, week, month, year)
   
2. For category breakdowns ("where is my money going?", "spending by category"):
   - Use getExpensesByCategory with the date range

EXAMPLE MESSAGES AND RESPONSES:
- "I just bought a new laptop for 1200 dollars at Best Buy" -> Log as shopping, $1200, vendor: Best Buy
- "Spent 25 on lunch" -> Log as food_dining, $25
- "Paid my electricity bill 150 bucks" -> Log as bills_utilities, $150
- "How much did I spend this week?" -> Use getExpensesSummary with period: "week"
- "Show me my spending by category this month" -> Use getExpensesByCategory

Be concise and friendly. All amounts are in USD.`;

		// Build the user message content (text and/or image)
		type MessageContent =
			| string
			| Array<
					{ type: "text"; text: string } | { type: "image"; image: string }
			  >;

		let userContent: MessageContent;

		if (imageData) {
			// Message with image - pass Buffer directly, SDK handles it
			// Use data URL format to ensure mime type is preserved
			const dataUrl = `data:${imageData.mimeType};base64,${imageData.data.toString("base64")}`;
			const parts: Array<
				{ type: "text"; text: string } | { type: "image"; image: string }
			> = [
				{
					type: "image",
					image: dataUrl,
				},
			];

			if (userTextMessage) {
				parts.push({ type: "text", text: userTextMessage });
			} else {
				// If no caption, ask the model to identify and log the expense
				parts.push({
					type: "text",
					text: "This is a receipt. Please extract the expense information and log it for me.",
				});
			}

			userContent = parts;
		} else {
			// Text-only message
			userContent = userTextMessage || "";
		}

		// Build messages array with conversation history
		const messages = [
			...conversationHistory,
			{ role: "user" as const, content: userContent },
		];

		const result = await generateText({
			model: "anthropic/claude-haiku-4.5",
			system: systemPrompt,
			messages,
			tools,
			stopWhen: stepCountIs(5),
		});

		// Log AI processing and category decision
		const toolCalls = result.steps.flatMap((step) =>
			step.toolResults.map((toolResult) => ({
				toolName: toolResult.toolName,
				category:
					toolResult.toolName === "logExpense"
						? (toolResult.output as LogExpenseParams).category
						: undefined,
				description:
					toolResult.toolName === "logExpense"
						? (toolResult.output as LogExpenseParams).description
						: undefined,
				amount:
					toolResult.toolName === "logExpense"
						? (toolResult.output as LogExpenseParams).amount
						: undefined,
				vendor:
					toolResult.toolName === "logExpense"
						? (toolResult.output as LogExpenseParams).vendor
						: undefined,
			})),
		);

		logger.logCategoryDecision({
			messageId: message.id,
			userMessage:
				typeof userContent === "string"
					? userContent
					: userContent
							.filter((part) => part.type === "text")
							.map((part) => (part.type === "text" ? part.text : ""))
							.join(" "),
			aiResponse: result.text || "(No text response)",
			toolCalls,
			stepCount: result.steps.length,
			modelUsed: "claude-haiku-4.5",
		});

		const whatsappClient = getWhatsAppClient();

		// Process tool calls
		for (const step of result.steps) {
			for (const toolResult of step.toolResults) {
				if (toolResult.toolName === "logExpense") {
					const logParams = toolResult.output as LogExpenseParams;

					// Save to database
					const rawMessage = transcribedText
						? `[Voice message] ${transcribedText}`
						: userTextMessage || "Receipt image";
					const entry = await saveExpense(user.id, logParams, rawMessage);

					logger.logExpenseSaved(
						entry.id,
						logParams.category,
						logParams.amount,
						logParams.description,
					);

					// Generate image
					const expenseAddedData: ExpenseAddedData = {
						description: logParams.description,
						amount: logParams.amount,
						currency: "USD",
						category: logParams.category,
						vendor: logParams.vendor,
						spentAt: new Date(logParams.spentAt),
					};

					const imageBuffer = await renderExpenseAdded(expenseAddedData);
					logger.logImageGenerated("expense-added");

					const imageUrl = await uploadImage(
						imageBuffer,
						`expense-added-${entry.id}.png`,
					);

					// Send image via WhatsApp
					await whatsappClient.messages.sendImage({
						phoneNumberId,
						to: senderNumber,
						image: {
							link: imageUrl,
						},
					});

					logger.logMessageSent(senderNumber, "image");
				} else if (toolResult.toolName === "getExpensesSummary") {
					const summaryParams = toolResult.output as GetExpensesSummaryParams & {
						action: string;
					};

					// Get summary from database
					const summary = await getExpensesSummary(user.id, summaryParams);

					// Generate image
					const summaryData: ExpensesSummaryData = {
						periodLabel: summary.periodLabel,
						startDate: summary.startDate,
						endDate: summary.endDate,
						totalAmount: summary.totalAmount,
						currency: "USD",
						entryCount: summary.entryCount,
						byCategory: summary.byCategory,
					};

					const imageBuffer = await renderExpensesSummary(summaryData);
					logger.logImageGenerated("summary");

					const imageUrl = await uploadImage(
						imageBuffer,
						`expenses-summary-${user.id}-${Date.now()}.png`,
					);

					// Send image via WhatsApp
					await whatsappClient.messages.sendImage({
						phoneNumberId,
						to: senderNumber,
						image: {
							link: imageUrl,
						},
					});

					logger.logMessageSent(senderNumber, "image");
				} else if (toolResult.toolName === "getExpensesByCategory") {
					const categoryParams =
						toolResult.output as GetExpensesByCategoryParams & {
							action: string;
						};

					// Get breakdown from database
					const breakdown = await getExpensesByCategory(user.id, categoryParams);

					// Generate image
					const summaryData: ExpensesSummaryData = {
						periodLabel: breakdown.periodLabel,
						startDate: breakdown.startDate,
						endDate: breakdown.endDate,
						totalAmount: breakdown.totalAmount,
						currency: "USD",
						entryCount: breakdown.entryCount,
						byCategory: breakdown.byCategory,
					};

					const imageBuffer = await renderExpensesSummary(summaryData);
					logger.logImageGenerated("category-breakdown");

					const imageUrl = await uploadImage(
						imageBuffer,
						`expenses-by-category-${user.id}-${Date.now()}.png`,
					);

					// Send image via WhatsApp
					await whatsappClient.messages.sendImage({
						phoneNumberId,
						to: senderNumber,
						image: {
							link: imageUrl,
						},
					});

					logger.logMessageSent(senderNumber, "image");
				}
			}
		}

		// If there's also text to send (for clarifications, etc.)
		if (result.text?.trim()) {
			await whatsappClient.messages.sendText({
				phoneNumberId,
				to: senderNumber,
				body: result.text,
			});

			logger.logMessageSent(senderNumber, "text", result.text);
		}

		logger.logSeparator();
	} catch (error) {
		logger.logError("POST /webhook", error);

		// Send error message to user
		try {
			const whatsappClient = getWhatsAppClient();
			await whatsappClient.messages.sendText({
				phoneNumberId,
				to: senderNumber,
				body: "Sorry, I had trouble processing that. Could you try again?",
			});
			logger.logMessageSent(
				senderNumber,
				"text",
				"Error message sent to user",
			);
		} catch (sendError) {
			logger.logError("Sending error message", sendError);
		}
	}

	return new Response("OK", { status: 200 });
}
