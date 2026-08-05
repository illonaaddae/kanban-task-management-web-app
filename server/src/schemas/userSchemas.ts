import { z } from "zod";
import { THEME_PREFERENCES } from "../models/User";

export const updateMeSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Name cannot be empty")
      .max(80, "Name cannot exceed 80 characters")
      .optional(),
    themePreference: z
      .enum(THEME_PREFERENCES, "Theme preference must be either light or dark")
      .optional(),
    // Data URL or remote URL. The 1mb express.json limit bounds the size.
    avatar: z.string().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Provide at least one of: name, themePreference, avatar",
  });

export type UpdateMeInput = z.infer<typeof updateMeSchema>;
