import { bigint, timestamp } from "drizzle-orm/pg-core";

export const id = {
	id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
};

export const createdAt = {
	createdAt: timestamp("created_at").defaultNow().notNull(),
};

export const timestamps = {
	...createdAt,
	updatedAt: timestamp("updated_at")
		.defaultNow()
		.notNull()
		.$onUpdate(() => new Date()),
};
