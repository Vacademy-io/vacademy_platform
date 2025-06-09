import { CustomField, RegistrationFormValues } from "../-types/type";

export interface GuestRegistrationRequestDTO {
  session_id: string;
  email: string;
  custom_fields: {
    customFieldId: string;
    value: string;
  }[];
}

export const transformToGuestRegistrationDTO = (
  formValues: RegistrationFormValues,
  sessionId: string,
  customFields: CustomField[]
): GuestRegistrationRequestDTO => {
  const dto: GuestRegistrationRequestDTO = {
    session_id: sessionId,
    email: formValues.email as string,
    custom_fields: [],
  };
  console.log("formValues ", formValues);
  console.log("customFileds ", customFields);

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
