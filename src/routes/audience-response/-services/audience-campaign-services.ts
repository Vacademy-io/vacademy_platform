import { GET_AUDIENCE_CAMPAIGN, SUBMIT_AUDIENCE_LEAD } from "@/constants/urls";
import axios from "axios";
import { isNullOrEmptyOrUndefined } from "@/lib/utils";

export interface AudienceCampaignResponse {
  id: string;
  institute_id: string;
  campaign_name: string;
  campaign_type: string;
  description: string;
  campaign_objective: string;
  start_date_local: string;
  end_date_local: string;
  status: string;
  json_web_metadata: string;
  to_notify: string;
  send_respondent_email: boolean;
  created_by_user_id: string;
  institute_custom_fields: InstituteCustomField[];
}

export interface InstituteCustomField {
  id: string;
  field_id: string;
  institute_id: string;
  type: string;
  type_id: string;
  group_name: string;
  custom_field: CustomField;
  individual_order: number;
  group_internal_order: number;
  status: string;
}

export interface CustomField {
  guestId: string;
  id: string;
  fieldKey: string;
  fieldName: string;
  fieldType: string;
  defaultValue: string;
  config: string;
  formOrder: number;
  isMandatory: boolean;
  isFilter: boolean;
  isSortable: boolean;
  isHidden: boolean;
  createdAt: string;
  updatedAt: string;
  sessionId: string;
  liveSessionId: string;
  customFieldValue: string;
  groupName: string;
  groupInternalOrder: number;
  individualOrder: number;
  settingRequest?: any;
}

export const getAudienceCampaign = async ({
  instituteId,
  audienceId,
}: {
  instituteId: string;
  audienceId: string;
}): Promise<AudienceCampaignResponse> => {
  const response = await axios({
    method: "GET",
    url: `${GET_AUDIENCE_CAMPAIGN}/${instituteId}/${audienceId}`,
  });
  return response?.data;
};

export const handleGetAudienceCampaign = ({
  instituteId,
  audienceId,
}: {
  instituteId: string;
  audienceId: string;
}) => {
  return {
    queryKey: ["GET_AUDIENCE_CAMPAIGN", instituteId, audienceId],
    queryFn: () => getAudienceCampaign({ instituteId, audienceId }),
    staleTime: 60 * 60 * 1000,
    enabled: !!instituteId && !!audienceId,
  };
};

// Helper function to extract email from form values
const getEmailFromFormValues = (
  formValues: Record<string, { value: string; [key: string]: any }>
): string => {
  const emailEntry = Object.entries(formValues).find(([key]) => {
    const lowerKey = key.toLowerCase();
    return (
      lowerKey.includes("email") ||
      lowerKey.includes("mail") ||
      lowerKey.includes("mailid")
    );
  });
  return emailEntry ? emailEntry[1].value || "" : "";
};

// Helper function to extract phone from form values
const getPhoneFromFormValues = (
  formValues: Record<string, { value: string; [key: string]: any }>
): string => {
  const phoneEntry = Object.entries(formValues).find(([key]) => {
    const lowerKey = key.toLowerCase();
    return (
      lowerKey.includes("phone") ||
      lowerKey.includes("mobile") ||
      lowerKey.includes("contact") ||
      lowerKey.includes("tel")
    );
  });
  return phoneEntry ? phoneEntry[1].value || "" : "";
};

// Helper function to extract full name from form values
const getFullNameFromFormValues = (
  formValues: Record<string, { value: string; [key: string]: any }>
): string => {
  // First, try to find a single full name field
  const fullNameEntry = Object.entries(formValues).find(([key]) => {
    const lowerKey = key.toLowerCase();
    return (
      lowerKey.includes("full") &&
      (lowerKey.includes("name") || lowerKey.includes("_name"))
    );
  });

  if (fullNameEntry && !isNullOrEmptyOrUndefined(fullNameEntry[1].value)) {
    return fullNameEntry[1].value;
  }

  // If no full name field, try to combine first name + last name
  const firstNameEntry = Object.entries(formValues).find(([key]) => {
    const lowerKey = key.toLowerCase();
    return lowerKey.includes("first") && lowerKey.includes("name");
  });

  const lastNameEntry = Object.entries(formValues).find(([key]) => {
    const lowerKey = key.toLowerCase();
    return lowerKey.includes("last") && lowerKey.includes("name");
  });

  const firstName = firstNameEntry ? firstNameEntry[1].value || "" : "";
  const lastName = lastNameEntry ? lastNameEntry[1].value || "" : "";

  return `${firstName} ${lastName}`.trim();
};


