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

export const transformToCollectPublicUserDataDTO = (
  formValues: RegistrationFormValues,
  sessionId: string,
  customFields: CustomField[]
): CollectPublicUserDataDTO => {
  const dto: CollectPublicUserDataDTO = {
    user_dto: {
      full_name: formValues.full_name as string,
      email: formValues.email as string,
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
    source: null,
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
