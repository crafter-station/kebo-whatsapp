import { ImageResponse } from "next/og";
import type { ReactElement } from "react";
import type { ExpenseCategory } from "@/db/schema";

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
	// Money/expense colors
	expense: "#EF4444", // Red for expenses
	income: "#10B981", // Green for income (future)
};

// Category info with colors and labels
export const categoryInfo: Record<
	ExpenseCategory,
	{ label: string; color: string; icon: string }
> = {
	food_dining: { label: "Food & Dining", color: "#F59E0B", icon: "F" },
	transportation: { label: "Transportation", color: "#3B82F6", icon: "T" },
	shopping: { label: "Shopping", color: "#EC4899", icon: "S" },
	entertainment: { label: "Entertainment", color: "#8B5CF6", icon: "E" },
	bills_utilities: { label: "Bills & Utilities", color: "#6366F1", icon: "B" },
	health: { label: "Health", color: "#10B981", icon: "H" },
	education: { label: "Education", color: "#06B6D4", icon: "Ed" },
	travel: { label: "Travel", color: "#F97316", icon: "Tr" },
	other: { label: "Other", color: "#6B7280", icon: "O" },
};

/**
 * Format number as currency
 */
export function formatCurrency(amount: number, currency = "USD"): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency,
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	}).format(amount);
}

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

/**
 * Format date range for display
 */
export function formatDateRange(startDate: Date, endDate: Date): string {
	const sameMonth =
		startDate.getMonth() === endDate.getMonth() &&
		startDate.getFullYear() === endDate.getFullYear();

	if (sameMonth) {
		return `${startDate.getDate()} - ${new Intl.DateTimeFormat("en-US", {
			month: "short",
			day: "numeric",
			year: "numeric",
		}).format(endDate)}`;
	}

	return `${new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
	}).format(startDate)} - ${new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	}).format(endDate)}`;
}

// Re-export templates
export {
	type ExpenseAddedData,
	renderExpenseAdded,
} from "./templates/expense-added";
export {
	type CategoryBreakdown,
	type ExpensesSummaryData,
	renderExpensesSummary,
} from "./templates/expenses-summary";
