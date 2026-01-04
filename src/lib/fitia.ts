import { z } from "zod";

// =============================================================================
// TYPES
// =============================================================================

// Simplified food type for our app
export interface FoodItem {
	id: string;
	name: string;
	brand?: string;
	description?: string;
	category?: string;
	// Default serving info
	servingName: string;
	servingSize: number;
	servingUnit: string;
	// Macros for 100g (base values)
	caloriesPer100g: number;
	proteinPer100g: number;
	carbsPer100g: number;
	fatPer100g: number;
	fiberPer100g?: number;
	// Macros for default serving
	calories: number;
	protein: number;
	carbs: number;
	fat: number;
	fiber?: number;
	// All available servings
	servings: Array<{
		name: string;
		size: number;
		unit: string;
		quantity: string;
		calories: number;
		protein: number;
		carbs: number;
		fat: number;
	}>;
}

// Keep old type name for backwards compatibility
export type FitiaFood = FoodItem;

// Search parameters schema
export const foodSearchSchema = z.object({
	query: z.string().describe("The food name to search for"),
});

export type FoodSearchParams = z.infer<typeof foodSearchSchema>;

// Keep old schema names for backwards compatibility
export { foodSearchSchema as fitiaSearchSchema };
export type FitiaSearchParams = FoodSearchParams;

// =============================================================================
// OPEN FOOD FACTS API
// =============================================================================

interface OpenFoodFactsProduct {
	code: string;
	product_name?: string;
	product_name_es?: string;
	brands?: string;
	categories?: string;
	nutriments?: {
		"energy-kcal_100g"?: number;
		proteins_100g?: number;
		carbohydrates_100g?: number;
		fat_100g?: number;
		fiber_100g?: number;
	};
	serving_size?: string;
	serving_quantity?: number;
}

interface OpenFoodFactsResponse {
	count: number;
	page: number;
	page_size: number;
	products: OpenFoodFactsProduct[];
}

/**
 * Calculate macros for a given portion size based on per-100g values
 */
function calculateMacrosFromPer100g(
	per100gValues: {
		calories: number;
		protein: number;
		carbs: number;
		fat: number;
		fiber?: number;
	},
	portionSizeGrams: number,
) {
	const factor = portionSizeGrams / 100;
	return {
		calories: Math.round(per100gValues.calories * factor * 10) / 10,
		protein: Math.round(per100gValues.protein * factor * 10) / 10,
		carbs: Math.round(per100gValues.carbs * factor * 10) / 10,
		fat: Math.round(per100gValues.fat * factor * 10) / 10,
		fiber: per100gValues.fiber
			? Math.round(per100gValues.fiber * factor * 10) / 10
			: undefined,
	};
}

/**
 * Parse serving size string like "100g", "1 cup (240ml)", etc.
 */
function parseServingSize(servingStr?: string): {
	name: string;
	size: number;
	unit: string;
} {
	if (!servingStr) {
		return { name: "100g", size: 100, unit: "g" };
	}

	// Try to extract grams from common patterns
	const gramMatch = servingStr.match(/(\d+(?:\.\d+)?)\s*g(?:rams?)?/i);
	if (gramMatch) {
		const size = Number.parseFloat(gramMatch[1]);
		return { name: servingStr, size, unit: "g" };
	}

	// Try to extract ml (treat as roughly equal to grams for liquids)
	const mlMatch = servingStr.match(/(\d+(?:\.\d+)?)\s*ml/i);
	if (mlMatch) {
		const size = Number.parseFloat(mlMatch[1]);
		return { name: servingStr, size, unit: "ml" };
	}

	// Default to 100g
	return { name: servingStr || "100g", size: 100, unit: "g" };
}

/**
 * Search for foods in Open Food Facts (global food database)
 */
async function searchOpenFoodFacts(query: string): Promise<FoodItem[]> {
	const params = new URLSearchParams({
		search_terms: query,
		search_simple: "1",
		action: "process",
		json: "1",
		page_size: "15",
		fields:
			"code,product_name,product_name_es,brands,categories,nutriments,serving_size,serving_quantity",
	});

	const response = await fetch(
		`https://world.openfoodfacts.org/cgi/search.pl?${params.toString()}`,
		{
			headers: {
				"User-Agent": "KapsoCrafter/1.0 (macros-tracking-app)",
				Accept: "application/json",
			},
		},
	);

	if (!response.ok) {
		throw new Error(`Open Food Facts API error: ${response.status}`);
	}

	const data: OpenFoodFactsResponse = await response.json();

	const foods: FoodItem[] = [];

	for (const product of data.products) {
		const nutriments = product.nutriments;
		if (!nutriments) continue;

		// Get calories - skip if no calorie data
		const caloriesPer100g = nutriments["energy-kcal_100g"];
		if (caloriesPer100g === undefined) continue;

		const proteinPer100g = nutriments.proteins_100g || 0;
		const carbsPer100g = nutriments.carbohydrates_100g || 0;
		const fatPer100g = nutriments.fat_100g || 0;
		const fiberPer100g = nutriments.fiber_100g;

		// Get product name (prefer Spanish)
		const name = product.product_name_es || product.product_name;
		if (!name) continue;

		// Parse serving info
		const serving = parseServingSize(product.serving_size);
		const servingSize = product.serving_quantity || serving.size;

		// Calculate macros for default serving
		const defaultMacros = calculateMacrosFromPer100g(
			{
				calories: caloriesPer100g,
				protein: proteinPer100g,
				carbs: carbsPer100g,
				fat: fatPer100g,
				fiber: fiberPer100g,
			},
			servingSize,
		);

		// Create standard servings (100g + parsed serving if different)
		const servings: FoodItem["servings"] = [
			{
				name: "100g",
				size: 100,
				unit: "g",
				quantity: "100",
				calories: caloriesPer100g,
				protein: proteinPer100g,
				carbs: carbsPer100g,
				fat: fatPer100g,
			},
		];

		if (servingSize !== 100) {
			servings.unshift({
				name: serving.name,
				size: servingSize,
				unit: serving.unit,
				quantity: String(servingSize),
				calories: defaultMacros.calories,
				protein: defaultMacros.protein,
				carbs: defaultMacros.carbs,
				fat: defaultMacros.fat,
			});
		}

		foods.push({
			id: product.code,
			name,
			brand: product.brands,
			category: product.categories?.split(",")[0]?.trim(),
			servingName: servingSize !== 100 ? serving.name : "100g",
			servingSize,
			servingUnit: serving.unit,
			caloriesPer100g,
			proteinPer100g,
			carbsPer100g,
			fatPer100g,
			fiberPer100g,
			calories: defaultMacros.calories,
			protein: defaultMacros.protein,
			carbs: defaultMacros.carbs,
			fat: defaultMacros.fat,
			fiber: defaultMacros.fiber,
			servings,
		});
	}

	return foods;
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Search for foods using Open Food Facts
 */
export async function searchFoods(query: string): Promise<FoodItem[]> {
	const results = await searchOpenFoodFacts(query);
	console.log(`Found ${results.length} results from Open Food Facts`);
	return results;
}

/**
 * Find the best matching food for a query
 */
export async function findBestMatch(query: string): Promise<FoodItem | null> {
	const foods = await searchFoods(query);
	return foods[0] || null;
}
