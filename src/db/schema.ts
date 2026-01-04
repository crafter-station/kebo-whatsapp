import { relations } from "drizzle-orm";
import {
	decimal,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";

// Expense category enum
export const expenseCategoryEnum = pgEnum("expense_category", [
	"food_dining",
	"transportation",
	"shopping",
	"entertainment",
	"bills_utilities",
	"health",
	"education",
	"travel",
	"other",
]);

// Users table
export const users = pgTable("users", {
	id: uuid("id").defaultRandom().primaryKey(),
	phoneNumber: text("phone_number").notNull().unique(),
	timezone: text("timezone").notNull().default("America/Bogota"),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Expenses table
export const expenses = pgTable("expenses", {
	id: uuid("id").defaultRandom().primaryKey(),
	userId: uuid("user_id")
		.notNull()
		.references(() => users.id),

	// Expense info
	description: text("description").notNull(),
	amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
	currency: text("currency").notNull().default("USD"),
	category: expenseCategoryEnum("category").notNull(),

	// Optional details
	vendor: text("vendor"),
	notes: text("notes"),

	// Time tracking
	spentAt: timestamp("spent_at").notNull(),

	// Metadata
	rawMessage: text("raw_message").notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
	expenses: many(expenses),
}));

export const expensesRelations = relations(expenses, ({ one }) => ({
	user: one(users, {
		fields: [expenses.userId],
		references: [users.id],
	}),
}));

// Types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Expense = typeof expenses.$inferSelect;
export type NewExpense = typeof expenses.$inferInsert;
export type ExpenseCategory =
	| "food_dining"
	| "transportation"
	| "shopping"
	| "entertainment"
	| "bills_utilities"
	| "health"
	| "education"
	| "travel"
	| "other";
