import { z, ZodTypeAny, ZodObject, ZodString } from "zod";
import { phoneSchema } from "@/lib/phone-validation";
import { CustomField } from "./type";
import {
  getFieldRenderType,
  parseDropdownOptions,
  FieldRenderType,
} from "@/components/common/enroll-by-invite/-utils/custom-field-helpers";

export const generateZodSchema = (
  customFields: CustomField[] | undefined
): ZodObject<any> => {
  if (customFields === undefined) {
    return z.object({ email: z.string().email() });
  }
  const shape: Record<string, ZodTypeAny> = {};

  for (const field of customFields) {
    // Phone field gets country-aware validation instead of plain text rules.
    // Detect by render type, not a literal "mobile_number" key — the backend
    // suffixes field keys per institute (e.g. "mobile_number_inst_<id>"), so a
    // strict key match would skip validation and let "12" through.
    if (getFieldRenderType(field.fieldKey, field.fieldType) === FieldRenderType.PHONE) {
      shape[field.fieldKey] = phoneSchema({
        required: field.mandatory,
        label: field.fieldName,
      });
      continue;
    }

    let schema: ZodTypeAny;

    // Dropdown values must come from the same parser the <Select> renders from.
    // Parsing field.config a second time here is what let the two drift apart:
    // the enum was built from `opt.name` while the options rendered `opt.value`.
    if (getFieldRenderType(field.fieldKey, field.fieldType) === FieldRenderType.DROPDOWN) {
      const optionValues = parseDropdownOptions(field.config).map((opt) => opt.value);
      schema = optionValues.length
        ? z.enum(optionValues as [string, ...string[]])
        : z.string();
    } else {
      schema = z.string();
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
