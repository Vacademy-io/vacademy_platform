/**
 * Currency utility functions for handling different currencies
 */

export const currencySymbols: { [key: string]: string } = {
  USD: "$",
  EUR: "€", 
  GBP: "£",
  INR: "₹",
  AUD: "A$",
  CAD: "C$",
  JPY: "¥",
  CHF: "CHF",
  SEK: "kr",
  NOK: "kr",
  DKK: "kr",
  PLN: "zł",
  CZK: "Kč",
  HUF: "Ft",
  RON: "lei",
  BGN: "лв",
  HRK: "kn",
  RSD: "дин",
  MKD: "ден",
  ALL: "L",
  BAM: "КМ",
  MNT: "₮",
  UAH: "₴",
  GEL: "₾",
  AMD: "֏",
  AZN: "₼",
  KZT: "₸",
  UZS: "сўм",
  KGS: "сом",
  TJS: "SM",
  TMT: "T",
  AFN: "؋",
  PKR: "₨",
  LKR: "₨",
  NPR: "₨",
  BDT: "৳",
  MMK: "K",
  THB: "฿",
  VND: "₫",
  IDR: "Rp",
  MYR: "RM",
  SGD: "S$",
  PHP: "₱",
  KRW: "₩",
  CNY: "¥",
  TWD: "NT$",
  HKD: "HK$",
  MOP: "MOP$",
  BRL: "R$",
  ARS: "$",
  CLP: "$",
  COP: "$",
  MXN: "$",
  PEN: "S/",
  UYU: "$U",
  VEF: "Bs",
  ZAR: "R",
  EGP: "£",
  MAD: "د.م.",
  TND: "د.ت",
  DZD: "د.ج",
  LYD: "ل.د",
  SDG: "ج.س.",
  ETB: "Br",
  KES: "KSh",
  UGX: "USh",
  TZS: "TSh",
  RWF: "RF",
  BIF: "FBu",
  MWK: "MK",
  ZMW: "ZK",
  BWP: "P",
  SZL: "L",
  LSL: "L",
  NAD: "N$",
  AOA: "Kz",
  MZN: "MT",
  ZWL: "Z$",
  GHS: "₵",
  NGN: "₦",
  XAF: "FCFA",
  XOF: "CFA",
  CDF: "FC",
  KMF: "CF",
  DJF: "Fdj",
  ERN: "Nfk",
  SOS: "S",
  SSP: "£",
  TZS: "TSh",
  UGX: "USh",
  ZAR: "R"
};

/**
 * Get currency symbol for a given currency code
 */
export const getCurrencySymbol = (currencyCode: string): string => {
  return currencySymbols[currencyCode] || currencyCode;
};

/**
 * Format amount with currency symbol
 */
export const formatCurrency = (amount: number, currencyCode: string): string => {
  const symbol = getCurrencySymbol(currencyCode);
  
  // Handle special cases for different currencies
  switch (currencyCode) {
    case 'INR':
    case 'PKR':
    case 'LKR':
    case 'NPR':
    case 'BDT':
      // For Indian subcontinent currencies, show symbol after amount
      return `${amount.toFixed(2)} ${symbol}`;
    case 'JPY':
    case 'KRW':
    case 'VND':
      // For currencies without decimal places
      return `${symbol}${Math.round(amount)}`;
    case 'EUR':
    case 'GBP':
    case 'USD':
    case 'AUD':
    case 'CAD':
    case 'SGD':
    case 'HKD':
    case 'NZD':
      // For major currencies, show symbol before amount
      return `${symbol}${amount.toFixed(2)}`;
    default:
      // Default format: symbol before amount with 2 decimal places
      return `${symbol}${amount.toFixed(2)}`;
  }
};

/**
 * Parse currency from payment option metadata
 */
export const parseCurrencyFromMetadata = (metadataJson: string): string => {
  try {
    const metadata = JSON.parse(metadataJson);
    return metadata.currency || 'USD';
  } catch (error) {
    return 'USD';
  }
};

/**
 * Parse currency from payment plan
 */
export const parseCurrencyFromPaymentPlan = (paymentPlan: any): string => {
  return paymentPlan?.currency || 'USD';
};

/**
 * Get currency with priority: payment plan > metadata > default
 */
export const getCurrencyWithPriority = (
  paymentPlan: any,
  metadataJson: string,
  defaultCurrency: string = 'USD'
): string => {
  // Priority 1: Payment plan currency
  if (paymentPlan?.currency) {
    return paymentPlan.currency;
  }
  
  // Priority 2: Metadata currency
  const metadataCurrency = parseCurrencyFromMetadata(metadataJson);
  if (metadataCurrency !== 'USD' || !paymentPlan) {
    return metadataCurrency;
  }
  
  // Priority 3: Default currency
  return defaultCurrency;
};

