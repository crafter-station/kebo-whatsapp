/**
 * Logging utilities for WhatsApp message processing
 */

export interface MessageLogData {
	messageId: string;
	from: string;
	type: string;
	hasText: boolean;
	hasImage: boolean;
	hasAudio: boolean;
	textContent?: string;
	conversationId?: string;
	audioData?: {
		duration?: number;
		mimeType?: string;
		transcription?: string;
	};
}

export interface CategoryDecisionLog {
	messageId: string;
	userMessage: string;
	aiResponse: string;
	toolCalls: Array<{
		toolName: string;
		category?: string;
		description?: string;
		amount?: number;
		vendor?: string;
	}>;
	stepCount: number;
	modelUsed: string;
}

export class Logger {
	private static instance: Logger;
	private logPrefix = "[KEBO-WA]";

	private constructor() {}

	static getInstance(): Logger {
		if (!Logger.instance) {
			Logger.instance = new Logger();
		}
		return Logger.instance;
	}

	/**
	 * Log incoming WhatsApp message details
	 */
	logIncomingMessage(data: MessageLogData) {
		console.log("\n" + "=".repeat(80));
		console.log(
			`${this.logPrefix} 📨 INCOMING MESSAGE - ${new Date().toISOString()}`,
		);
		console.log("=".repeat(80));
		console.log(`Message ID: ${data.messageId}`);
		console.log(`From: ${data.from}`);
		console.log(`Type: ${data.type}`);
		console.log(`Has Text: ${data.hasText}`);
		console.log(`Has Image: ${data.hasImage}`);
		console.log(`Has Audio: ${data.hasAudio}`);
		if (data.conversationId) {
			console.log(`Conversation ID: ${data.conversationId}`);
		}
		if (data.textContent) {
			console.log(`Text Content: "${data.textContent}"`);
		}
		if (data.audioData) {
			console.log(`Audio Details:`);
			if (data.audioData.duration) {
				console.log(`  ├─ Duration: ${data.audioData.duration}s`);
			}
			if (data.audioData.mimeType) {
				console.log(`  ├─ MIME Type: ${data.audioData.mimeType}`);
			}
			if (data.audioData.transcription) {
				console.log(`  └─ Transcription: "${data.audioData.transcription}"`);
			}
		}
		console.log("=".repeat(80) + "\n");
	}

	/**
	 * Log AI category decision process
	 */
	logCategoryDecision(data: CategoryDecisionLog) {
		console.log("\n" + "=".repeat(80));
		console.log(`${this.logPrefix} 🤖 AI PROCESSING & CATEGORY DECISION`);
		console.log("=".repeat(80));
		console.log(`Message ID: ${data.messageId}`);
		console.log(`Model: ${data.modelUsed}`);
		console.log(`Step Count: ${data.stepCount}`);
		console.log(`\nUser Message:\n  "${data.userMessage}"`);
		console.log(`\nAI Response:\n  "${data.aiResponse}"`);

		if (data.toolCalls.length > 0) {
			console.log(`\nTool Calls (${data.toolCalls.length}):`);
			data.toolCalls.forEach((call, index) => {
				console.log(`\n  [${index + 1}] ${call.toolName}`);
				if (call.category) {
					console.log(`      ├─ Category: ${call.category.toUpperCase()}`);
				}
				if (call.description) {
					console.log(`      ├─ Description: ${call.description}`);
				}
				if (call.amount !== undefined) {
					console.log(`      ├─ Amount: $${call.amount}`);
				}
				if (call.vendor) {
					console.log(`      └─ Vendor: ${call.vendor}`);
				}
			});
		} else {
			console.log("\n  ⚠️  No tool calls made");
		}

		console.log("\n" + "=".repeat(80) + "\n");
	}

	/**
	 * Log expense saved to database
	 */
	logExpenseSaved(
		expenseId: string,
		category: string,
		amount: number,
		description: string,
	) {
		console.log(
			`${this.logPrefix} 💾 EXPENSE SAVED - ID: ${expenseId} | Category: ${category.toUpperCase()} | Amount: $${amount} | Description: "${description}"`,
		);
	}

	/**
	 * Log image generation and upload
	 */
	logImageGenerated(type: "expense-added" | "summary" | "category-breakdown") {
		console.log(`${this.logPrefix} 🖼️  IMAGE GENERATED - Type: ${type}`);
	}

	/**
	 * Log message sent to user
	 */
	logMessageSent(to: string, type: "text" | "image", content?: string) {
		console.log(
			`${this.logPrefix} 📤 MESSAGE SENT - To: ${to} | Type: ${type}${content ? ` | Content: "${content}"` : ""}`,
		);
	}

	/**
	 * Log errors
	 */
	logError(context: string, error: unknown) {
		console.error(`\n${this.logPrefix} ❌ ERROR in ${context}:`);
		console.error(error);
		console.error("");
	}

	/**
	 * Log audio transcription
	 */
	logAudioTranscription(
		messageId: string,
		duration: number,
		transcription: string,
	) {
		console.log(
			`${this.logPrefix} 🎤 AUDIO TRANSCRIBED - ID: ${messageId} | Duration: ${duration}s | Text: "${transcription}"`,
		);
	}

	/**
	 * Log general info
	 */
	logInfo(message: string) {
		console.log(`${this.logPrefix} ℹ️  ${message}`);
	}

	/**
	 * Log separator
	 */
	logSeparator() {
		console.log("\n" + "-".repeat(80) + "\n");
	}
}

// Export singleton instance
export const logger = Logger.getInstance();
