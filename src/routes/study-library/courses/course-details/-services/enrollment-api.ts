import axios from "axios";

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
      `https://backend-stage.vacademy.io/admin-core-service/v1/enroll-invite/${inviteCode}/${instituteId}/${packageSessionId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error("Error fetching enrollment details:", error);
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