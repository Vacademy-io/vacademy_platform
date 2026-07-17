/**
 * Utility functions for handling custom fields in registration forms
 */

export interface CustomField {
  guestId: string | null;
  id: string;
  fieldKey: string;
  fieldName: string;
  fieldType: string;
  defaultValue: string | null;
  config: string;
  formOrder: number | null;
  isMandatory: boolean | null;
  isFilter: boolean;
  isSortable: boolean;
  isHidden: boolean | null;
  createdAt: string;
  updatedAt: string;
  sessionId: string;
  liveSessionId: string | null;
  customFieldValue: string | null;
  groupName: string | null;
  groupInternalOrder: number | null;
  individualOrder: number | null;
  settingRequest: string | null;
}

export interface InstituteCustomFieldResponse {
  id: string;
  field_id: string | null;
  institute_id: string;
  type: string;
  type_id: string;
  group_name: string | null;
  custom_field: CustomField;
  individual_order: number | null;
  group_internal_order: number | null;
  status: string;
}

export enum FieldRenderType {
  PHONE = "PHONE",
  EMAIL = "EMAIL",
  TEXT = "TEXT",
  DROPDOWN = "DROPDOWN",
  NUMBER = "NUMBER",
  URL = "URL",
  DATE = "DATE",
  TEXTAREA = "TEXTAREA",
  CHECKBOX = "CHECKBOX",
  RADIO = "RADIO",
  FILE = "FILE",
  MULTI_SELECT = "MULTI_SELECT",
}

/**
 * Determines the render type for a custom field based on its key and type.
 *
 * Prioritises the explicit `fieldType` coming from the API (settings) — if
 * the admin picked "date" in Settings we must render a date picker even if
 * the field name happens to contain "phone". Only when the field type is a
 * generic "text" do we fall back to keyword-based auto-detection (phone/
 * email) for backward compatibility with older fields.
 */
export const getFieldRenderType = (
  fieldKey: string,
  fieldType: string
): FieldRenderType => {
  const normalized = (fieldType || "").toLowerCase().trim();

  // Direct mapping from API field type to render type (takes priority)
  switch (normalized) {
    case "dropdown":
    case "select":
      return FieldRenderType.DROPDOWN;
    case "radio":
      return FieldRenderType.RADIO;
    case "number":
      return FieldRenderType.NUMBER;
    case "email":
      return FieldRenderType.EMAIL;
    case "url":
      return FieldRenderType.URL;
    case "phone":
    case "tel":
      return FieldRenderType.PHONE;
    case "date":
      return FieldRenderType.DATE;
    case "textarea":
      return FieldRenderType.TEXTAREA;
    case "checkbox":
      return FieldRenderType.CHECKBOX;
    case "file":
      return FieldRenderType.FILE;
    case "multi_select":
      return FieldRenderType.MULTI_SELECT;
  }

  // Fallback: auto-detect phone/email from field key for legacy generic-text fields
  const lowerKey = (fieldKey || "").toLowerCase();
  const phoneKeywords = ["phone", "mobile", "contact", "telephone", "cell"];
  if (phoneKeywords.some((keyword) => lowerKey.includes(keyword))) {
    return FieldRenderType.PHONE;
  }
  const emailKeywords = ["email", "e-mail", "mail"];
  if (emailKeywords.some((keyword) => lowerKey.includes(keyword))) {
    return FieldRenderType.EMAIL;
  }

  return FieldRenderType.TEXT;
};

/**
 * Full config shape stored in the custom_fields.config column as JSON.
 * - Legacy dropdown-only format: bare array [{id,value,label}]
 * - New object format: { options?, defaultValue?, allowedFileTypes?, maxSizeMB?, min?, max?, minDate?, maxDate? }
 */
export interface CustomFieldFullConfig {
  options?: Array<{ id: number; value: string; label: string }>;
  defaultValue?: string;
  allowedFileTypes?: string[];
  maxSizeMB?: number;
  min?: number;
  max?: number;
  minDate?: string;
  maxDate?: string;
  maxLength?: number;
}

// Sentinel value for the admin's "All Files" option — equivalent to no
// restriction at all, including formats outside the fixed category list
// (e.g. .sb3 PictoBlox/Scratch projects).
export const ALL_FILES_VALUE = "all";

