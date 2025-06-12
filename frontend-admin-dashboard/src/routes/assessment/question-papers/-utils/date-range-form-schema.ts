import { z } from "zod";

export const dateRangeFormSchema = z.object({
    startDate: z.string().refine(
        (date) => !isNaN(Date.parse(date)), // Check if it's a valid date string
        { message: "Start date must be a valid date." },
    ),
    endDate: z.string().refine(
        (date) => !isNaN(Date.parse(date)), // Check if it's a valid date string
        { message: "End date must be a valid date." },
    ),
});
