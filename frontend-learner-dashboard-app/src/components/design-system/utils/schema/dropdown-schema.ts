import { z } from "zod";

export const dropdownSchema = z.object({
    value: z.string().min(1, "This field is required"),
});

export type DropdownSchema = z.infer<typeof dropdownSchema>;
