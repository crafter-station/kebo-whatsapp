import { relations } from "drizzle-orm";
import {
	decimal,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";

// Meal type enum
export const mealTypeEnum = pgEnum("meal_type", [
	"breakfast",
	"lunch",
	"dinner",
	"snack",
]);

// Users table
export const users = pgTable("users", {
	id: uuid("id").defaultRandom().primaryKey(),
	phoneNumber: text("phone_number").notNull().unique(),
	timezone: text("timezone").notNull().default("America/Bogota"),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Food entries table
export const foodEntries = pgTable("food_entries", {
	id: uuid("id").defaultRandom().primaryKey(),
	userId: uuid("user_id")
		.notNull()
		.references(() => users.id),

	// Food info
	foodName: text("food_name").notNull(),
	foodId: text("food_id"), // From Fitia API, nullable
	quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull(),
	unit: text("unit").notNull(),

	// Macros
	calories: decimal("calories", { precision: 10, scale: 2 }).notNull(),
	protein: decimal("protein", { precision: 10, scale: 2 }).notNull(),
	carbs: decimal("carbs", { precision: 10, scale: 2 }).notNull(),
	fat: decimal("fat", { precision: 10, scale: 2 }).notNull(),
	fiber: decimal("fiber", { precision: 10, scale: 2 }),

	// Time tracking
	eatenAt: timestamp("eaten_at").notNull(),
	mealType: mealTypeEnum("meal_type").notNull(),

	// Metadata
	rawMessage: text("raw_message").notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
	foodEntries: many(foodEntries),
}));

export const foodEntriesRelations = relations(foodEntries, ({ one }) => ({
	user: one(users, {
		fields: [foodEntries.userId],
		references: [users.id],
	}),
}));

// Types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type FoodEntry = typeof foodEntries.$inferSelect;
export type NewFoodEntry = typeof foodEntries.$inferInsert;
export type MealType = "breakfast" | "lunch" | "dinner" | "snack";
