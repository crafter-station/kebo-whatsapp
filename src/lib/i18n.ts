/**
 * Internationalization support for expense tracking images
 */

import type { ExpenseCategory } from "@/db/schema";

export type SupportedLocale = "en" | "es";

interface Translations {
	expenseLogged: string;
	totalSpent: string;
	expensesLogged: string;
	expense: string;
	expenses: string;
	at: string; // "at" for vendor name
	// Period labels
	today: string;
	thisWeek: string;
	thisMonth: string;
	thisYear: string;
	customRange: string;
	// Category labels
	categories: Record<ExpenseCategory, string>;
}

const translations: Record<SupportedLocale, Translations> = {
	en: {
		expenseLogged: "Expense Logged",
		totalSpent: "Total Spent",
		expensesLogged: "logged",
		expense: "expense",
		expenses: "expenses",
		at: "at",
		today: "Today",
		thisWeek: "This Week",
		thisMonth: "This Month",
		thisYear: "This Year",
		customRange: "Custom Range",
		categories: {
			food_dining: "Food & Dining",
			transportation: "Transportation",
			shopping: "Shopping",
			entertainment: "Entertainment",
			bills_utilities: "Bills & Utilities",
			health: "Health",
			education: "Education",
			travel: "Travel",
			other: "Other",
		},
	},
	es: {
		expenseLogged: "Gasto Registrado",
		totalSpent: "Total Gastado",
		expensesLogged: "registrados",
		expense: "gasto",
		expenses: "gastos",
		at: "en",
		today: "Hoy",
		thisWeek: "Esta Semana",
		thisMonth: "Este Mes",
		thisYear: "Este Año",
		customRange: "Rango Personalizado",
		categories: {
			food_dining: "Comida y Restaurantes",
			transportation: "Transporte",
			shopping: "Compras",
			entertainment: "Entretenimiento",
			bills_utilities: "Facturas y Servicios",
			health: "Salud",
			education: "Educación",
			travel: "Viajes",
			other: "Otros",
		},
	},
};

/**
 * Get translations for a specific locale
 */
export function getTranslations(locale: SupportedLocale): Translations {
	return translations[locale];
}

/**
 * Format expense count with proper singular/plural
 */
export function formatExpenseCount(
	count: number,
	locale: SupportedLocale,
): string {
	const t = getTranslations(locale);
	return count === 1 ? t.expense : t.expenses;
}

/**
 * Translate period label to the specified locale
 */
export function translatePeriodLabel(
	periodLabel: string,
	locale: SupportedLocale,
): string {
	const t = getTranslations(locale);

	// Map English period labels to translation keys
	const periodMap: Record<string, string> = {
		"Today": t.today,
		"This Week": t.thisWeek,
		"This Month": t.thisMonth,
		"This Year": t.thisYear,
		"Custom Range": t.customRange,
	};

	return periodMap[periodLabel] || periodLabel;
}

/**
 * Get translated category name
 */
export function getCategoryName(
	category: ExpenseCategory,
	locale: SupportedLocale,
): string {
	const t = getTranslations(locale);
	return t.categories[category];
}
