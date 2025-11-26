import {
  BASE_URL,
  ENROLL_OPEN_STUDENT_URL,
  ENROLL_USER_INVITE_PAYMENT_URL,
  GET_PAYMENT_GATEWAY_DETAILS_URL,
  PEYMENT_LOG_STATUS_URL,
} from "@/constants/urls";
import { isNullOrEmptyOrUndefined } from "@/lib/utils";
import axios from "axios";
import {
  FieldRenderType,
  getFieldRenderType,
} from "../-utils/custom-field-helpers";

export const getEnrollInviteData = async ({
  instituteId,
  inviteCode,
}: {
  instituteId: string;
  inviteCode: string;
}) => {
  const response = await axios({
    method: "GET",
    url: ENROLL_OPEN_STUDENT_URL,
    params: {
      instituteId,
      inviteCode,
    },
  });
  return response?.data;
};

export const handleGetEnrollInviteData = ({
  instituteId,
  inviteCode,
}: {
  instituteId: string;
  inviteCode: string;
}) => {
  return {
    queryKey: ["GET_ENROLL_INVITE_DETAILS", instituteId, inviteCode],
    queryFn: () => getEnrollInviteData({ instituteId, inviteCode }),
    staleTime: 60 * 60 * 1000,
  };
};

export const getKeyData = async (instituteId: string, vendor: string) => {
  const response = await axios({
    method: "GET",
    url: GET_PAYMENT_GATEWAY_DETAILS_URL,
    params: {
      instituteId,
      vendor,
    },
  });
  return response?.data;
};

export const handlePaymentGatewaykeys = (
  instituteId: string,
  vendor: string
) => {
  return {
    queryKey: ["GET_PAYMENT_GATEWAY_KEYS", instituteId, vendor],
    queryFn: () => getKeyData(instituteId, vendor),
    staleTime: 60 * 60 * 1000,
  };
};

export interface ReferRequest {
  referrer_user_id: string;
  referral_code: string;
  referral_option_id: string;
}

interface RegistrationFieldValue {
  id: string;
  name: string;
  value: string;
  is_mandatory: boolean;
  type: string;
  render_type?: FieldRenderType;
  comma_separated_options?: string[];
}

type RegistrationDataType = Record<string, RegistrationFieldValue>;

interface EnrollLearnerForPaymentProps {
  registrationData: RegistrationDataType;
  // eslint-disable-next-line
  enrollmentData: any;
  paymentMethodId?: string;
  instituteId: string;
  enrollInviteId: string;
  payment_option_id: string;
  package_session_ids: string[];
  allowLearnersToCreateCourses: boolean;
  referRequest: {
    referrer_user_id: string;
    referral_code: string;
    referral_option_id: string;
  } | null;
  returnUrl?: string;
  // Eway-specific payment data
  ewayPaymentData?: {
    encryptedNumber: string;
    encryptedCVN: string;
    cardData: {
      name: string;
      expiryMonth: string;
      expiryYear: string;
    };
  };
  // Razorpay-specific payment data
  razorpayPaymentData?: {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  };
  // Payment vendor (STRIPE, EWAY, or RAZORPAY)
  paymentVendor?: "STRIPE" | "EWAY" | "RAZORPAY";
  // Flag to indicate if using institute custom fields (don't exclude from custom_field_values)
  isUsingInstituteCustomFields?: boolean;
}

/**
 * Helper function to dynamically find email field from registration data
 * Searches by FieldRenderType.EMAIL instead of hardcoded key
 */
const getEmailField = (registrationData: RegistrationDataType): string => {
  const emailEntry = Object.entries(registrationData).find(([key, value]) => {
    const renderType =
      value.render_type || getFieldRenderType(key, value.type || "text");
    return renderType === FieldRenderType.EMAIL;
  });
  return emailEntry ? emailEntry[1].value : "";
};

/**
 * Helper function to dynamically find phone field from registration data
 * Searches by FieldRenderType.PHONE instead of hardcoded key
 */
const getPhoneField = (registrationData: RegistrationDataType): string => {
  const phoneEntry = Object.entries(registrationData).find(([key, value]) => {
    const renderType =
      value.render_type || getFieldRenderType(key, value.type || "text");
    return renderType === FieldRenderType.PHONE;
  });
  return phoneEntry ? phoneEntry[1].value : "";
};

/**
 * Helper function to dynamically find full name from registration data
 * Tries to find a single full_name field first, then combines first_name + last_name
 * Uses keyword matching instead of hardcoded keys
 */
