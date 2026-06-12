import { prettifyError, ZodError } from "zod";

export const formatZodError = (error: unknown): string | null =>
	error instanceof ZodError ? prettifyError(error) : null;
