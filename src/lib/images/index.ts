import { ImageResponse } from "next/og";
import type { ReactElement } from "react";

export interface ImageOptions {
	width?: number;
	height?: number;
}

/**
 * Render a React component to PNG buffer using @vercel/og
 */
export async function renderToPng(
	element: ReactElement,
	options: ImageOptions = {},
): Promise<Buffer> {
	const { width = 800, height = 600 } = options;

	const response = new ImageResponse(element, {
		width,
		height,
	});

	const arrayBuffer = await response.arrayBuffer();
	return Buffer.from(arrayBuffer);
}

// Color palette for the app
export const colors = {
	primary: "#10B981", // Emerald green
	secondary: "#6366F1", // Indigo
	background: "#FFFFFF",
	surface: "#F3F4F6",
	text: "#1F2937",
	textSecondary: "#6B7280",
	border: "#E5E7EB",
	success: "#10B981",
	warning: "#F59E0B",
	error: "#EF4444",
	// Macro colors
	calories: "#EF4444",
	protein: "#3B82F6",
	carbs: "#F59E0B",
	fat: "#8B5CF6",
	fiber: "#10B981",
};

// Meal type info
export const mealInfo = {
	breakfast: { emoji: "sunrise", label: "Breakfast", color: "#F59E0B" },
	lunch: { emoji: "sun", label: "Lunch", color: "#10B981" },
	dinner: { emoji: "moon", label: "Dinner", color: "#6366F1" },
	snack: { emoji: "cookie", label: "Snack", color: "#EC4899" },
} as const;

/**
 * Format number with commas
 */
export function formatNumber(num: number): string {
	return new Intl.NumberFormat("en-US").format(Math.round(num));
}

/**
 * Format date for display
 */
export function formatDate(date: Date): string {
	return new Intl.DateTimeFormat("en-US", {
		weekday: "long",
		month: "short",
		day: "numeric",
	}).format(date);
}

/**
 * Format time for display
 */
export function formatTime(date: Date): string {
	return new Intl.DateTimeFormat("en-US", {
		hour: "numeric",
		minute: "2-digit",
		hour12: true,
	}).format(date);
}

export {
	type DailySummaryData,
	renderDailySummary,
} from "./templates/daily-summary";
// Re-export templates
export { type FoodAddedData, renderFoodAdded } from "./templates/food-added";
