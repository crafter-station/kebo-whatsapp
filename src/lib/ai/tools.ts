import { tool } from "ai";
import { z } from "zod";
import { type FitiaFood, searchFoods } from "../fitia";

// Define schemas separately for type inference
const searchFoodSchema = z.object({
	query: z
		.string()
		.describe(
			"The food name to search for in English or Spanish. Be specific (e.g., 'manzana roja' instead of just 'apple')",
		),
});

const logFoodSchema = z.object({
	foodId: z.string().describe("The food ID from the search results"),
	foodName: z.string().describe("The name of the food"),
	quantity: z.number().describe("The quantity eaten (e.g., 1, 2, 0.5)"),
	unit: z
		.string()
		.describe(
			"The unit of measurement from the search results (e.g., 'porcion', 'taza', 'gramos')",
		),
	servingSize: z
		.number()
		.describe("The size of one serving in grams from the search results"),
	calories: z.number().describe("Total calories for the quantity eaten"),
	protein: z.number().describe("Total protein in grams for the quantity eaten"),
	carbs: z.number().describe("Total carbs in grams for the quantity eaten"),
	fat: z.number().describe("Total fat in grams for the quantity eaten"),
	fiber: z
		.number()
		.optional()
		.describe("Total fiber in grams for the quantity eaten"),
	mealType: z
		.enum(["breakfast", "lunch", "dinner", "snack"])
		.describe("The type of meal based on the time or context"),
	eatenAt: z
		.string()
		.describe(
			"ISO timestamp of when the food was eaten, inferred from context",
		),
});

const getDailySummarySchema = z.object({
	date: z.string().describe("The date to get summary for in YYYY-MM-DD format"),
});

// Export types
export type SearchFoodParams = z.infer<typeof searchFoodSchema>;
export type LogFoodParams = z.infer<typeof logFoodSchema>;
export type GetDailySummaryParams = z.infer<typeof getDailySummarySchema>;

/**
 * Tool for searching foods in the Fitia database
 */
export const searchFoodTool = tool<SearchFoodParams, FitiaFood[]>({
	description: `Search for a food in the nutrition database to get its macronutrient information.
The results include:
- name: Food name
- brand: Brand name if applicable
- servingName: Default serving name (e.g., "porcion", "taza")
- servingSize: Size of one serving in grams
- calories, protein, carbs, fat: Macros for ONE default serving
- servings: Array of all available serving options with their macros

IMPORTANT: The macros returned are for ONE serving. If the user ate multiple servings, multiply accordingly.
For example, if user ate "2 manzanas" and the serving is "1 unidad" with 95 calories, log 190 calories total.`,
	inputSchema: searchFoodSchema,
	execute: async (params) => {
		const results = await searchFoods(params.query);
		// Return top 5 results to keep context manageable
		return results.slice(0, 5);
	},
});

/**
 * Tool for logging a food entry
 */
export const logFoodTool = tool<LogFoodParams, LogFoodParams>({
	description: `Log a food entry after finding it in the database.
IMPORTANT: Calculate the total macros based on the quantity the user ate.
If user ate 2 servings and each serving has 100 calories, log 200 calories total.`,
	inputSchema: logFoodSchema,
	execute: async (params) => {
		// This will be handled by the webhook - we return the params for processing
		return params;
	},
});

/**
 * Tool for getting daily summary
 */
export const getDailySummaryTool = tool<
	GetDailySummaryParams,
	{ date: string; action: "get_daily_summary" }
>({
	description:
		"Get the daily calorie and macronutrient summary for a specific date. Use this when the user asks about their daily intake, calories consumed, etc.",
	inputSchema: getDailySummarySchema,
	execute: async (params) => {
		// This will be handled by the webhook
		return { date: params.date, action: "get_daily_summary" as const };
	},
});

export const tools = {
	searchFood: searchFoodTool,
	logFood: logFoodTool,
	getDailySummary: getDailySummaryTool,
};
