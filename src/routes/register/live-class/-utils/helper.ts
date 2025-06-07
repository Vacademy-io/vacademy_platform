import { CustomField } from "../-types/type";

export interface GuestRegistrationRequestDTO {
  sessionId: string;
  email: string;
  customFields: {
    customFieldId: string;
    value: string;
  }[];
}

export const transformToGuestRegistrationDTO = (
  formValues: Record<string, any>,
  sessionId: string,
  customFields: CustomField[]
): GuestRegistrationRequestDTO => {
  const dto: GuestRegistrationRequestDTO = {
    sessionId,
    email: formValues.email,
    customFields: [],
  };
  console.log("formValues ", formValues);
  console.log("customFileds " , customFields);

  for (const field of customFields) {
    const value = formValues[field.fieldKey];

    // Only include value if present (especially if not mandatory)
    if (value !== undefined && value !== null) {
      dto.customFields.push({
        customFieldId: field.id, // assuming the ID is string UUID, change to number if needed
        value: String(value),
      });
    }
  }

  return dto;
};
