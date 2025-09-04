import axios from "axios";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { getUserId } from "@/utils/study-library/get-list-from-stores/getPackageSessionId";
import { 
  ENROLLMENT_PAYMENT_GATEWAY_DETAILS, 
  ENROLLMENT_INVITE_DETAILS, 
  ENROLLMENT_PAYMENT_INITIATION 
} from "@/constants/urls";

// TypeScript declarations for Stripe
declare global {
  interface Window {
    Stripe?: (publishableKey: string) => any;
  }
}

// Helper function to validate and sanitize email
export const validateAndSanitizeEmail = (email: string): string => {
  const sanitizedEmail = email.trim().toLowerCase();
  
  // Comprehensive email regex that excludes special characters like ^, &, etc.
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  
  if (!emailRegex.test(sanitizedEmail)) {
    throw new Error('Invalid email format. Please enter a valid email address without special characters.');
  }
  
  return sanitizedEmail;
};

// Types for the enrollment API response
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
  createdAt: string;
  updatedAt: string;
  sessionId: string;
  liveSessionId: string;
  customFieldValue: string;
}

export interface InstituteCustomField {
  id: string;
  institute_id: string;
  type: string;
  type_id: string;
  custom_field: CustomField;
}

export interface ReferralOption {
  id: string;
  name: string;
  status: string;
  source: string;
  source_id: string;
  referrer_discount_json: string;
  referee_discount_json: string;
  referrer_vesting_days: number;
  tag: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface PaymentPlan {
  id: string;
  name: string;
  status: string;
  validity_in_days: number;
  actual_price: number;
  elevated_price: number;
  currency: string;
  description: string;
  tag: string;
  feature_json: string;
  referral_option?: ReferralOption;
}

export interface PaymentOption {
  id: string;
  name: string;
  status: string;
  source: string;
  source_id: string;
  tag: string;
  type: string;
  require_approval: boolean;
  payment_plans: PaymentPlan[];
  payment_option_metadata_json: string;
}

export interface PackageSessionToPaymentOption {
  package_session_id: string;
  id: string;
  payment_option: PaymentOption;
}

export interface EnrollmentResponse {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  invite_code: string;
  status: string;
  institute_id: string;
  vendor: string;
  vendor_id: string;
  currency: string;
  tag: string;
  learner_access_days: number;
  web_page_meta_data_json: string;
  institute_custom_fields: InstituteCustomField[];
  package_session_to_payment_options: PackageSessionToPaymentOption[];
}

export interface PaymentGatewayDetails {
  id: string;
  institute_id: string;
  vendor: string;
  vendor_id: string;
  status: string;
  config_json: string;
  created_at: string;
  updated_at: string;
  publishableKey?: string;
}

/**
 * Fetch payment gateway details for an institute
 * @param instituteId - The institute ID
 * @param vendor - The payment vendor (e.g., 'STRIPE')
 * @returns Promise<PaymentGatewayDetails>
 */
export const fetchPaymentGatewayDetails = async (
  instituteId: string,
  vendor: string = 'STRIPE',
  token: string
): Promise<PaymentGatewayDetails> => {
  try {
    const response = await axios.get(
      ENROLLMENT_PAYMENT_GATEWAY_DETAILS,
      {
        params: {
          instituteId,
          vendor
        },
        headers: {
          'Authorization': `Bearer ${token}`,
          'accept': 'application/json, text/plain, */*',
          'Content-Type': 'application/json'
        }
      }
    );
    
    return response.data;
  } catch (error) {
    throw new Error('Failed to fetch payment gateway details');
  }
};

/**
 * Fetch enrollment details with payment options
 * @param inviteCode - The invite code for the enrollment
 * @param instituteId - The institute ID
 * @param packageSessionId - The package session ID
 * @param token - Authorization token
 * @returns Promise with enrollment response including payment options
 */
export const fetchEnrollmentDetails = async (
  inviteCode: string,
  instituteId: string,
  packageSessionId: string,
  token: string
): Promise<EnrollmentResponse> => {
  try {
    const response = await axios.get<EnrollmentResponse>(
      `${ENROLLMENT_INVITE_DETAILS}/${inviteCode}/${instituteId}/${packageSessionId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      }
    );
    return response.data;
  } catch (error) {
    throw error;
  }
};

/**
 * Get available payment options from enrollment response
 * @param enrollmentData - The enrollment response data
 * @returns Array of payment options
 */
export const getPaymentOptions = (enrollmentData: EnrollmentResponse): PaymentOption[] => {
  return enrollmentData.package_session_to_payment_options.map(
    (item) => item.payment_option
  );
};

/**
 * Get payment plans for a specific payment option
 * @param paymentOption - The payment option
 * @returns Array of payment plans
 */
export const getPaymentPlans = (paymentOption: PaymentOption): PaymentPlan[] => {
  return paymentOption.payment_plans.filter(plan => plan.status === "ACTIVE");
};

/**
 * Format currency amount with enhanced support for multiple currencies
 * @param amount - The amount to format
 * @param currency - The currency code
 * @returns Formatted currency string
 */
export const formatCurrency = (amount: number, currency: string = "USD"): string => {
  // Currency symbols mapping for better display
  const currencySymbols: { [key: string]: string } = {
    USD: "$",      // US Dollar
    CAD: "C$",     // Canadian Dollar
    AUD: "A$",     // Australian Dollar
    GBP: "£",      // British Pound
    EUR: "€",      // Euro
    INR: "₹",      // Indian Rupee
    JPY: "¥",      // Japanese Yen
    CNY: "¥",      // Chinese Yuan
    KRW: "₩",      // Korean Won
    BRL: "R$",     // Brazilian Real
    MXN: "$",      // Mexican Peso
    RUB: "₽",      // Russian Ruble
    ZAR: "R",      // South African Rand
    SEK: "kr",     // Swedish Krona
    NOK: "kr",     // Norwegian Krone
    DKK: "kr",     // Danish Krone
    CHF: "CHF",    // Swiss Franc
    PLN: "zł",     // Polish Złoty
    CZK: "Kč",     // Czech Koruna
    HUF: "Ft",     // Hungarian Forint
    RON: "lei",    // Romanian Leu
    BGN: "лв",     // Bulgarian Lev
    HRK: "kn",     // Croatian Kuna
    TRY: "₺",      // Turkish Lira
    ILS: "₪",      // Israeli Shekel
    AED: "د.إ",    // UAE Dirham
    SAR: "ر.س",    // Saudi Riyal
    QAR: "ر.ق",    // Qatari Riyal
    KWD: "د.ك",    // Kuwaiti Dinar
    BHD: "د.ب",    // Bahraini Dinar
    OMR: "ر.ع.",   // Omani Rial
    JOD: "د.أ",    // Jordanian Dinar
    LBP: "ل.ل",    // Lebanese Pound
    EGP: "ج.م",    // Egyptian Pound
    MAD: "د.م.",   // Moroccan Dirham
    TND: "د.ت",    // Tunisian Dinar
    DZD: "د.ج",    // Algerian Dinar
    LYD: "ل.د",    // Libyan Dinar
    SDG: "ج.س.",   // Sudanese Pound
    IQD: "ع.د",    // Iraqi Dinar
    SYP: "ل.س",    // Syrian Pound
    YER: "ر.ي",    // Yemeni Rial
    AFN: "؋",      // Afghan Afghani
    PKR: "₨",      // Pakistani Rupee
    BDT: "৳",      // Bangladeshi Taka
    LKR: "රු",     // Sri Lankan Rupee
    NPR: "रू",     // Nepalese Rupee
    MMK: "K",      // Myanmar Kyat
    THB: "฿",      // Thai Baht
    VND: "₫",      // Vietnamese Dong
    IDR: "Rp",     // Indonesian Rupiah
    MYR: "RM",     // Malaysian Ringgit
    SGD: "S$",     // Singapore Dollar
    PHP: "₱",      // Philippine Peso
    NZD: "NZ$",    // New Zealand Dollar
    HKD: "HK$",    // Hong Kong Dollar
    TWD: "NT$",    // Taiwan Dollar
    CLP: "$",      // Chilean Peso
    COP: "$",      // Colombian Peso
    PEN: "S/",     // Peruvian Sol
    ARS: "$",      // Argentine Peso
    UYU: "$",      // Uruguayan Peso
    PYG: "₲",      // Paraguayan Guaraní
    BOB: "Bs",     // Bolivian Boliviano
    VES: "Bs",     // Venezuelan Bolívar
    GTQ: "Q",      // Guatemalan Quetzal
    HNL: "L",      // Honduran Lempira
    NIO: "C$",     // Nicaraguan Córdoba
    CRC: "₡",      // Costa Rican Colón
    PAB: "B/.",    // Panamanian Balboa
    DOP: "RD$",    // Dominican Peso
    HTG: "G",      // Haitian Gourde
    JMD: "J$",     // Jamaican Dollar
    TTD: "TT$",    // Trinidad and Tobago Dollar
    BBD: "Bds$",   // Barbadian Dollar
    XCD: "EC$",    // East Caribbean Dollar
    BZD: "BZ$",    // Belize Dollar
    GYD: "G$",     // Guyanese Dollar
    SRD: "SRD",    // Surinamese Dollar
    GHS: "GH₵",    // Ghanaian Cedi
    NGN: "₦",      // Nigerian Naira
    KES: "KSh",    // Kenyan Shilling
    UGX: "USh",    // Ugandan Shilling
    TZS: "TSh",    // Tanzanian Shilling
    MWK: "MK",     // Malawian Kwacha
    ZMW: "ZK",     // Zambian Kwacha
    BWP: "P",      // Botswana Pula
    NAD: "N$",     // Namibian Dollar
    SZL: "E",      // Swazi Lilangeni
    LSL: "L",      // Lesotho Loti
    MUR: "₨",      // Mauritian Rupee
    SCR: "₨",      // Seychellois Rupee
    KMF: "CF",     // Comorian Franc
    DJF: "Fdj",    // Djiboutian Franc
    ETB: "Br",     // Ethiopian Birr
    ERN: "Nfk",    // Eritrean Nakfa
    SOS: "S",      // Somali Shilling
    KHR: "៛",      // Cambodian Riel
    LAK: "₭",      // Lao Kip
    MNT: "₮",      // Mongolian Tögrög
    KZT: "₸",      // Kazakhstani Tenge
    UZS: "so'm",   // Uzbekistani Som
    TJS: "ЅМ",     // Tajikistani Somoni
    TMT: "T",      // Turkmenistani Manat
    AZN: "₼",      // Azerbaijani Manat
    GEL: "₾",      // Georgian Lari
    AMD: "֏",      // Armenian Dram
    ALL: "L",      // Albanian Lek
    MKD: "ден",    // Macedonian Denar
    RSD: "дин",    // Serbian Dinar
    BAM: "KM",     // Bosnia and Herzegovina Convertible Mark
    MDL: "L",      // Moldovan Leu
    UAH: "₴",      // Ukrainian Hryvnia
    BYN: "Br",     // Belarusian Ruble
    KGS: "с",      // Kyrgyzstani Som
  };

  // Handle common currency codes and their locales
  const currencyConfig: { [key: string]: { locale: string; currency: string } } = {
    USD: { locale: "en-US", currency: "USD" },
    EUR: { locale: "de-DE", currency: "EUR" },
    GBP: { locale: "en-GB", currency: "GBP" },
    INR: { locale: "en-IN", currency: "INR" },
    CAD: { locale: "en-CA", currency: "CAD" },
    AUD: { locale: "en-AU", currency: "AUD" },
    JPY: { locale: "ja-JP", currency: "JPY" },
    CNY: { locale: "zh-CN", currency: "CNY" },
    KRW: { locale: "ko-KR", currency: "KRW" },
    BRL: { locale: "pt-BR", currency: "BRL" },
    MXN: { locale: "es-MX", currency: "MXN" },
    RUB: { locale: "ru-RU", currency: "RUB" },
    ZAR: { locale: "en-ZA", currency: "ZAR" },
    SEK: { locale: "sv-SE", currency: "SEK" },
    NOK: { locale: "nb-NO", currency: "NOK" },
    DKK: { locale: "da-DK", currency: "DKK" },
    CHF: { locale: "de-CH", currency: "CHF" },
    PLN: { locale: "pl-PL", currency: "PLN" },
    CZK: { locale: "cs-CZ", currency: "CZK" },
    HUF: { locale: "hu-HU", currency: "HUF" },
    RON: { locale: "ro-RO", currency: "RON" },
    BGN: { locale: "bg-BG", currency: "BGN" },
    HRK: { locale: "hr-HR", currency: "HRK" },
    TRY: { locale: "tr-TR", currency: "TRY" },
    ILS: { locale: "he-IL", currency: "ILS" },
    AED: { locale: "ar-AE", currency: "AED" },
    SAR: { locale: "ar-SA", currency: "SAR" },
    QAR: { locale: "ar-QA", currency: "QAR" },
    KWD: { locale: "ar-KW", currency: "KWD" },
    BHD: { locale: "ar-BH", currency: "BHD" },
    OMR: { locale: "ar-OM", currency: "OMR" },
    JOD: { locale: "ar-JO", currency: "JOD" },
    LBP: { locale: "ar-LB", currency: "LBP" },
    EGP: { locale: "ar-EG", currency: "EGP" },
    MAD: { locale: "ar-MA", currency: "MAD" },
    TND: { locale: "ar-TN", currency: "TND" },
    DZD: { locale: "ar-DZ", currency: "DZD" },
    LYD: { locale: "ar-LY", currency: "LYD" },
    SDG: { locale: "ar-SD", currency: "SDG" },
    IQD: { locale: "ar-IQ", currency: "IQD" },
    SYP: { locale: "ar-SY", currency: "SYP" },
    YER: { locale: "ar-YE", currency: "YER" },
    AFN: { locale: "ps-AF", currency: "AFN" },
    PKR: { locale: "ur-PK", currency: "PKR" },
    BDT: { locale: "bn-BD", currency: "BDT" },
    LKR: { locale: "si-LK", currency: "LKR" },
    NPR: { locale: "ne-NP", currency: "NPR" },
    MMK: { locale: "my-MM", currency: "MMK" },
    THB: { locale: "th-TH", currency: "THB" },
    VND: { locale: "vi-VN", currency: "VND" },
    IDR: { locale: "id-ID", currency: "IDR" },
    MYR: { locale: "ms-MY", currency: "MYR" },
    SGD: { locale: "en-SG", currency: "SGD" },
    PHP: { locale: "en-PH", currency: "PHP" },
    NZD: { locale: "en-NZ", currency: "NZD" },
    HKD: { locale: "zh-HK", currency: "HKD" },
    TWD: { locale: "zh-TW", currency: "TWD" },
    CLP: { locale: "es-CL", currency: "CLP" },
    COP: { locale: "es-CO", currency: "COP" },
    PEN: { locale: "es-PE", currency: "PEN" },
    ARS: { locale: "es-AR", currency: "ARS" },
    UYU: { locale: "es-UY", currency: "UYU" },
    PYG: { locale: "es-PY", currency: "PYG" },
    BOB: { locale: "es-BO", currency: "BOB" },
    VES: { locale: "es-VE", currency: "VES" },
    GTQ: { locale: "es-GT", currency: "GTQ" },
    HNL: { locale: "es-HN", currency: "HNL" },
    NIO: { locale: "es-NI", currency: "NIO" },
    CRC: { locale: "es-CR", currency: "CRC" },
    PAB: { locale: "es-PA", currency: "PAB" },
    DOP: { locale: "es-DO", currency: "DOP" },
    HTG: { locale: "ht-HT", currency: "HTG" },
    JMD: { locale: "en-JM", currency: "JMD" },
    TTD: { locale: "en-TT", currency: "TTD" },
    BBD: { locale: "en-BB", currency: "BBD" },
    XCD: { locale: "en-AG", currency: "XCD" },
    BZD: { locale: "en-BZ", currency: "BZD" },
    GYD: { locale: "en-GY", currency: "GYD" },
    SRD: { locale: "nl-SR", currency: "SRD" },
    GHS: { locale: "en-GH", currency: "GHS" },
    NGN: { locale: "en-NG", currency: "NGN" },
    KES: { locale: "sw-KE", currency: "KES" },
    UGX: { locale: "sw-UG", currency: "UGX" },
    TZS: { locale: "sw-TZ", currency: "TZS" },
    MWK: { locale: "ny-MW", currency: "MWK" },
    ZMW: { locale: "en-ZM", currency: "ZMW" },
    BWP: { locale: "en-BW", currency: "BWP" },
    NAD: { locale: "en-NA", currency: "NAD" },
    SZL: { locale: "en-SZ", currency: "SZL" },
    LSL: { locale: "en-LS", currency: "LSL" },
    MUR: { locale: "en-MU", currency: "MUR" },
    SCR: { locale: "en-SC", currency: "SCR" },
    KMF: { locale: "ar-KM", currency: "KMF" },
    DJF: { locale: "ar-DJ", currency: "DJF" },
    ETB: { locale: "am-ET", currency: "ETB" },
    ERN: { locale: "ti-ER", currency: "ERN" },
    SOS: { locale: "so-SO", currency: "SOS" },
    KHR: { locale: "km-KH", currency: "KHR" },
    LAK: { locale: "lo-LA", currency: "LAK" },
    MNT: { locale: "mn-MN", currency: "MNT" },
    KZT: { locale: "kk-KZ", currency: "KZT" },
    UZS: { locale: "uz-UZ", currency: "UZS" },
    TJS: { locale: "tg-TJ", currency: "TJS" },
    TMT: { locale: "tk-TM", currency: "TMT" },
    AZN: { locale: "az-AZ", currency: "AZN" },
    GEL: { locale: "ka-GE", currency: "GEL" },
    AMD: { locale: "hy-AM", currency: "AMD" },
    ALL: { locale: "sq-AL", currency: "ALL" },
    MKD: { locale: "mk-MK", currency: "MKD" },
    RSD: { locale: "sr-RS", currency: "RSD" },
    BAM: { locale: "bs-BA", currency: "BAM" },
    MDL: { locale: "ro-MD", currency: "MDL" },
    UAH: { locale: "uk-UA", currency: "UAH" },
    BYN: { locale: "be-BY", currency: "BYN" },
    KGS: { locale: "ky-KG", currency: "KGS" },
  };

  try {
    const config = currencyConfig[currency.toUpperCase()];
    if (config) {
      return new Intl.NumberFormat(config.locale, {
        style: "currency",
        currency: config.currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(amount);
    } else {
      // Fallback for unsupported currencies
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currency.toUpperCase(),
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(amount);
    }
  } catch (error) {
    // Final fallback if currency formatting fails
    return `${currency.toUpperCase()} ${amount.toFixed(2)}`;
  }
};

/**
 * Get currency symbol for display
 * @param currency - The currency code
 * @returns Currency symbol string
 */
export const getCurrencySymbol = (currency: string = "USD"): string => {
  const currencySymbols: { [key: string]: string } = {
    USD: "$",      // US Dollar
    CAD: "C$",     // Canadian Dollar
    AUD: "A$",     // Australian Dollar
    GBP: "£",      // British Pound
    EUR: "€",      // Euro
    INR: "₹",      // Indian Rupee
    JPY: "¥",      // Japanese Yen
    CNY: "¥",      // Chinese Yuan
    KRW: "₩",      // Korean Won
    BRL: "R$",     // Brazilian Real
    MXN: "$",      // Mexican Peso
    RUB: "₽",      // Russian Ruble
    ZAR: "R",      // South African Rand
    SEK: "kr",     // Swedish Krona
    NOK: "kr",     // Norwegian Krone
    DKK: "kr",     // Danish Krone
    CHF: "CHF",    // Swiss Franc
    PLN: "zł",     // Polish Złoty
    CZK: "Kč",     // Czech Koruna
    HUF: "Ft",     // Hungarian Forint
    RON: "lei",    // Romanian Leu
    BGN: "лв",     // Bulgarian Lev
    HRK: "kn",     // Croatian Kuna
    TRY: "₺",      // Turkish Lira
    ILS: "₪",      // Israeli Shekel
    AED: "د.إ",    // UAE Dirham
    SAR: "ر.س",    // Saudi Riyal
    QAR: "ر.ق",    // Qatari Riyal
    KWD: "د.ك",    // Kuwaiti Dinar
    BHD: "د.ب",    // Bahraini Dinar
    OMR: "ر.ع.",   // Omani Rial
    JOD: "د.أ",    // Jordanian Dinar
    LBP: "ل.ل",    // Lebanese Pound
    EGP: "ج.م",    // Egyptian Pound
    MAD: "د.م.",   // Moroccan Dirham
    TND: "د.ت",    // Tunisian Dinar
    DZD: "د.ج",    // Algerian Dinar
    LYD: "ل.د",    // Libyan Dinar
    SDG: "ج.س.",   // Sudanese Pound
    IQD: "ع.د",    // Iraqi Dinar
    SYP: "ل.س",    // Syrian Pound
    YER: "ر.ي",    // Yemeni Rial
    AFN: "؋",      // Afghan Afghani
    PKR: "₨",      // Pakistani Rupee
    BDT: "৳",      // Bangladeshi Taka
    LKR: "රු",     // Sri Lankan Rupee
    NPR: "रू",     // Nepalese Rupee
    MMK: "K",      // Myanmar Kyat
    THB: "฿",      // Thai Baht
    VND: "₫",      // Vietnamese Dong
    IDR: "Rp",     // Indonesian Rupiah
    MYR: "RM",     // Malaysian Ringgit
    SGD: "S$",     // Singapore Dollar
    PHP: "₱",      // Philippine Peso
    NZD: "NZ$",    // New Zealand Dollar
    HKD: "HK$",    // Hong Kong Dollar
    TWD: "NT$",    // Taiwan Dollar
    CLP: "$",      // Chilean Peso
    COP: "$",      // Colombian Peso
    PEN: "S/",     // Peruvian Sol
    ARS: "$",      // Argentine Peso
    UYU: "$",      // Uruguayan Peso
    PYG: "₲",      // Paraguayan Guaraní
    BOB: "Bs",     // Bolivian Boliviano
    VES: "Bs",     // Venezuelan Bolívar
    GTQ: "Q",      // Guatemalan Quetzal
    HNL: "L",      // Honduran Lempira
    NIO: "C$",     // Nicaraguan Córdoba
    CRC: "₡",      // Costa Rican Colón
    PAB: "B/.",    // Panamanian Balboa
    DOP: "RD$",    // Dominican Peso
    HTG: "G",      // Haitian Gourde
    JMD: "J$",     // Jamaican Dollar
    TTD: "TT$",    // Trinidad and Tobago Dollar
    BBD: "Bds$",   // Barbadian Dollar
    XCD: "EC$",    // East Caribbean Dollar
    BZD: "BZ$",    // Belize Dollar
    GYD: "G$",     // Guyanese Dollar
    SRD: "SRD",    // Surinamese Dollar
    GHS: "GH₵",    // Ghanaian Cedi
    NGN: "₦",      // Nigerian Naira
    KES: "KSh",    // Kenyan Shilling
    UGX: "USh",    // Ugandan Shilling
    TZS: "TSh",    // Tanzanian Shilling
    MWK: "MK",     // Malawian Kwacha
    ZMW: "ZK",     // Zambian Kwacha
    BWP: "P",      // Botswana Pula
    NAD: "N$",     // Namibian Dollar
    SZL: "E",      // Swazi Lilangeni
    LSL: "L",      // Lesotho Loti
    MUR: "₨",      // Mauritian Rupee
    SCR: "₨",      // Seychellois Rupee
    KMF: "CF",     // Comorian Franc
    DJF: "Fdj",    // Djiboutian Franc
    ETB: "Br",     // Ethiopian Birr
    ERN: "Nfk",    // Eritrean Nakfa
    SOS: "S",      // Somali Shilling
    KHR: "៛",      // Cambodian Riel
    LAK: "₭",      // Lao Kip
    MNT: "₮",      // Mongolian Tögrög
    KZT: "₸",      // Kazakhstani Tenge
    UZS: "so'm",   // Uzbekistani Som
    TJS: "ЅМ",     // Tajikistani Somoni
    TMT: "T",      // Turkmenistani Manat
    AZN: "₼",      // Azerbaijani Manat
    GEL: "₾",      // Georgian Lari
    AMD: "֏",      // Armenian Dram
    ALL: "L",      // Albanian Lek
    MKD: "ден",    // Macedonian Denar
    RSD: "дин",    // Serbian Dinar
    BAM: "KM",     // Bosnia and Herzegovina Convertible Mark
    MDL: "L",      // Moldovan Leu
    UAH: "₴",      // Ukrainian Hryvnia
    BYN: "Br",     // Belarusian Ruble
    KGS: "с",      // Kyrgyzstani Som
  };

  return currencySymbols[currency.toUpperCase()] || currency.toUpperCase();
};

/**
 * Create Stripe payment method
 * @param cardDetails - Card details for payment method creation
 * @param publishableKey - Stripe publishable key
 * @returns Promise<any>
 */
export const createStripePaymentMethod = async (
  cardDetails: {
    number: string;
    exp_month: number;
    exp_year: number;
    cvc: string;
  },
  publishableKey: string
): Promise<any> => {
  try {
    // Load Stripe.js dynamically
    const stripe = await loadStripe(publishableKey);
    if (!stripe) {
      throw new Error('Failed to load Stripe');
    }

    // Create payment method
    const { paymentMethod, error } = await stripe.createPaymentMethod({
      type: 'card',
      card: {
        number: cardDetails.number,
        exp_month: cardDetails.exp_month,
        exp_year: cardDetails.exp_year,
        cvc: cardDetails.cvc,
      },
    });

    if (error) {
      throw new Error(error.message);
    }

    return paymentMethod;
  } catch (error) {
    throw error;
  }
};

/**
 * Create Stripe payment method using Elements
 * @param elements - Stripe Elements instance
 * @param cardElement - Stripe Card Element instance
 * @returns Promise<any>
 */
export const createStripePaymentMethodWithElements = async (
  stripe: any,
  cardElement: any
): Promise<any> => {
  try {
    if (!stripe || !cardElement) {
      throw new Error('Stripe instance or card element not provided');
    }

    const { paymentMethod, error } = await stripe.createPaymentMethod({
      type: 'card',
      card: cardElement,
    });

    if (error) {
      throw new Error(error.message);
    }

    return paymentMethod;
  } catch (error) {
    throw error;
  }
};

/**
 * Create Stripe Elements instance
 * @param publishableKey - Stripe publishable key
 * @returns Promise<any>
 */
export const createStripeElements = async (publishableKey: string) => {
  try {
    const stripe = await loadStripe(publishableKey);
    
    if (!stripe) {
      throw new Error('Failed to load Stripe');
    }

    const elements = stripe.elements();
    return elements;
  } catch (error) {
    throw error;
  }
};

/**
 * Load Stripe.js dynamically
 */
const loadStripe = async (publishableKey: string) => {
  try {
    // Check if Stripe is already loaded
    if (window.Stripe) {
      return window.Stripe(publishableKey);
    }

    // Load Stripe.js script
    const script = document.createElement('script');
    script.src = 'https://js.stripe.com/v3/';
    script.async = true;
    
    return new Promise((resolve, reject) => {
      script.onload = () => {
        if (window.Stripe) {
          const stripe = window.Stripe(publishableKey);
          resolve(stripe);
        } else {
          reject(new Error('Stripe failed to load'));
        }
      };
      script.onerror = () => {
        reject(new Error('Failed to load Stripe script'));
      };
      document.head.appendChild(script);
    });
  } catch (error) {
    throw error;
  }
};

/**
 * Initiate payment for new enrollment
 * @param paymentData - The payment initiation data
 * @returns Promise<any>
 */
export const initiatePaymentForEnrollment = async (
  paymentData: {
    institute_id: string;
    package_session_ids: string[];
    plan_id: string;
    payment_option_id: string;
    enroll_invite_id: string;
    payment_initiation_request: {
      amount: number;
      currency: string;
      description: string;
      charge_automatically: boolean;
      stripe_request?: {
        payment_method_id: string;
        card_last4: string;
        customer_id: string;
        publishable_key?: string;
      };
      razorpay_request?: {
        customer_id: string;
        contact: string;
        email: string;
      };
      pay_pal_request?: any;
      include_pending_items: boolean;
    };
  },
  token: string
): Promise<any> => {
  // Note: Token validation is handled by authenticatedAxiosInstance
  // The token parameter is kept for backward compatibility but not used directly
  try {
    // Use authenticated axios instance which handles token refresh automatically
    const response = await authenticatedAxiosInstance.post(
      ENROLLMENT_PAYMENT_INITIATION,
      paymentData
    );
    return response.data;
      } catch (error: any) {
      if (error.response) {
        // Handle duplicate enrollment error (user already requested enrollment)
        if (error.response.status === 400 || error.response.status === 409) {
          const errorMessage = error.response.data?.message || error.response.data?.error || '';
          
          if (errorMessage.includes('duplicate key value violates unique constraint') || 
              errorMessage.includes('uq_destination_pkg_inst_status_pkg_user') ||
              errorMessage.includes('PENDING_FOR_APPROVAL')) {
            throw new Error('ENROLLMENT_PENDING_APPROVAL');
          }
        }
        
        // Handle 510 Payment Gateway Configuration error
        if (error.response.status === 510) {
          // Try to extract the actual error message from the nested response
          let actualErrorMessage = 'Payment gateway configuration error. Please check your payment settings.';
          
          try {
            if (error.response.data?.ex) {
              // The error message is nested in the 'ex' field and might be JSON
              const exData = error.response.data.ex;
              
              // Try to parse it as JSON if it's a string
              if (typeof exData === 'string') {
                try {
                  const parsedEx = JSON.parse(exData);
                  if (parsedEx.ex) {
                    actualErrorMessage = parsedEx.ex;
                  }
                } catch (parseError) {
                  // If it's not JSON, use the string directly
                  actualErrorMessage = exData;
                }
              }
            } else if (error.response.data?.responseCode) {
              // Try to extract from responseCode field
              const responseCode = error.response.data.responseCode;
              if (typeof responseCode === 'string' && responseCode.includes('"')) {
                try {
                  const parsedResponse = JSON.parse(responseCode);
                  if (parsedResponse.ex) {
                    actualErrorMessage = parsedResponse.ex;
                  }
                } catch (parseError) {
                  actualErrorMessage = responseCode;
                }
              }
            }
          } catch (extractError) {
            // Silent error handling
          }
          
          // Check if this is actually a duplicate enrollment error
          if (actualErrorMessage.includes('duplicate key value violates unique constraint') || 
              actualErrorMessage.includes('uq_destination_pkg_inst_status_pkg_user') ||
              actualErrorMessage.includes('PENDING_FOR_APPROVAL')) {
            throw new Error('ENROLLMENT_PENDING_APPROVAL');
          }
          
          throw new Error(`Payment Gateway Error: ${actualErrorMessage}`);
        } else if (error.response.status === 511) {
          // Try to extract the actual error message from the nested response
          let actualErrorMessage = 'Network authentication required. Please check your credentials.';
          
          try {
            if (error.response.data?.ex) {
              // The error message is nested in the 'ex' field and might be JSON
              const exData = error.response.data.ex;
              
              // Try to parse it as JSON if it's a string
              if (typeof exData === 'string') {
                try {
                  const parsedEx = JSON.parse(exData);
                  if (parsedEx.ex) {
                    actualErrorMessage = parsedEx.ex;
                  }
                } catch (parseError) {
                  // If it's not JSON, use the string directly
                  actualErrorMessage = exData;
                }
              }
            } else if (error.response.data?.responseCode) {
              // Try to extract from responseCode field
              const responseCode = error.response.data.responseCode;
              if (typeof responseCode === 'string' && responseCode.includes('"')) {
                try {
                  const parsedResponse = JSON.parse(responseCode);
                  if (parsedResponse.ex) {
                    actualErrorMessage = parsedResponse.ex;
                  }
                } catch (parseError) {
                  actualErrorMessage = responseCode;
                }
              }
            }
          } catch (extractError) {
            // Silent error handling
          }
          
          // Check if this is actually a duplicate enrollment error
          if (actualErrorMessage.includes('duplicate key value violates unique constraint') || 
              actualErrorMessage.includes('uq_destination_pkg_inst_status_pkg_user') ||
              actualErrorMessage.includes('PENDING_FOR_APPROVAL')) {
            throw new Error('ENROLLMENT_PENDING_APPROVAL');
          }
          
          throw new Error(`Authentication Error: ${actualErrorMessage}`);
        } else if (error.response.status === 403) {
          throw new Error('Access forbidden. Please check your permissions or try logging in again.');
        } else if (error.response.status === 401) {
          throw new Error('Unauthorized. Please check your authentication token.');
        } else {
          // Try to extract error message from response data
          let errorMessage = error.response.statusText || 'Unknown error';
          
          if (error.response.data) {
            if (error.response.data.message) {
              errorMessage = error.response.data.message;
            } else if (error.response.data.ex) {
              errorMessage = error.response.data.ex;
            } else if (typeof error.response.data === 'string') {
              errorMessage = error.response.data;
            }
          }
          
          // Check if this is actually a duplicate enrollment error
          if (errorMessage.includes('duplicate key value violates unique constraint') || 
              errorMessage.includes('uq_destination_pkg_inst_status_pkg_user') ||
              errorMessage.includes('PENDING_FOR_APPROVAL')) {
            throw new Error('ENROLLMENT_PENDING_APPROVAL');
          }
          
          throw new Error(`Payment failed: ${errorMessage}`);
        }
      } else if (error.request) {
        throw new Error('Network error. Please check your connection and try again.');
      } else {
        throw new Error(`Payment failed: ${error.message}`);
      }
    }
};

/**
 * Reusable function to handle payment for new enrollments
 * @param params - Parameters for payment
 * @returns Promise<any>
 */
export const handlePaymentForEnrollment = async (params: {
  userEmail: string; // profile email
  receiptEmail: string; // dialog email
  instituteId: string;
  packageSessionId: string;
  enrollmentData: EnrollmentResponse;
  paymentGatewayData: PaymentGatewayDetails;
  selectedPaymentPlan: PaymentPlan;
  selectedPaymentOption: PaymentOption;
  amount: number;
  currency: string;
  description: string;
  paymentType: 'donation' | 'subscription' | 'one-time' | 'free';
  cardDetails?: {
    number: string;
    exp_month: number;
    exp_year: number;
    cvc: string;
  };
  paymentMethod?: unknown;
  token: string;
  userData?: {
    email: string;
    username: string;
    full_name: string;
    mobile_number: string;
    date_of_birth: string;
    gender: string;
    address_line: string;
    city: string;
    region: string;
    pin_code: string;
    profile_pic_file_id: string;
    country: string;
  };
}): Promise<any> => {
  const {
    userEmail,
    receiptEmail,
    instituteId,
    packageSessionId,
    enrollmentData,
    paymentGatewayData,
    selectedPaymentPlan,
    selectedPaymentOption,
    amount,
    currency,
    description,
    paymentType,
    cardDetails,
    paymentMethod,
    token,
    userData
  } = params;

  // Validate and sanitize emails
  const sanitizedUserEmail = validateAndSanitizeEmail(userEmail);
  const sanitizedReceiptEmail = validateAndSanitizeEmail(receiptEmail);

  try {
    // Get the current user ID
    const currentUserId = await getUserId();
    if (!currentUserId) {
      throw new Error('User authentication required. Please log in again.');
    }

    // Validate enrollment data
    if (!enrollmentData || !enrollmentData.id) {
      throw new Error('Enrollment data is missing or invalid. Please try again.');
    }

    if (!instituteId || !packageSessionId || !selectedPaymentPlan?.id || !selectedPaymentOption?.id) {
      throw new Error('Required enrollment parameters are missing. Please try again.');
    }

    // Validate payment gateway data
    if (!paymentGatewayData) {
      throw new Error('Payment gateway configuration is missing. Please try again.');
    }

    // Handle case where API returns simplified response with just publishableKey
    const vendor = paymentGatewayData.vendor || 'STRIPE';
    
    // Note: Payment gateway configuration is handled by the backend
    // We only need to send the stripe_request with payment method details

    // Extract publishable key from payment gateway config
    let publishableKey: string | undefined;
    
    // Check if publishableKey is directly available in the response
    if (paymentGatewayData.publishableKey) {
      publishableKey = paymentGatewayData.publishableKey;
    } else if (paymentGatewayData.config_json) {
      try {
        const config = JSON.parse(paymentGatewayData.config_json);
        
        // Try different possible field names for publishable key
        publishableKey = config.publishableKey || 
                        config.publishable_key || 
                        config.stripe_publishable_key ||
                        config.stripePublishableKey ||
                        config.key ||
                        config.public_key;
      } catch (error) {
        // Silent error handling
      }
    }

    if (!publishableKey) {
      throw new Error('Publishable key not found in payment gateway config. Please check the payment gateway configuration.');
    }

    // Create real Stripe payment method from card details
    let paymentMethodId: string;
    let cardLast4: string;
    let customerId: string;

    if (paymentMethod) {
      // Use the provided payment method from Stripe Elements
      paymentMethodId = paymentMethod.id;
      cardLast4 = paymentMethod.card?.last4 || "0000";
      customerId = paymentMethod.customer || "temp_customer_id";
    } else if (cardDetails && publishableKey) {
      // Create real Stripe payment method from manual card input
      try {
        const stripePaymentMethod = await createStripePaymentMethod(cardDetails, publishableKey);
        paymentMethodId = stripePaymentMethod.id;
        cardLast4 = stripePaymentMethod.card?.last4 || cardDetails.number.slice(-4);
        customerId = stripePaymentMethod.customer || "temp_customer_id";
      } catch (stripeError) {
        throw new Error(`Payment method creation failed: ${stripeError instanceof Error ? stripeError.message : 'Unknown error'}`);
      }
    } else if (paymentType === 'free') {
      // For free enrollment, we don't need payment method details
      paymentMethodId = "free_enrollment";
      cardLast4 = "0000";
      customerId = "free_customer";
    } else {
      throw new Error('Either payment method or card details must be provided');
    }

    // Prepare payment data according to the exact backend API specification
    const paymentPayload = {
      user: {
        id: currentUserId,
        username: userData?.username || sanitizedUserEmail.split('@')[0] || `user_${Date.now()}`,
        email: sanitizedUserEmail,
        full_name: userData?.full_name || "Donation User",
        mobile_number: userData?.mobile_number || "",
        date_of_birth: userData?.date_of_birth || new Date().toISOString(),
        gender: userData?.gender || "Not Specified",
        address_line: userData?.address_line || "",
        city: userData?.city || "",
        region: userData?.region || "",
        pin_code: userData?.pin_code || "",
        profile_pic_file_id: userData?.profile_pic_file_id || "",
        roles: ["STUDENT"],
        root_user: false
      },
      institute_id: instituteId,
      subject_id: "",
      vendor_id: paymentType === 'free' ? "FREE" : "STRIPE",
      learner_package_session_enroll: {
        package_session_ids: [packageSessionId],
        plan_id: selectedPaymentPlan.id,
        payment_option_id: selectedPaymentOption.id,
        enroll_invite_id: enrollmentData.id,
        payment_initiation_request: paymentType === 'free' ? null : {
          amount: amount,
          currency: currency,
          description: description,
          charge_automatically: true,
          institute_id: instituteId,
          email: sanitizedReceiptEmail,
          stripe_request: {
            payment_method_id: paymentMethodId,
            card_last4: cardLast4,
            customer_id: customerId
          },
          razorpay_request: {
            customer_id: "",
            contact: "",
            email: sanitizedReceiptEmail
          },
          pay_pal_request: {},
          include_pending_items: true
        },
        custom_field_values: []
      }
    };

    const result = await initiatePaymentForEnrollment(paymentPayload, token);

    return result;
  } catch (error) {
    
    // Provide more specific error messages based on the error type
    if (error instanceof Error) {
      if (error.message.includes('learner_package_session_enroll') || error.message.includes('enroll_invite_id')) {
        throw new Error('Enrollment configuration error. Please refresh the page and try again.');
      } else if (error.message.includes('401') || error.message.includes('Unauthorized')) {
        throw new Error('Authentication error. Please log in again and try again.');
      } else if (error.message.includes('403') || error.message.includes('forbidden')) {
        throw new Error('Access denied. Please check your permissions and try again.');
      } else {
        throw error;
      }
    } else {
      throw error;
    }
  }
}; 