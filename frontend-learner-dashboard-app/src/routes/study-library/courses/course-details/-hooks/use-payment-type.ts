import { useEffect, useState } from "react";
import { fetchPaymentOptions } from "@/routes/courses/-services/payment-options-api";

// Resolves the institute's payment option type (FREE / SUBSCRIPTION / DONATION
// / ...). Falls back to SUBSCRIPTION so direct navigation still gets a
// sensible enrollment flow when the fetch fails.
export function usePaymentType(instituteId: string | null) {
  const [paymentType, setPaymentType] = useState<string | null>(null);

  useEffect(() => {
    const fetchPaymentType = async () => {
      if (instituteId) {
        try {
          const paymentOption = await fetchPaymentOptions(instituteId);
          if (paymentOption && paymentOption.type) {
            setPaymentType(paymentOption.type);
          } else {
            setPaymentType("SUBSCRIPTION");
          }
        } catch (error) {
          console.error("Error fetching payment options:", error);
          setPaymentType("SUBSCRIPTION");
        }
      }
    };

    fetchPaymentType();
  }, [instituteId]);

  return paymentType;
}
