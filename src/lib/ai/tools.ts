import { tool } from "ai";
import { z } from "zod";

// Expense categories
const expenseCategories = [
	"food_dining",
	"transportation",
	"shopping",
	"entertainment",
	"bills_utilities",
	"health",
	"education",
	"travel",
	"other",
] as const;

// Define schemas for expense tracking
const logExpenseSchema = z.object({
	description: z
		.string()
		.describe("Brief description of the expense (e.g., 'New MacBook Pro')"),
	amount: z.number().positive().describe("Amount spent in USD"),
	category: z
		.enum(expenseCategories)
		.describe(
			"Expense category: food_dining, transportation, shopping, entertainment, bills_utilities, health, education, travel, or other",
		),
	vendor: z
		.string()
		.optional()
		.describe("Store or vendor name if mentioned (e.g., 'Apple Store', 'Amazon')"),
	spentAt: z
		.string()
		.describe(
			"ISO timestamp of when money was spent, inferred from context (default to now if not specified)",
		),
});

const getExpensesSummarySchema = z.object({
	period: z
		.enum(["day", "week", "month", "year"])
		.describe("Time period for the summary"),
	date: z
		.string()
		.optional()
		.describe("Reference date in YYYY-MM-DD format (defaults to today)"),
	category: z
		.enum(expenseCategories)
		.optional()
		.describe("Optional: filter by specific category"),
});

const getExpensesByCategorySchema = z.object({
	startDate: z.string().describe("Start date in YYYY-MM-DD format"),
	endDate: z.string().describe("End date in YYYY-MM-DD format"),
});

// Export types
export type LogExpenseParams = z.infer<typeof logExpenseSchema>;
export type GetExpensesSummaryParams = z.infer<typeof getExpensesSummarySchema>;
export type GetExpensesByCategoryParams = z.infer<
	typeof getExpensesByCategorySchema
>;

/**
 * Tool for logging an expense
 */
export const logExpenseTool = tool<LogExpenseParams, LogExpenseParams>({
	description: `Log an expense when a user mentions they bought or spent money on something.
Examples of user messages:
- "I just bought a new computer for 500 dollars"
- "Spent 25 on lunch today"
- "Paid 150 for electricity bill"
- "Got groceries for 80 bucks yesterday"

Infer the category from context:
- food_dining: restaurants, groceries, coffee, food delivery
- transportation: gas, uber, bus, car maintenance, parking
- shopping: electronics, clothes, furniture, online shopping
- entertainment: movies, games, streaming subscriptions, concerts
- bills_utilities: electricity, water, internet, phone bill, rent
- health: medicine, doctor visits, gym membership
- education: books, courses, tuition, school supplies
- travel: hotels, flights, vacation expenses
- other: anything that doesn't fit above`,
	inputSchema: logExpenseSchema,
	execute: async (params) => {
		// This will be handled by the webhook - we return the params for processing
		return params;
	},
});

/**
 * Tool for getting expenses summary
 */
export const getExpensesSummaryTool = tool<
	GetExpensesSummaryParams,
	{ period: string; date?: string; category?: string; action: "get_expenses_summary" }
>({
	description: `Get a summary of expenses for a specific time period.
Use this when the user asks:
- "How much did I spend this week?"
- "What are my expenses this month?"
- "Show me my spending for today"
- "How much did I spend on food this month?"`,
	inputSchema: getExpensesSummarySchema,
	execute: async (params) => {
		return {
			period: params.period,
			date: params.date,
			category: params.category,
			action: "get_expenses_summary" as const,
		};
	},
});

/**
 * Tool for getting expenses breakdown by category
 */
export const getExpensesByCategoryTool = tool<
	GetExpensesByCategoryParams,
	{ startDate: string; endDate: string; action: "get_expenses_by_category" }
>({
	description: `Get a breakdown of expenses by category for a date range.
Use this when the user asks:
- "Show me my spending by category"
- "Where is my money going?"
- "Breakdown of expenses this month"`,
	inputSchema: getExpensesByCategorySchema,
	execute: async (params) => {
		return {
			startDate: params.startDate,
			endDate: params.endDate,
			action: "get_expenses_by_category" as const,
		};
	},
});

export const tools = {
	logExpense: logExpenseTool,
	getExpensesSummary: getExpensesSummaryTool,
	getExpensesByCategory: getExpensesByCategoryTool,
};
