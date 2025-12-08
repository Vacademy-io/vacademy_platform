/**
 * Utility functions for handling custom fields in registration forms
 */

export interface CustomField {
  guestId: string | null;
  id: string;
  fieldKey: string;
  fieldName: string;
  fieldType: "text" | "number" | "dropdown";
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
}

/**
 * Determines the render type for a custom field based on its key and type
 */
export const getFieldRenderType = (
  fieldKey: string,
  fieldType: string
): FieldRenderType => {
  const lowerKey = fieldKey.toLowerCase();

  // Check for dropdown
  if (fieldType === "dropdown") {
    return FieldRenderType.DROPDOWN;
  }
  // Check for phone fields
  const phoneKeywords = ["phone", "mobile", "contact", "telephone", "cell"];
  if (phoneKeywords.some((keyword) => lowerKey.includes(keyword))) {
    return FieldRenderType.PHONE;
  }

  // Check for email fields
  const emailKeywords = ["email", "e-mail", "mail"];
  if (emailKeywords.some((keyword) => lowerKey.includes(keyword))) {
    return FieldRenderType.EMAIL;
  }

  // Default to text
  return FieldRenderType.TEXT;
};

/**
 * Parses dropdown options from config JSON string or comma-separated string
 * Expected formats:
 * - JSON array: "[{\"id\":1,\"value\":\"Option 1\",\"label\":\"Option 1\"},{\"id\":2,\"value\":\"Option 2\",\"label\":\"Option 2\"}]"
 * - Comma-separated: "MALE,FEMALE,OTHER"
 */
export const parseDropdownOptions = (
  config: string
): Array<{ _id: number; value: string; label: string }> => {
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
    // Maps: id → _id, keeps value and label
    const options = parsed.map((option) => ({
      _id: option.id,
      value: option.value,
      label: option.label,
    }));

    return options;
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

    formValues[fieldKey] = {
      id: custom_field.id,
      name: custom_field.fieldName,
      value: custom_field.customFieldValue || "",
      is_mandatory: custom_field.isMandatory ?? false,
      type: custom_field.fieldType,
      render_type: getFieldRenderType(fieldKey, custom_field.fieldType),
      config: custom_field.config,
      comma_separated_options:
        custom_field.fieldType === "dropdown"
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
      // Basic phone validation - can be adjusted based on requirements
      const phoneRegex = /^[+]?[\d\s()-]{10,}$/;
      if (!phoneRegex.test(value)) {
        return {
          isValid: false,
          error: "Please enter a valid phone number",
        };
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
  if (fieldType === "number") return "number";
  return "text";
};