export const isUnrestrictedFileTypes = (allowed?: string[] | null): boolean =>
  !allowed || allowed.length === 0 || allowed.includes(ALL_FILES_VALUE);

/**
 * Parse the full config JSON (handles both legacy array and new object format)
 */
export const parseFieldConfig = (config?: string | null): CustomFieldFullConfig | undefined => {
  if (!config) return undefined;
  try {
    const parsed = JSON.parse(config);
    if (Array.isArray(parsed)) {
      return { options: parsed };
    }
    if (parsed && typeof parsed === "object") {
      return parsed as CustomFieldFullConfig;
    }
  } catch {
    // ignore - may be a comma-separated fallback handled elsewhere
  }
  return undefined;
};

/**
 * Extract the default value from a field's config JSON (or top-level defaultValue)
 */
export const getFieldDefaultValue = (
  config?: string | null,
  topLevelDefault?: string | null
): string => {
  if (topLevelDefault) return topLevelDefault;
  const parsed = parseFieldConfig(config);
  return parsed?.defaultValue ?? "";
};

type DropdownOption = { _id: number; value: string; label: string };

/**
 * Admin writes two variants of the same option config: {id,value,label} and
 * {label,name}. Both mean the same thing, so collapse them to one shape here.
 * An option with no resolvable value is dropped — it would otherwise render as
 * a SelectItem that cannot be selected.
 */
const normaliseOptions = (
  raw: Array<{ id?: number; value?: string; name?: string; label?: string }>
): DropdownOption[] =>
  raw
    .map((option, index) => {
      const value = option.value ?? option.name;
      return {
        _id: option.id ?? index + 1,
        value: value as string,
        label: option.label ?? (value as string),
      };
    })
    .filter((option) => option.value !== undefined && option.value !== "");

/**
 * Parses dropdown options from config JSON string or comma-separated string
 * Expected formats:
 * - JSON array: "[{\"id\":1,\"value\":\"Option 1\",\"label\":\"Option 1\"},{\"id\":2,\"value\":\"Option 2\",\"label\":\"Option 2\"}]"
 * - JSON array: "[{\"label\":\"Option 1\",\"name\":\"Option 1\"}]"
 * - Comma-separated: "MALE,FEMALE,OTHER"
 */
export const parseDropdownOptions = (
  config: string
): DropdownOption[] => {
  try {
    // Return empty array for empty config
    if (!config || config === "{}") {
      console.warn("parseDropdownOptions: Empty or invalid config provided");
      return [];
    }

    const trimmedConfig = config.trim();

    // Check if config is a simple comma-separated string (not JSON)
    // If it doesn't start with '[' or '{', treat it as comma-separated
    if (!trimmedConfig.startsWith('[') && !trimmedConfig.startsWith('{')) {
      // It's a comma-separated string like "MALE,FEMALE,OTHER"
      return trimmedConfig.split(",").map((option, index) => ({
        _id: index + 1,
        value: option.trim(),
        label: option.trim(),
      }));
    }

    // Parse JSON string
    const parsed = JSON.parse(config);

    // Handle object case wrapping options
    if (!Array.isArray(parsed) && typeof parsed === "object" && parsed !== null) {
      // New object-format config: {options: [{id,value,label}], defaultValue, ...}
      if (Array.isArray(parsed.options)) {
        return normaliseOptions(parsed.options);
      }

      // Check for comma-separated wrapping (legacy) including the typo version seen in logs
      const optionsString = parsed.coommaSepartedOptions || parsed.commaSeparatedOptions;
      if (typeof optionsString === "string") {
        return optionsString.split(",").map((option: string, index: number) => ({
          _id: index + 1,
          value: option.trim(),
          label: option.trim(),
        }));
      }
    }

    // Ensure it's an array
    if (!Array.isArray(parsed)) {
      console.warn("parseDropdownOptions: Config is not an array", parsed);
      if (typeof parsed === "string") {
        return parsed.split(",").map((option, index) => ({
          _id: index + 1,
          value: option.trim(),
          label: option.trim(),
        }));
      }
      return [];
    }

    // Transform to match SelectField Options interface
    return normaliseOptions(parsed);
  } catch (error) {
    console.error("parseDropdownOptions: Error parsing config", {
      config,
      error,
    });
    // If JSON parsing fails, try treating it as comma-separated string
    try {
      const trimmedConfig = config.trim();
      if (trimmedConfig.includes(',')) {
        return trimmedConfig.split(",").map((option, index) => ({
          _id: index + 1,
          value: option.trim(),
          label: option.trim(),
        }));
      }
    } catch (fallbackError) {
      console.error("parseDropdownOptions: Fallback parsing also failed", fallbackError);
    }
    return [];
  }
};

