import { GET_PAYMENT_OPTIONS } from "@/constants/urls";
import { cachedGet } from "@/lib/http/clientCache";

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
  referral_option: any;
  referral_option_smapping_status: string | null;
}

export interface DonationMetadata {
  currency: string;
  features: any[];
  unit: string;
  config: {
    donation: {
      allowCustomAmount: boolean;
      newAmount: string;
      suggestedAmounts: string;
      minimumAmount: string;
    };
  };
  donationData: {
    suggestedAmounts: string;
    minimumAmount: string;
    allowCustomAmount: boolean;
  };
}

export const fetchPaymentOptions = async (instituteId: string): Promise<PaymentOption | null> => {
  try {
    const data = await cachedGet<PaymentOption>(`${GET_PAYMENT_OPTIONS}?source=INSTITUTE&sourceId=${instituteId}`, {
      method: 'GET',
      headers: {
        'accept': '*/*'
      }
    });
    if (data) {
      return data;
    } else {
      // Return hardcoded defaults if API fails - default to subscription for direct navigation
      return {
        id: 'default',
        name: 'Default Subscription',
        type: 'SUBSCRIPTION',
        status: 'ACTIVE',
        require_approval: false,
        payment_plans: [],
        payment_option_metadata_json: JSON.stringify({
          subscriptionData: {
            suggestedAmounts: '5,10,25,50,100',
            minimumAmount: '1',
            allowCustomAmount: true
          }
        })
      };
    }
  } catch (error) {
    // Return hardcoded defaults if API fails - default to subscription for direct navigation
    return {
      id: 'default',
      name: 'Default Subscription',
      type: 'SUBSCRIPTION',
      status: 'ACTIVE',
      require_approval: false,
      payment_plans: [],
      payment_option_metadata_json: JSON.stringify({
        subscriptionData: {
          suggestedAmounts: '5,10,25,50,100',
          minimumAmount: '1',
          allowCustomAmount: true
        }
      })
    };
  }
};

export const parseDonationMetadata = (metadataJson: string): DonationMetadata | null => {
  try {
    return JSON.parse(metadataJson);
  } catch (error) {
    return null;
  }
};

export const getSuggestedAmounts = (metadata: DonationMetadata | null): number[] => {
  if (metadata?.donationData?.suggestedAmounts) {
    const amounts = metadata.donationData.suggestedAmounts
      .split(',')
      .map((amount: string) => parseFloat(amount.trim()))
      .filter((amount: number) => !isNaN(amount));
    
    if (amounts.length > 0) {
      return amounts;
    }
  }
  
  // Fallback to default amounts
  return [5, 10, 25, 50, 100];
};

export const getMinAmount = (metadata: DonationMetadata | null): number => {
  if (metadata?.donationData?.minimumAmount) {
    const minAmount = parseFloat(metadata.donationData.minimumAmount);
    if (!isNaN(minAmount)) {
      return minAmount;
    }
  }
  
  // Fallback to minimum of suggested amounts
  const amounts = getSuggestedAmounts(metadata);
  return Math.min(...amounts);
};
