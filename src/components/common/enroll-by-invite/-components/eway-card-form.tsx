import { useState, ChangeEvent, FormEvent } from "react";
import { useEway } from "../-hooks/use-eway";
import {
  validateCardNumber,
  validateExpiryDate,
  validateCVV,
  formatCardNumber,
  CardType,
  getCardTypeDisplayName,
} from "../-utils/card-validator";
import {
  encryptCardData,
  isCryptoSupported,
  sanitizeCardData,
  EwayCardData,
  formatEncryptionError,
} from "../-utils/eway-encryption";
import { MyButton } from "@/components/design-system/button";
import { Input } from "@/components/ui/input";

/**
 * Eway Card Form Props
 */
interface EwayCardFormProps {
  isProcessing?: boolean;
  onPaymentReady: (encryptedData: {
    encryptedNumber: string;
    encryptedCVN: string;
    cardData: {
      name: string;
      expiryMonth: string;
      expiryYear: string;
    };
  }) => void;
  onError?: (error: string) => void;
}

/**
 * Eway Card Payment Form Component
 *
 * Collects card details, validates them, and encrypts using Eway's encryption key
 * before passing encrypted data to parent component for processing
 */
export const EwayCardForm = ({
  onPaymentReady,
  onError,
  isProcessing = false,
}: EwayCardFormProps) => {
  const { encryptionKey, isConfigured } = useEway();

  // Form state
  const [cardData, setCardData] = useState<EwayCardData>({
    name: "",
    number: "",
    expiryMonth: "",
    expiryYear: "",
    cvn: "",
  });

  // Validation state
  const [errors, setErrors] = useState<
    Partial<Record<keyof EwayCardData, string>>
  >({});
  const [cardType, setCardType] = useState<CardType>("unknown");
  const [touched, setTouched] = useState<
    Partial<Record<keyof EwayCardData, boolean>>
  >({});

  // UI state
  const [isEncrypting, setIsEncrypting] = useState(false);

  // Check if crypto is supported
  const cryptoSupported = isCryptoSupported();

  /**
   * Handle card number change with formatting
   */
  const handleCardNumberChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\s/g, ""); // Remove spaces

    setCardData((prev) => ({ ...prev, number: value }));

    // Validate on change
    const validation = validateCardNumber(value);
    setCardType(validation.cardType);

    if (touched.number) {
      setErrors((prev) => ({
        ...prev,
        number: validation.isValid ? undefined : validation.error,
      }));
    }
  };

  /**
   * Handle expiry date change with formatting
   * Stores raw digits and formats for display
   */
  const handleExpiryChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;

    // Remove all non-digits to get clean input
    const digitsOnly = value.replace(/\D/g, "");

    // Limit to 4 digits max (MMYY)
    const limitedDigits = digitsOnly.slice(0, 4);

    // If empty, clear state
    if (limitedDigits.length === 0) {
      setCardData((prev) => ({
        ...prev,
        expiryMonth: "",
        expiryYear: "",
      }));
      return;
    }

    // Parse month and year from digits
    let month = "";
    let year = "";

    if (limitedDigits.length >= 1) {
      // Get month (first 1 or 2 digits)
      month = limitedDigits.slice(0, Math.min(2, limitedDigits.length));
    }

    if (limitedDigits.length > 2) {
      // Get year (digits after the month)
      const yearDigits = limitedDigits.slice(2);
      // Store just the 2-digit year for now, will convert to full year when validating
      year = yearDigits;
    }

    // Update state with raw values
    setCardData((prev) => ({
      ...prev,
      expiryMonth: month,
      expiryYear: year,
    }));

    // Validate only if we have complete input (4 digits total)
    if (touched.expiryMonth || touched.expiryYear) {
      if (limitedDigits.length === 4) {
        // Convert 2-digit year to 4-digit year for validation
        const fullYear = year.length === 2 ? `20${year}` : year;
        const validation = validateExpiryDate(month, fullYear);
        setErrors((prev) => ({
          ...prev,
          expiryMonth: validation.isValid ? undefined : validation.error,
          expiryYear: validation.isValid ? undefined : validation.error,
        }));
      } else {
        // Clear errors while still typing
        setErrors((prev) => ({
          ...prev,
          expiryMonth: undefined,
          expiryYear: undefined,
        }));
      }
    }
  };

  /**
   * Handle CVV change
   */
  const handleCVVChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 4); // Max 4 digits
    setCardData((prev) => ({ ...prev, cvn: value }));

    if (touched.cvn) {
      const validation = validateCVV(value, cardType);
      setErrors((prev) => ({
        ...prev,
        cvn: validation.isValid ? undefined : validation.error,
      }));
    }
  };

  /**
   * Handle cardholder name change
   */
  const handleNameChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCardData((prev) => ({ ...prev, name: value }));

    if (touched.name) {
      setErrors((prev) => ({
        ...prev,
        name: value.trim().length < 2 ? "Name is required" : undefined,
      }));
    }
  };

  /**
   * Mark field as touched
   */
  const handleBlur = (field: keyof EwayCardData) => {
    setTouched((prev) => ({ ...prev, [field]: true }));

    // Validate on blur
    validateField(field);
  };

  /**
   * Validate individual field
   */
  const validateField = (field: keyof EwayCardData) => {
    let error: string | undefined;

    switch (field) {
      case "number": {
        const cardValidation = validateCardNumber(cardData.number);
        error = cardValidation.isValid ? undefined : cardValidation.error;
        break;
      }

      case "expiryMonth":
      case "expiryYear": {
        if (cardData.expiryMonth && cardData.expiryYear) {
          // validateExpiryDate handles both YY and YYYY formats
          // Our form stores 2-digit year, which is fine
          const expiryValidation = validateExpiryDate(
            cardData.expiryMonth,
            cardData.expiryYear
          );
          error = expiryValidation.isValid ? undefined : expiryValidation.error;
        } else {
          error = "Expiry date is required";
        }
        break;
      }

      case "cvn": {
        const cvvValidation = validateCVV(cardData.cvn, cardType);
        error = cvvValidation.isValid ? undefined : cvvValidation.error;
        break;
      }

      case "name":
        error =
          cardData.name.trim().length < 2 ? "Name is required" : undefined;
        break;
    }

    setErrors((prev) => ({ ...prev, [field]: error }));
    return !error;
  };

  /**
   * Validate all fields
   */
  const validateAllFields = (): boolean => {
    const fields: Array<keyof EwayCardData> = [
      "name",
      "number",
      "expiryMonth",
      "cvn",
    ];
    const validations = fields.map((field) => validateField(field));

    // Mark all as touched
    setTouched({
      name: true,
      number: true,
      expiryMonth: true,
      expiryYear: true,
      cvn: true,
    });

    return validations.every((isValid) => isValid);
  };

  /**
   * Handle form submission
   */
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!cryptoSupported) {
      const errorMsg =
        "Your browser does not support secure payment encryption. Please use a modern browser.";
      onError?.(errorMsg);
      return;
    }

    if (!isConfigured || !encryptionKey) {
      const errorMsg =
        "Payment gateway is not properly configured. Please contact support.";
      onError?.(errorMsg);
      return;
    }

    // Validate all fields
    if (!validateAllFields()) {
      onError?.("Please fix the errors in the form");
      return;
    }

    try {
      setIsEncrypting(true);

      // ✅ Sanitize and encrypt card data following Eway specification
      const sanitized = sanitizeCardData(cardData);
      const encrypted = await encryptCardData(sanitized, encryptionKey);

      // Pass encrypted data + plain text fields to parent
      // Per Eway spec: only card number and CVN are encrypted
      onPaymentReady({
        encryptedNumber: encrypted.encryptedNumber,
        encryptedCVN: encrypted.encryptedCVN,
        cardData: {
          name: sanitized.name,
          expiryMonth: sanitized.expiryMonth,
          expiryYear: sanitized.expiryYear,
        },
      });
    } catch (error) {
      const errorMsg = formatEncryptionError(error);
      onError?.(errorMsg);
      console.error("❌ Encryption error:", error);
    } finally {
      setIsEncrypting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Card Number */}
      <div>
        <label
          htmlFor="cardNumber"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Card Number
        </label>
        <div className="relative">
          <Input
            id="cardNumber"
            type="text"
            inputMode="numeric"
            placeholder="1234 5678 9012 3456"
            value={formatCardNumber(cardData.number)}
            onChange={handleCardNumberChange}
            onBlur={() => handleBlur("number")}
            disabled={isProcessing || isEncrypting}
            className={errors.number && touched.number ? "border-red-500" : ""}
          />
          {cardType !== "unknown" && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
              {getCardTypeDisplayName(cardType)}
            </div>
          )}
        </div>
        {errors.number && touched.number && (
          <p className="mt-1 text-sm text-red-600">{errors.number}</p>
        )}
      </div>

      {/* Cardholder Name */}
      <div>
        <label
          htmlFor="cardName"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Cardholder Name
        </label>
        <Input
          id="cardName"
          type="text"
          placeholder="John Smith"
          value={cardData.name}
          onChange={handleNameChange}
          onBlur={() => handleBlur("name")}
          disabled={isProcessing || isEncrypting}
          className={errors.name && touched.name ? "border-red-500" : ""}
        />
        {errors.name && touched.name && (
          <p className="mt-1 text-sm text-red-600">{errors.name}</p>
        )}
      </div>

      {/* Expiry and CVV Row */}
      <div className="grid grid-cols-2 gap-4">
        {/* Expiry Date */}
        <div>
          <label
            htmlFor="cardExpiry"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Expiry Date
          </label>
          <Input
            id="cardExpiry"
            type="text"
            inputMode="numeric"
            placeholder="MM/YY"
            value={(() => {
              const month = cardData.expiryMonth;
              const year = cardData.expiryYear;

              // No input yet
              if (!month) return "";

              // Only month typed, no year yet
              if (month && !year) {
                return month;
              }

              // Both month and year - add slash between them
              if (month && year) {
                return `${month}/${year}`;
              }

              return month;
            })()}
            onChange={handleExpiryChange}
            onBlur={() => {
              handleBlur("expiryMonth");
              handleBlur("expiryYear");
            }}
            maxLength={5}
            disabled={isProcessing || isEncrypting}
            className={
              (errors.expiryMonth || errors.expiryYear) &&
              (touched.expiryMonth || touched.expiryYear)
                ? "border-red-500"
                : ""
            }
          />
          {(errors.expiryMonth || errors.expiryYear) &&
            (touched.expiryMonth || touched.expiryYear) && (
              <p className="mt-1 text-sm text-red-600">
                {errors.expiryMonth || errors.expiryYear}
              </p>
            )}
        </div>

        {/* CVV */}
        <div>
          <label
            htmlFor="cardCVV"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            CVV
          </label>
          <Input
            id="cardCVV"
            type="text"
            inputMode="numeric"
            placeholder={cardType === "amex" ? "1234" : "123"}
            value={cardData.cvn}
            onChange={handleCVVChange}
            onBlur={() => handleBlur("cvn")}
            maxLength={cardType === "amex" ? 4 : 3}
            disabled={isProcessing || isEncrypting}
            className={errors.cvn && touched.cvn ? "border-red-500" : ""}
          />
          {errors.cvn && touched.cvn && (
            <p className="mt-1 text-sm text-red-600">{errors.cvn}</p>
          )}
        </div>
      </div>

      {/* Security Notice */}
      <div className="bg-blue-50 p-3 rounded-md">
        <p className="text-xs text-blue-800">
          🔒 Your card details are encrypted before being sent. We never store
          your card information.
        </p>
      </div>

      {/* Browser Support Warning */}
      {!cryptoSupported && (
        <div className="bg-red-50 p-3 rounded-md">
          <p className="text-sm text-red-800">
            ⚠️ Your browser does not support secure payment encryption. Please
            use a modern browser like Chrome, Firefox, Safari, or Edge.
          </p>
        </div>
      )}

      {/* Submit Button */}
      <MyButton
        type="submit"
        disabled={isProcessing || isEncrypting || !cryptoSupported}
        className="w-full"
      >
        {isEncrypting
          ? "Encrypting..."
          : isProcessing
          ? "Processing..."
          : "Pay Now"}
      </MyButton>
    </form>
  );
};

export default EwayCardForm;
