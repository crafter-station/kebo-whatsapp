import { WhatsAppClient } from "@kapso/whatsapp-cloud-api";
import { put } from "@vercel/blob";
import { generateText, stepCountIs } from "ai";
import { and, eq, gte, lt } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { MealType } from "@/db/schema";
import type { LogFoodParams } from "@/lib/ai/tools";
import { tools } from "@/lib/ai/tools";
import {
	type DailySummaryData,
	type FoodAddedData,
	renderDailySummary,
	renderFoodAdded,
} from "@/lib/images";

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
 * Save food entry to database
 */
async function saveFoodEntry(
	userId: string,
	params: LogFoodParams,
	rawMessage: string,
) {
	const db = getDb();

	const [entry] = await db
		.insert(schema.foodEntries)
		.values({
			userId,
			foodName: params.foodName,
			foodId: params.foodId,
			quantity: params.quantity.toString(),
			unit: params.unit,
			calories: params.calories.toString(),
			protein: params.protein.toString(),
			carbs: params.carbs.toString(),
			fat: params.fat.toString(),
			fiber: params.fiber?.toString(),
			eatenAt: new Date(params.eatenAt),
			mealType: params.mealType,
			rawMessage,
		})
		.returning();

	return entry;
}

/**
 * Get daily summary for a user
 */
