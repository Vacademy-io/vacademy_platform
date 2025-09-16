import { MyButton } from "@/components/design-system/button";
import { Input } from "@/components/ui/input";
import { VERIFY_COUPON_URL } from "@/constants/urls";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { AxiosResponse } from "axios";
import { Check, Tag, X } from "phosphor-react";
import { useState } from "react";

// Common base interface
interface Benefit {
  benefitType: string;
  benefitValue: any;
}

// Flat discount interface
export interface FlatBenefit extends Benefit {
  benefitType: "FLAT";
  benefitValue: {
    amount: number;
  };
}

// Percentage discount interface
export interface PercentageDiscountBenefit extends Benefit {
  benefitType: "PERCENTAGE_DISCOUNT";
  benefitValue: {
    percentage: number;
    maxDiscountAmount: number;
    applyMaximumDiscountAmount: boolean;
  };
}

// Free membership days interface
export interface FreeMembershipDaysBenefit extends Benefit {
  benefitType: "FREE_MEMBERSHIP_DAYS";
  benefitValue: {
    free_days: number;
  };
}

export // Referral Code Component
const ReferralCodeComponent = ({
  referralOptionId,
  setCouponVerified,
  package_session_id,
}: {
  referralOptionId: string;
  setCouponVerified: (value: boolean) => void;
  package_session_id: string;
}) => {
  const [referralCode, setReferralCode] = useState("");
  const [isApplying, setIsApplying] = useState(false);
  const [appliedReferral, setAppliedReferral] = useState<{
    code: string;
    discount: number;
    type: "percentage" | "fixed";
  } | null>(null);
  const [error, setError] = useState("");

  const applyReferralCode = async () => {
    if (!referralCode.trim()) {
      setError("Please enter a referral code");
      return;
    }

    setIsApplying(true);
    setError("");

    try {
      // Simulate API call - Replace with actual API call
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const response: AxiosResponse<{
        verified: boolean;
        source_type: string;
        source_id: string;
        message: string;
      }> = await authenticatedAxiosInstance({
        method: "POST",
        url: VERIFY_COUPON_URL,
        params: {
          couponCode: referralCode,
          referralOptionId: referralOptionId,
        },
        data: {
          package_session_id: [package_session_id],
        },
      });

      console.log("API Response:", response.data);
      if (response.data.verified) {
        setCouponVerified(true);
        setReferralCode("");
      } else {
        setError("Invalid referral code");
        setCouponVerified(false);
      }
    } catch {
      setError("Failed to apply referral code. Please try again.");
    } finally {
      setIsApplying(false);
    }
  };

  const removeReferralCode = () => {
    setAppliedReferral(null);
    setError("");
  };

  return (
    <div className="bg-blue-50 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <Tag className="w-5 h-5 text-blue-600" />
        <h3 className="font-semibold text-gray-900 text-lg">Referral Code</h3>
      </div>

      {!appliedReferral ? (
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                type="text"
                placeholder="Enter referral code"
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value)}
                className="!w-full"
              />
            </div>
            <MyButton
              type="button"
              buttonType="primary"
              scale="medium"
              onClick={applyReferralCode}
              disable={isApplying || !referralCode.trim()}
              className="whitespace-nowrap"
            >
              {isApplying ? "Applying..." : "Apply"}
            </MyButton>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm">
              <X className="w-4 h-4" />
              <span>{error}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-green-600" />
              <span className="text-green-600 font-medium">
                Code "{appliedReferral.code}" applied
              </span>
            </div>
            <button
              onClick={removeReferralCode}
              className="text-red-600 hover:text-red-700 text-sm underline"
            >
              Remove
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
