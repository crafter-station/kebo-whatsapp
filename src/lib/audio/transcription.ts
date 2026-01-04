/**
 * Audio transcription utilities using Anthropic API
 */

import Anthropic from "@anthropic-ai/sdk";
import { logger } from "@/lib/logger";

/**
 * Transcribe audio using Anthropic API
 */
export async function transcribeAudio(
	audioBuffer: Buffer,
	mimeType: string,
): Promise<string | null> {
	try {
		const apiKey = process.env.ANTHROPIC_API_KEY;
		if (!apiKey) {
			logger.logError(
				"transcribeAudio",
				"ANTHROPIC_API_KEY environment variable is required",
			);
			return null;
		}

		const anthropic = new Anthropic({ apiKey });

		// Convert audio to base64
		const base64Audio = audioBuffer.toString("base64");

		// Determine media type for Anthropic API
		// Anthropic supports audio formats via document type
		const mediaType = getAnthropicMediaType(mimeType);

		if (!mediaType) {
			logger.logError(
				"transcribeAudio",
				`Unsupported audio format: ${mimeType}`,
			);
			return null;
		}

		logger.logInfo(`Transcribing audio (${mimeType}, ${audioBuffer.length} bytes)`);

		// Use Claude to transcribe the audio
		const message = await anthropic.messages.create({
			model: "claude-3-5-sonnet-20241022",
			max_tokens: 1024,
			messages: [
				{
					role: "user",
					content: [
						{
							type: "document",
							source: {
								type: "base64",
								media_type: mediaType,
								data: base64Audio,
							},
						},
						{
							type: "text",
							text: "Please transcribe this audio message. Only return the transcribed text, nothing else. If the audio is in Spanish, transcribe it in Spanish. If it's in English, transcribe it in English.",
						},
					],
				},
			],
		});

		// Extract transcription from response
		const transcription =
			message.content[0]?.type === "text" ? message.content[0].text : null;

		if (transcription) {
			logger.logInfo(`Transcription successful: "${transcription.substring(0, 100)}..."`);
		} else {
			logger.logError("transcribeAudio", "No transcription returned");
		}

		return transcription;
	} catch (error) {
		logger.logError("transcribeAudio", error);
		return null;
	}
}

/**
 * Get Anthropic-compatible media type from WhatsApp MIME type
 */
function getAnthropicMediaType(
	mimeType: string,
): "audio/mpeg" | "audio/wav" | "audio/webm" | null {
	// Map WhatsApp audio formats to Anthropic supported formats
	const normalizedType = mimeType.toLowerCase();

	if (
		normalizedType.includes("ogg") ||
		normalizedType.includes("opus") ||
		normalizedType.includes("webm")
	) {
		return "audio/webm";
	}

	if (normalizedType.includes("mpeg") || normalizedType.includes("mp3")) {
		return "audio/mpeg";
	}

	if (normalizedType.includes("wav")) {
		return "audio/wav";
	}

	// Default to webm for WhatsApp voice notes
	if (normalizedType.includes("audio")) {
		return "audio/webm";
	}

	return null;
}

/**
 * Download audio from URL
 */
export async function downloadAudioFromUrl(
	url: string,
	contentType?: string,
): Promise<{ data: Buffer; mimeType: string; duration?: number } | null> {
	try {
		logger.logInfo(`Downloading audio from: ${url.substring(0, 80)}...`);

		const response = await fetch(url);

		if (!response.ok) {
			logger.logError(
				"downloadAudioFromUrl",
				`HTTP ${response.status}: ${response.statusText}`,
			);
			return null;
		}

		const arrayBuffer = await response.arrayBuffer();
		const buffer = Buffer.from(arrayBuffer);

		logger.logInfo(`Downloaded ${buffer.length} bytes`);

		// Validate we got actual audio data
		if (buffer.length < 100) {
			logger.logError(
				"downloadAudioFromUrl",
				"Data too small, likely not audio",
			);
			return null;
		}

		// Use provided content type or response header
		const mimeType =
			contentType ||
			response.headers.get("content-type") ||
			"audio/ogg; codecs=opus";

		logger.logInfo(`Audio MIME type: ${mimeType}`);

		return {
			data: buffer,
			mimeType,
		};
	} catch (error) {
		logger.logError("downloadAudioFromUrl", error);
		return null;
	}
}
