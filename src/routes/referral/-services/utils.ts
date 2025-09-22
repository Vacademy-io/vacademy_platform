export type BenefitType =
  | "POINTS"
  | "FREE_MEMBERSHIP_DAYS"
  | "PERCENTAGE_DISCOUNT"
  | "FLAT_DISCOUNT"
  | "CONTENT";

const parseBenefitLog = (benefit_value: string, type: string) => {
  switch (type) {
    case "POINTS": {
      const parse: { points: number } = JSON.parse(benefit_value);
      return { ...parse, type: type as BenefitType };
    }
    case "FREE_MEMBERSHIP_DAYS": {
      const parse: { days: number } = JSON.parse(benefit_value);
      return { ...parse, type: type as BenefitType };
    }
    default:
      return { type: type as BenefitType };
  }
};

const getBenefitText = (type: BenefitType) => {
  switch (type) {
    case "PERCENTAGE_DISCOUNT":
      return `Get a discount on your next purchase`;
    case "FLAT_DISCOUNT":
      return `Get a flat off your next purchase`;
    case "CONTENT":
      return `Exclusive content will be delivered to you`;
    default:
      return "Unknown benefit";
  }
};

const getBenefitTypeLabel = (type: string) => {
  switch (type) {
    case "PERCENTAGE_DISCOUNT":
      return "Percentage Discount";
    case "FLAT_DISCOUNT":
      return "Flat Discount";
    case "FREE_MEMBERSHIP_DAYS":
      return "Free Membership Days";
    case "CONTENT":
      return "Content Benefit";
    case "POINTS":
      return "Reward Points";
    default:
      return type;
  }
};

const getStatusIcon = (status: string) => {
  switch (status.toLowerCase()) {
    case "active":
      return "✅";
    case "pending":
      return "⏳";
    default:
      return "ℹ️";
  }
};

export { parseBenefitLog, getBenefitText, getBenefitTypeLabel, getStatusIcon };
