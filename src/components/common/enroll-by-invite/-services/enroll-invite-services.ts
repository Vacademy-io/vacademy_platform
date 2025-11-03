import {
  BASE_URL,
  ENROLL_OPEN_STUDENT_URL,
  ENROLL_USER_INVITE_PAYMENT_URL,
  GET_PAYMENT_GATEWAY_DETAILS_URL,
  PEYMENT_LOG_STATUS_URL,
} from "@/constants/urls";
import { isNullOrEmptyOrUndefined } from "@/lib/utils";
import axios from "axios";

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

interface EnrollLearnerForPaymentProps {
  registrationData: Record<
    string,
    {
      id: string;
      name: string;
      value: string;
      is_mandatory: boolean;
      type: string;
      comma_separated_options?: string[];
    }
  >;
  // eslint-disable-next-line
  enrollmentData: any;
  paymentMethodId?: string;
  instituteId: string;
  enrollInviteId: string;
  payment_option_id: string;
  package_session_id: string;
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
  // Payment vendor (STRIPE or EWAY)
  paymentVendor?: "STRIPE" | "EWAY";
}

export const handleEnrollLearnerForPayment = async ({
  registrationData,
  enrollmentData,
  paymentMethodId,
  instituteId,
  enrollInviteId,
  payment_option_id,
  package_session_id,
  allowLearnersToCreateCourses,
  referRequest,
  returnUrl,
  ewayPaymentData,
  paymentVendor = "STRIPE",
}: EnrollLearnerForPaymentProps) => {
  const keysToExclude = ["email", "full_name", "phone_number"];
  let fullName = "";
  let phoneNumber = "";
  fullName = isNullOrEmptyOrUndefined(registrationData.full_name?.value)
    ? `${registrationData.first_name?.value || ""} ${
        registrationData.last_name?.value || ""
      }`.trim()
    : registrationData.full_name.value;

  phoneNumber = isNullOrEmptyOrUndefined(registrationData.phone_number?.value)
    ? registrationData.phone?.value || ""
    : registrationData.phone_number.value;

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

  const convertedData = {
    user: {
      email: registrationData.email.value,
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
      package_session_ids: [package_session_id],
      plan_id: enrollmentData.selectedPayment.id,
      payment_option_id: payment_option_id,
      enroll_invite_id: enrollInviteId,
      refer_request: referRequest,
      payment_initiation_request: {
        amount: enrollmentData.selectedPayment.amount,
        currency:
          paymentVendor === "EWAY"
            ? "aud"
            : enrollmentData.selectedPayment.currency,
        description: "",
        charge_automatically: true,
        institute_id: instituteId,
        stripe_request,
        razorpay_request: {},
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