async function getDailySummary(userId: string, dateStr: string) {
	const db = getDb();

	// Parse date string (YYYY-MM-DD) and create Colombia timezone boundaries
	// The date string represents a date in Colombia timezone
	const [year, month, day] = dateStr.split("-").map(Number);

	// Create start of day in Colombia timezone (UTC-5)
	// Colombia is UTC-5, so midnight Colombia = 05:00 UTC
	const startOfDayUTC = new Date(Date.UTC(year, month - 1, day, 5, 0, 0, 0));

	// End of day in Colombia timezone = next day 00:00 Colombia = next day 05:00 UTC
	const endOfDayUTC = new Date(Date.UTC(year, month - 1, day + 1, 5, 0, 0, 0));

	const entries = await db.query.foodEntries.findMany({
		where: and(
			eq(schema.foodEntries.userId, userId),
			gte(schema.foodEntries.eatenAt, startOfDayUTC),
			lt(schema.foodEntries.eatenAt, endOfDayUTC),
		),
	});

	// Calculate totals
	const totals = entries.reduce(
		(acc, entry) => ({
			calories: acc.calories + Number(entry.calories),
			protein: acc.protein + Number(entry.protein),
			carbs: acc.carbs + Number(entry.carbs),
			fat: acc.fat + Number(entry.fat),
		}),
		{ calories: 0, protein: 0, carbs: 0, fat: 0 },
	);

	return {
		...totals,
		entryCount: entries.length,
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

	// Only respond to inbound text or image messages
	if (message?.kapso?.direction !== "inbound") {
		return new Response("OK", { status: 200 });
	}

	const isTextMessage = message?.type === "text";
	const isImageMessage = message?.type === "image";

	if (!isTextMessage && !isImageMessage) {
		return new Response("OK", { status: 200 });
	}

	const senderNumber = message.from.replace(/\D/g, ""); // Remove non-digits

	if (!phoneNumberId) {
		return new Response("OK", { status: 200 });
	}

	// Get text content from message
	const userTextMessage = isTextMessage
		? message.text?.body
		: message.image?.caption;

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

	// Need either text or image to proceed
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

		// System prompt for the nutrition agent
		const systemPrompt = `You are a friendly nutrition tracking assistant on WhatsApp for users in Colombia and Peru. Your job is to help users log their food intake and track their macronutrients.

Current date/time in Colombia: ${currentTime.toISOString()}
Current date: ${currentDateStr}

WHEN A USER SENDS AN IMAGE OF FOOD:
1. Analyze the image to identify the food items
2. Estimate the portion size based on the visual appearance
3. Search for each food item using the searchFood tool
4. Log each item using the logFood tool with your best estimate of quantities
5. If you can't identify a food clearly, ask the user for clarification

WHEN A USER TELLS YOU THEY ATE SOMETHING:
1. Use the searchFood tool to find the food in the database
   - Search in Spanish for better results (e.g., "manzana" instead of "apple")
   - If no results, try different terms or ask user for clarification

2. From the search results, pick the best match based on:
   - The food name matching what the user described
   - Prefer generic versions over branded unless user specified a brand

3. Use the logFood tool to record it:
   - Look at the "servings" array to find appropriate portion size
   - Match user's quantity to available servings (e.g., "1 taza", "2 cucharadas")
   - IMPORTANT: Multiply the macros by the quantity! If user ate 2 portions, double the calories/protein/carbs/fat
   - servingSize should be the grams for one serving from the search results
   - Set mealType based on time: breakfast (5-10am), lunch (11am-3pm), dinner (6-10pm), snack (other times)
   - eatenAt: use current time if "just ate", or infer from context

4. AFTER LOGGING FOOD:
   - DO NOT repeat the macros or give a summary - the image already shows all the details!
   - Keep your response very short: just a brief acknowledgment or a friendly follow-up question
   - Examples: "Got it!", "Logged!", "Anything else?", "How was it?", "What else did you have?"
   - NO need to say "I've logged X with Y calories and Z protein..." - that's redundant

WHEN USER ASKS ABOUT DAILY INTAKE/CALORIES:
1. Use the getDailySummary tool with today's date (${currentDateStr})

IF FOOD NOT FOUND:
- Ask user to be more specific or try a different name
- Suggest searching in Spanish if they used English

Be concise and friendly. The image shows all the nutritional details, so don't repeat them in text!`;

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
				// If no caption, ask the model to identify and log the food
				parts.push({
					type: "text",
					text: "What food is this? Please log it for me.",
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

		const whatsappClient = getWhatsAppClient();

		// Process tool calls
		for (const step of result.steps) {
			for (const toolResult of step.toolResults) {
				if (toolResult.toolName === "logFood") {
					const logParams = toolResult.output as LogFoodParams;

					// Save to database
					const entry = await saveFoodEntry(
						user.id,
						logParams,
						userTextMessage || "Image of food",
					);

					// Generate image
					const foodAddedData: FoodAddedData = {
						foodName: logParams.foodName,
						quantity: logParams.quantity,
						unit: logParams.unit,
						calories: logParams.calories,
						protein: logParams.protein,
						carbs: logParams.carbs,
						fat: logParams.fat,
						fiber: logParams.fiber,
						mealType: logParams.mealType as MealType,
						eatenAt: new Date(logParams.eatenAt),
					};

					const imageBuffer = await renderFoodAdded(foodAddedData);
					const imageUrl = await uploadImage(
						imageBuffer,
						`food-added-${entry.id}.png`,
					);

					// Send image via WhatsApp
					await whatsappClient.messages.sendImage({
						phoneNumberId,
						to: senderNumber,
						image: {
							link: imageUrl,
						},
					});
				} else if (toolResult.toolName === "getDailySummary") {
					const summaryParams = toolResult.output as {
						date: string;
						action: string;
					};

					// Get summary from database
					const summary = await getDailySummary(user.id, summaryParams.date);

					// Generate image
					const summaryData: DailySummaryData = {
						date: new Date(summaryParams.date),
						totalCalories: summary.calories,
						totalProtein: summary.protein,
						totalCarbs: summary.carbs,
						totalFat: summary.fat,
						entryCount: summary.entryCount,
					};

					const imageBuffer = await renderDailySummary(summaryData);
					const imageUrl = await uploadImage(
						imageBuffer,
						`daily-summary-${user.id}-${summaryParams.date}.png`,
					);

					// Send image via WhatsApp
					await whatsappClient.messages.sendImage({
						phoneNumberId,
						to: senderNumber,
						image: {
							link: imageUrl,
							caption: `Daily Summary: ${summary.calories} kcal`,
						},
					});
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
		}
	} catch (error) {
		console.error("Error processing message:", error);

		// Send error message to user
		try {
			const whatsappClient = getWhatsAppClient();
			await whatsappClient.messages.sendText({
				phoneNumberId,
				to: senderNumber,
				body: "Sorry, I had trouble processing that. Could you try again?",
			});
		} catch (sendError) {
			console.error("Error sending error message:", sendError);
		}
	}

	return new Response("OK", { status: 200 });
}