export interface SubmitAudienceLeadRequest {
  audience_id: string;
  source_type: string;
  source_id: string;
  custom_field_values: Record<string, string>;
  user_dto: {
    id: string;
    username: string;
    email: string;
    full_name: string;
    address_line: string;
    city: string;
    region: string;
    pin_code: string;
    mobile_number: string;
    date_of_birth: string | null;
    gender: string;
    password: string;
    profile_pic_file_id: string;
    roles: string[];
    last_login_time: string | null;
    root_user: boolean;
  };
}

export interface SubmitAudienceLeadResponse {
  // Response type - adjust based on actual API response
  [key: string]: any;
}

export const submitAudienceLead = async (
  payload: SubmitAudienceLeadRequest
): Promise<SubmitAudienceLeadResponse> => {
  const response = await axios({
    method: "POST",
    url: SUBMIT_AUDIENCE_LEAD,
    data: payload,
    headers: {
      "Content-Type": "application/json",
    },
  });
  return response?.data;
};

export interface CustomFieldOrder {
  id: string;
  field_key: string;
}

export const handleSubmitAudienceLead = (
  formValues: Record<string, { value: string; id: string; [key: string]: any }>,
  audienceId: string,
  campaignId: string,
  customFieldsOrder: CustomFieldOrder[] = []
): SubmitAudienceLeadRequest => {
  // Extract user data from form values for user_dto
  const email = getEmailFromFormValues(formValues);
  const phoneNumber = getPhoneFromFormValues(formValues);
  const fullName = getFullNameFromFormValues(formValues);

  // Build custom_field_values object using unique field IDs from custom_field.id
  // Iterate in the same order as received from GET API to maintain order
  // JavaScript objects maintain insertion order (ES2015+), so the order will be preserved
  const customFieldValues: Record<string, string> = {};
  
  if (customFieldsOrder.length > 0) {
    // Use the ordered array to maintain the exact order from GET API response
    // This ensures custom_field_values in POST payload matches the order from GET API
    customFieldsOrder.forEach((field) => {
      const formValue = formValues[field.field_key];
      if (formValue && formValue.id && formValue.value !== undefined && formValue.value !== null && formValue.value !== "") {
        // Use custom_field.id as the key to maintain the unique identifier
        customFieldValues[formValue.id] = String(formValue.value);
      }
    });
  } else {
    // Fallback: if no order array provided, iterate over formValues (may not preserve order)
    Object.entries(formValues).forEach(([, field]) => {
      if (field.id && field.value !== undefined && field.value !== null && field.value !== "") {
        customFieldValues[field.id] = String(field.value);
      }
    });
  }

  // Build user_dto - only username and email are required, others can be empty
  const userDto = {
    id: "",
    username: email || fullName || "", // Use email as username, fallback to full name
    email: email || "",
    full_name: fullName || "",
    address_line: "",
    city: "",
    region: "",
    pin_code: "",
    mobile_number: phoneNumber || "",
    date_of_birth: null as string | null,
    gender: "",
    password: "",
    profile_pic_file_id: "",
    roles: [] as string[],
    last_login_time: null as string | null,
    root_user: false,
  };

  // Build the payload
  const payload: SubmitAudienceLeadRequest = {
    audience_id: audienceId,
    source_type: "AUDIENCE_CAMPAIGN",
    source_id: campaignId,
    custom_field_values: customFieldValues, // All custom fields with their unique IDs
    user_dto: userDto, // Only username and email (and other standard fields)
  };

  return payload;
};

