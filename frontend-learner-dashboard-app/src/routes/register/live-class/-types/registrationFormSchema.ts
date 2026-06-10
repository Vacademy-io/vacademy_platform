import { z, ZodTypeAny, ZodObject, ZodString } from "zod";
import { phoneSchema } from "@/lib/phone-validation";
import { CustomField } from "./type";

export const generateZodSchema = (
  customFields: CustomField[] | undefined
): ZodObject<any> => {
  if (customFields === undefined) {
    return z.object({ email: z.string().email() });
  }
  const shape: Record<string, ZodTypeAny> = {};

  for (const field of customFields) {
    // Phone field gets country-aware validation instead of plain text rules.
    if (field.fieldKey === "mobile_number") {
      shape[field.fieldKey] = phoneSchema({
        required: field.mandatory,
        label: field.fieldName,
      });
      continue;
    }

    let schema: ZodTypeAny;

    switch (field.fieldType.toLowerCase()) {
      case "text":
        schema = z.string();
        break;
      case "dropdown":
        try {
          const options = JSON.parse(field.config);
          const optionValues = options.map((opt: any) => opt.name);
          schema = z.enum([...optionValues] as [string, ...string[]]);
        } catch (err) {
          schema = z.string(); // fallback
        }
        break;
      default:
        schema = z.string(); // fallback
    }

    // ✅ Apply `.nonempty()` only to ZodString types
    if (field.mandatory) {
      if (schema instanceof z.ZodString) {
        schema = (schema as ZodString).nonempty(
          `${field.fieldName} is required`
        );
      } else {
        schema = schema; // you can optionally make enums required differently
      }
    } else {
      schema = schema.optional();
    }

    shape[field.fieldKey] = schema;
  }

  return z.object(shape);
};
