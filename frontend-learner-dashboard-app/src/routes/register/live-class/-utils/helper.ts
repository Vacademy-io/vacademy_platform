import { CustomField, RegistrationFormValues } from "../-types/type";
export interface GuestRegistrationRequestDTO {
  session_id: string;
  email: string;
  custom_fields: {
    customFieldId: string;
    value: string;
  }[];
}
export interface PublicUser {
  username?: string;
  email: string;
  full_name: string;
  address_line?: string;
  city?: string;
  region?: string;
  pin_code?: string;
  mobile_number?: string;
  date_of_birth?: string;
  gender?: string;
  password?: string;
  profile_pic_file_id?: string;
}

export interface CollectPublicUserDataDTO {
  user_dto: PublicUser;
  package_session_id: string | null;
  type: string;
  type_id: string;
  source: string | null;
  custom_field_values: {
    custom_field_id: string;
    type: string | null;
    type_id: string | null;
    source_type: string | null;
    source_id: string | null;
    value: string;
  }[];
}

export const transformToGuestRegistrationDTO = (
  formValues: RegistrationFormValues,
  sessionId: string,
  customFields: CustomField[]
): GuestRegistrationRequestDTO => {
  // Extract email: try top-level formValues.email first, then look in custom fields
  let email = formValues.email as string | undefined;
  if (!email || email === "undefined") {
    // Find the email from custom fields (fieldKey contains "email" or fieldType is email-like)
    const emailField = customFields.find(
      (f) =>
        f.fieldKey === "email" ||
        f.fieldKey === "email_address" ||
        f.fieldName.toLowerCase() === "email"
    );
    if (emailField) {
      const emailValue = formValues[emailField.fieldKey];
      if (emailValue) {
        email = String(emailValue);
      }
    }
  }

  const dto: GuestRegistrationRequestDTO = {
    session_id: sessionId,
    email: email || "",
    custom_fields: [],
  };

  for (const field of customFields) {
    const value = formValues[field.fieldKey];

    // Only include value if present (especially if not mandatory)
    if (value !== undefined && value !== null) {
      dto.custom_fields.push({
        customFieldId: field.id,
        value: String(value),
      });
    }
  }

  return dto;
};

const extractFieldValue = (
  formValues: RegistrationFormValues,
  customFields: CustomField[],
  ...keys: string[]
): string | undefined => {
  // Try direct form value first
  for (const key of keys) {
    const val = formValues[key];
    if (val && String(val) !== "undefined") return String(val);
  }
  // Fallback: search custom fields by key or name
  for (const key of keys) {
    const field = customFields.find(
      (f) => f.fieldKey === key || f.fieldName.toLowerCase() === key
    );
    if (field) {
      const val = formValues[field.fieldKey];
      if (val && String(val) !== "undefined") return String(val);
    }
  }
  return undefined;
};

export const transformToCollectPublicUserDataDTO = (
  formValues: RegistrationFormValues,
  sessionId: string,
  customFields: CustomField[]
): CollectPublicUserDataDTO => {
  const email =
    extractFieldValue(formValues, customFields, "email", "email_address") || "";
  const fullName =
    extractFieldValue(formValues, customFields, "full_name", "name") || "";

  const dto: CollectPublicUserDataDTO = {
    user_dto: {
      full_name: fullName,
      email: email,
      username: formValues.username as string,
      mobile_number: formValues.mobile_number as string | undefined,
      address_line: formValues.address_line as string | undefined,
      city: formValues.city as string | undefined,
      region: formValues.state as string | undefined,
      pin_code: formValues.pin_code as string | undefined,
      date_of_birth: formValues.date_of_birth as string | undefined,
    },
    package_session_id: null,
    type: "PUBLIC_LIVE_SESSION",
    type_id: sessionId,
    source: "LEAD",
    custom_field_values: [],
  };
  for (const field of customFields) {
    const value = formValues[field.fieldKey];

    // Only include value if present
    if (value !== undefined && value !== null) {
      dto.custom_field_values.push({
        custom_field_id: field.id,
        type: "SESSION",
        type_id: sessionId,
        source_type: null,
        source_id: null,
        value: String(value),
      });
    }
  }
  return dto;
};
