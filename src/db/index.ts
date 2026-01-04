import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

function getDatabaseUrl(): string {
	const url = process.env.DATABASE_URL;
	if (!url) {
		throw new Error("DATABASE_URL environment variable is required");
	}
	return url;
}

// Create a lazy-initialized database instance
let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
	if (!dbInstance) {
		const sql = neon(getDatabaseUrl());
		dbInstance = drizzle(sql, { schema });
	}
	return dbInstance;
}

export { schema };
