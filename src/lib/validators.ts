import { z } from "zod";

export const tagSchema = z
  .string()
  .min(2, "At least 2 characters")
  .max(30, "Up to 30 characters")
  .regex(
    /^[a-z][a-z0-9_]*$/,
    "Lowercase letter first, then letters, numbers, or underscores",
  );

export const elementSchema = z.object({
  tag: tagSchema,
  display_name: z.string().min(1, "Required").max(80, "Up to 80 characters"),
  type: z.enum(["character", "prop", "location", "style", "other"]),
  description: z.string().max(500, "Up to 500 characters").optional().or(z.literal("")),
});

export type ElementFormData = z.infer<typeof elementSchema>;

/** Convert any string into a valid tag slug. */
export function slugifyTag(input: string): string {
  let s = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (/^[0-9]/.test(s)) s = "x" + s;
  return s.substring(0, 30);
}