const getFullNameField = (registrationData: RegistrationDataType): string => {
  // First, try to find a single full name field (e.g., "full_name", "Full Name")
  const fullNameEntry = Object.entries(registrationData).find(([key]) => {
    const lowerKey = key.toLowerCase();
    return (
      lowerKey.includes("full") &&
      (lowerKey.includes("name") || lowerKey.includes("_name"))
    );
  });

  if (fullNameEntry && !isNullOrEmptyOrUndefined(fullNameEntry[1].value)) {
    return fullNameEntry[1].value;
  }

  // Try to find a simple "name" field (common in institute custom fields)
  const nameEntry = Object.entries(registrationData).find(([key, value]) => {
    const lowerKey = key.toLowerCase();
    const lowerName = (value.name || "").toLowerCase();

    // Check both field key and field name for "name"
    const keyMatches =
      lowerKey === "name" ||
      lowerKey === "full_name" ||
      lowerKey === "fullname";

    const nameMatches =
      lowerName === "name" ||
      lowerName === "full name" ||
      lowerName.includes("name");

    // Exclude email, phone, username, first_name, last_name
    const shouldExclude =
      lowerKey.includes("email") ||
      lowerKey.includes("phone") ||
      lowerKey.includes("first") ||
      lowerKey.includes("last") ||
      lowerKey.includes("user") ||
      lowerName.includes("email") ||
      lowerName.includes("phone") ||
      lowerName.includes("first") ||
      lowerName.includes("last") ||
      lowerName.includes("user");

    return (keyMatches || nameMatches) && !shouldExclude;
  });

  if (nameEntry && !isNullOrEmptyOrUndefined(nameEntry[1].value)) {
    return nameEntry[1].value;
  }

  // If no full name field, try to combine first name + last name
  const firstNameEntry = Object.entries(registrationData).find(([key]) => {
    const lowerKey = key.toLowerCase();
    return lowerKey.includes("first") && lowerKey.includes("name");
  });

  const lastNameEntry = Object.entries(registrationData).find(([key]) => {
    const lowerKey = key.toLowerCase();
    return lowerKey.includes("last") && lowerKey.includes("name");
  });

  const firstName = firstNameEntry ? firstNameEntry[1].value || "" : "";
  const lastName = lastNameEntry ? lastNameEntry[1].value || "" : "";

  const combinedName = `${firstName} ${lastName}`.trim();

  return combinedName;
};

/**
 * Helper function to get keys that should be excluded from custom field values
 * Dynamically identifies email, phone, and name fields
 */
const getKeysToExclude = (registrationData: RegistrationDataType): string[] => {
  const keysToExclude: string[] = [];

  Object.entries(registrationData).forEach(([key, value]) => {
    const lowerKey = key.toLowerCase();
    const renderType =
      value.render_type || getFieldRenderType(key, value.type || "text");

    // Exclude email fields
    if (renderType === FieldRenderType.EMAIL) {
      keysToExclude.push(key);
    }

    // Exclude phone fields
    if (renderType === FieldRenderType.PHONE) {
      keysToExclude.push(key);
    }

    // Exclude name-related fields
    if (
      (lowerKey.includes("name") &&
        (lowerKey.includes("full") ||
          lowerKey.includes("first") ||
          lowerKey.includes("last"))) ||
      lowerKey === "name"
    ) {
      keysToExclude.push(key);
    }
  });

  return keysToExclude;
};