export interface FormFieldValue {
  id: string;
  name: string;
  value: string;
  is_mandatory: boolean;
  type: string;
  render_type: FieldRenderType;
  config: string;
  comma_separated_options?: Array<{
    _id: number;
    value: string;
    label: string;
  }>;
}

/**
 * Transforms institute custom fields response to form values structure
 */
export const transformCustomFieldsToFormValues = (
  customFields: InstituteCustomFieldResponse[]
): Record<string, FormFieldValue> => {
  const formValues: Record<string, FormFieldValue> = {};

  customFields.forEach((field) => {
    const { custom_field } = field;
    const fieldKey = custom_field.fieldKey;

    const fieldType = (custom_field.fieldType || "text").toLowerCase();
    const initialValue =
      custom_field.customFieldValue ||
      getFieldDefaultValue(custom_field.config, custom_field.defaultValue);

    formValues[fieldKey] = {
      id: custom_field.id,
      name: custom_field.fieldName,
      value: initialValue,
      is_mandatory: custom_field.isMandatory ?? false,
      type: fieldType,
      render_type: getFieldRenderType(fieldKey, fieldType),
      config: custom_field.config,
      comma_separated_options:
        fieldType === "dropdown" || fieldType === "radio" || fieldType === "multi_select"
          ? parseDropdownOptions(custom_field.config)
          : undefined,
    };
  });

  return formValues;
};

/**
 * Validates if a field value is valid based on its render type
 */
export const validateFieldValue = (
  value: string,
  renderType: FieldRenderType
): { isValid: boolean; error?: string } => {
  if (!value || !value.trim()) {
    return { isValid: false, error: "This field is required" };
  }

  switch (renderType) {
    case FieldRenderType.EMAIL: {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        return { isValid: false, error: "Please enter a valid email address" };
      }
      break;
    }
    case FieldRenderType.PHONE: {
      const phoneRegex = /^[+]?[\d\s()-]{10,}$/;
      if (!phoneRegex.test(value)) {
        return {
          isValid: false,
          error: "Please enter a valid phone number",
        };
      }
      break;
    }
    case FieldRenderType.URL: {
      try {
        new URL(value);
      } catch {
        return { isValid: false, error: "Please enter a valid URL" };
      }
      break;
    }
    case FieldRenderType.NUMBER: {
      if (Number.isNaN(Number(value))) {
        return { isValid: false, error: "Please enter a valid number" };
      }
      break;
    }
    case FieldRenderType.DATE: {
      if (Number.isNaN(new Date(value).getTime())) {
        return { isValid: false, error: "Please enter a valid date" };
      }
      break;
    }
  }

  return { isValid: true };
};

/**
 * Sorts custom fields by their order (if available)
 */
export const sortCustomFields = (
  fields: InstituteCustomFieldResponse[]
): InstituteCustomFieldResponse[] => {
  return [...fields].sort((a, b) => {
    const orderA = a.individual_order ?? a.group_internal_order ?? 999;
    const orderB = b.individual_order ?? b.group_internal_order ?? 999;
    return orderA - orderB;
  });
};

/**
 * Gets the input type for HTML input element
 */
export const getInputType = (
  fieldType: string,
  renderType: FieldRenderType
): string => {
  if (renderType === FieldRenderType.EMAIL) return "email";
  if (renderType === FieldRenderType.URL) return "url";
  if (renderType === FieldRenderType.NUMBER || fieldType === "number") return "number";
  if (renderType === FieldRenderType.PHONE) return "tel";
  if (renderType === FieldRenderType.DATE) return "date";
  return "text";
};
