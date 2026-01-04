/**
 * Internationalization support for expense tracking images
 */

export type SupportedLocale = "en" | "es";

interface Translations {
	expenseLogged: string;
	totalSpent: string;
	expensesLogged: string;
	expense: string;
	expenses: string;
	at: string; // "at" for vendor name
}

const translations: Record<SupportedLocale, Translations> = {
	en: {
		expenseLogged: "Expense Logged",
		totalSpent: "Total Spent",
		expensesLogged: "logged",
		expense: "expense",
		expenses: "expenses",
		at: "at",
	},
	es: {
		expenseLogged: "Gasto Registrado",
		totalSpent: "Total Gastado",
		expensesLogged: "registrados",
		expense: "gasto",
		expenses: "gastos",
		at: "en",
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
