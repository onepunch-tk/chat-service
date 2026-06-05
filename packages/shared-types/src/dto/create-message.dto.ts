import { z } from "zod";

/**  import type { messages } from "@repo/db/schemas";
  import { z } from "zod";

  type InsertMessage = typeof messages.$inferInsert;

  export const createMessageSchema = z.object({
        roomId: z.uuid(),
        content: z.string().min(1).max(2000),
  }) satisfies z.ZodType<Pick<InsertMessage, "roomId" | "content">>;

  export type CreateMessageInput = z.infer<typeof createMessageSchema>;
 */