export const handleEnrollLearnerForPayment = async ({
  registrationData,
  enrollmentData,
  paymentMethodId,
  instituteId,
  enrollInviteId,
  payment_option_id,
  package_session_ids,
  allowLearnersToCreateCourses,
  referRequest,
  returnUrl,
  ewayPaymentData,
  razorpayPaymentData,
  paymentVendor = "STRIPE",
  isUsingInstituteCustomFields = false,
}: EnrollLearnerForPaymentProps) => {
  // Dynamically extract email, phone, and full name using helper functions
  const email = getEmailField(registrationData);
  const phoneNumber = getPhoneField(registrationData);
  const fullName = getFullNameField(registrationData);

  // Dynamically identify keys to exclude from custom field values
  // If using institute custom fields, don't exclude name, email, phone
  const keysToExclude = isUsingInstituteCustomFields
    ? []
    : getKeysToExclude(registrationData);
  // Prepare payment request based on vendor
  const stripe_request =
    paymentVendor === "STRIPE"
      ? {
          payment_method_id: paymentMethodId,
          card_last4: null,
          customer_id: null,
          return_url: returnUrl || "",
        }
      : {};

  const eway_request =
    paymentVendor === "EWAY" && ewayPaymentData
      ? {
          customer_id: null,
          card_name: ewayPaymentData.cardData.name,
          expiry_month: ewayPaymentData.cardData.expiryMonth,
          expiry_year: ewayPaymentData.cardData.expiryYear,
          card_number: ewayPaymentData.encryptedNumber, // Already has "eCrypted:" prefix
          cvn: ewayPaymentData.encryptedCVN, // Already has "eCrypted:" prefix
          country_code: "au",
        }
      : {};

  // For Razorpay: First call sends empty request to create order,
  // Second call (after payment) includes payment_id, order_id, signature
  const razorpay_request =
    paymentVendor === "RAZORPAY"
      ? razorpayPaymentData
        ? {
            customer_id: null,
            contact: phoneNumber,
            email: email,
            razorpay_payment_id: razorpayPaymentData.razorpay_payment_id,
            razorpay_order_id: razorpayPaymentData.razorpay_order_id,
            razorpay_signature: razorpayPaymentData.razorpay_signature,
          }
        : {
            customer_id: null,
            contact: phoneNumber,
            email: email,
          }
      : {};

  const convertedData = {
    user: {
      email: email,
      full_name: fullName,
      address_line: "",
      city: "",
      region: "",
      pin_code: "",
      mobile_number: phoneNumber,
      date_of_birth: "",
      gender: "",
      password: "",
      profile_pic_file_id: "",
      roles: allowLearnersToCreateCourses
        ? ["STUDENT", "TEACHER"]
        : ["STUDENT"],
      root_user: true,
    },
    institute_id: instituteId,
    subject_id: "",
    vendor_id: paymentVendor,
    learner_package_session_enroll: {
      package_session_ids: package_session_ids,
      plan_id: enrollmentData.selectedPayment.id,
      payment_option_id: payment_option_id,
      enroll_invite_id: enrollInviteId,
      refer_request: referRequest,
      payment_initiation_request: {
        vendor: paymentVendor,
        amount: enrollmentData.selectedPayment.amount,
        currency:
          paymentVendor === "EWAY"
            ? "aud"
            : enrollmentData.selectedPayment.currency,
        description: "",
        charge_automatically: true,
        institute_id: instituteId,
        stripe_request,
        razorpay_request,
        pay_pal_request: {},
        eway_request,
        include_pending_items: true,
      },
      custom_field_values: Object.entries(registrationData)
        .filter(([key]) => !keysToExclude.includes(key))
        .map(([, field]) => ({
          custom_field_id: field.id,
          source_type: null,
          source_id: null,
          type: "ENROLL_INVITE",
          type_id: enrollInviteId,
          value: field.value,
        })),
    },
  };

  const response = await axios({
    method: "POST",
    url: ENROLL_USER_INVITE_PAYMENT_URL,
    data: convertedData,
  });
  return response?.data;
};

export const getPaymentCompletionStatus = async ({
  paymentLogId,
}: {
  paymentLogId: string;
}) => {
  const response = await axios({
    method: "GET",
    url: PEYMENT_LOG_STATUS_URL,
    params: {
      paymentLogId,
    },
  });
  return response?.data;
};

export const handleGetPaymentCompletionStatus = ({
  paymentLogId,
}: {
  paymentLogId: string;
}) => {
  return {
    queryKey: ["GET_PAYMENT_COMPLETION_STATUS", paymentLogId],
    queryFn: () => getPaymentCompletionStatus({ paymentLogId }),
    staleTime: 60 * 60 * 1000,
  };
};

export const getPublicInstituteDetails = async ({
  instituteId,
}: {
  instituteId: string;
}) => {
  const response = await axios({
    method: "GET",
    url: `${BASE_URL}/admin-core-service/public/institute/v1/details/${instituteId}`,
  });
  return response?.data;
};

export const handleGetPublicInstituteDetails = ({
  instituteId,
}: {
  instituteId: string;
}) => {
  return {
    queryKey: ["GET_PUBLIC_INSTITUTE_DETAILS", instituteId],
    queryFn: () => getPublicInstituteDetails({ instituteId }),
    staleTime: 60 * 60 * 1000,
    enabled: !!instituteId,
  };
};
