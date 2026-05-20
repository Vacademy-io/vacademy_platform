// Updated to support layout configuration

/**
 * A single tier in a quantity-based additional charge (e.g. shipping).
 * `maxQty: null` means unbounded (top tier — applies for all quantities >= minQty).
 * Each tier is backed by its own PaymentPlan in the DB so the backend can verify
 * `paid_amount == PaymentPlan.actualPrice`.
 */
export interface AdditionalChargeTier {
  minQty: number;
  maxQty: number | null;
  planId: string;
  amount: number;
}

/**
 * Charge added to checkout beyond the items themselves — e.g. shipping, security deposit.
 * Backed by a dedicated "internal" Package (`package_type` = `DELIVERY_CHARGE` /
 * `SECURITY_DEPOSIT`) so it flows through the same enroll/payment/invoice plumbing
 * as a regular purchase. Two pricing shapes:
 *   - `tiers[]` — quantity-dependent (cart picks the matching tier by total qty)
 *   - `planId + amount` — flat charge
 * `applicableTo` gates which cart mode the charge appears in: "COURSE" = buy mode,
 * "MEMBERSHIP" = rent mode. A charge can apply to one or both.
 */
export interface AdditionalCharge {
  key: string;
  label: string;
  applicableTo: ("COURSE" | "MEMBERSHIP")[];
  packageSessionId: string;
  enrollInviteId: string;
  paymentOptionId: string;
  tiers?: AdditionalChargeTier[];
  planId?: string;
  amount?: number;
  refundable?: boolean;
  description?: string;
}

export interface GlobalSettings {
  courseCatalogeType: {
    enabled: boolean;
    value: string
  };
  mode: "light" | "dark";
  fonts?: {
    enabled?: boolean,
    family?: string
  },
  compactness: "small" | "medium" | "large";
  audience: "children" | "adults" | "all";
  leadCollection: {
    enabled: boolean;
    mandatory: boolean;
    inviteLink: string | null;
    formStyle: {
      type: "single" | "multiStep";
      showProgress: boolean;
      progressType: "bar" | "dots" | "steps";
      transition: "slide" | "fade";
    };
    fields: Array<{
      name: string;
      label: string;
      type: "text" | "email" | "tel" | "chips" | "dropdown";
      required: boolean;
      step: number;
      options?: Array<{
        label: string;
        value: string;
        levelId?: string;
        packageSessionId?: string;
      }>;
      style?: {
        variant?: "filled" | "outlined";
        chipColor?: string;
        allowMultiple?: boolean;
      };
    }>;
  };
  enrquiry: {
    enabled: boolean;
    requirePayment: boolean;
  };
  payment: {
    enabled: boolean;
    provider: "razorpay" | "stripe" | "paypal" | "PHONEPE";
    fields: string[];
    additionalCharges?: AdditionalCharge[];
  };
  communityJoinLink?: string;
  layout?: {
    header?: {
      id: string;
      type: string;
      enabled: boolean;
      styles?: {
        enabled?: boolean;
      };
      props: {
        logo?: string;
        title?: string;
        // When true, header login/signup buttons open the AuthModal in-place
        // instead of navigating to /login or /signup. Default: false (navigate).
        useAuthModal?: boolean;
        navigation?: Array<{
          label: string;
          route: string;
          openInSameTab?: boolean;
        }>;
        authLinks?: Array<{
          label: string;
          route: string;
        }>;
      };
    };
    footer?: {
      id: string;
      type: string;
      enabled: boolean;
      styles?: {
        enabled?: boolean;
      };
      props: {
        layout: "two-column" | "three-column" | "four-column";
        leftSection: {
          title: string;
          text: string;
        };
        rightSections: Array<{
          title: string;
          links: Array<{
            label: string;
            route: string;
          }>;
        }>;
        bottomNote: string;
      };
    };
  };
}

export interface Page {
  id: string;
  route: string;
  title?: string;
  components: Component[];
}

export interface Component {
  id: string;
  type: string;
  enabled: boolean;
  props: Record<string, any>;
}

export interface IntroPage {
  enabled: boolean;
  fullScreen: boolean;
  showHeader: boolean;
  logo?: {
    height: string;
    alignment: "left" | "center" | "right";
  };
  imageSlider: {
    autoPlay: boolean;
    interval: number;
    images: Array<{
      source: string;
      caption: string;
    }>;
    styles: {
      height: string;
      objectFit: "contain" | "cover" | "fill" | "none" | "scale-down";
      transitionEffect: "fade" | "slide" | "zoom";
    };
  };
  actions: {
    alignment: "top" | "center" | "bottom" | "right" | "left";
    buttons: Array<{
      label: string;
      action: "loadNextSection" | "navigateToLogin" | "openLeadCollection";
      style: "primary" | "outlined" | "text";
    }>;
  };
  afterIntro: {
    action: "loadAllSections" | "navigateToCatalogue";
    target: string;
  };
}

export interface CourseCatalogueData {
  globalSettings: GlobalSettings;
  introPage?: IntroPage;
  pages: Page[];
}

// Component-specific prop interfaces
export interface HeaderProps {
  logoUrl: string;
  menus: Array<{
    label: string;
    link: string;
  }>;
  actionButton: {
    label: string;
    link: string;
  };
}

export interface BannerProps {
  title: string;
  media: {
    type: "image" | "video";
    url: string;
  };
  alignment: "left" | "center" | "right";
}

export interface CourseCatalogProps {
  title: string;
  showFilters: boolean;
  filtersConfig?: Array<{
    id: string;
    label: string;
    type: "dropdown" | "checkbox" | "range";
    field: string;
    default?: {
      min?: number;
      max?: number;
    };
  }>;
  cartButtonConfig?: {
    enabled?: boolean;
    showAddToCartButton?: boolean;
    showQuantitySelector?: boolean;
    quantityMin?: number;
  };
  render: {
    layout: "grid" | "list";
    cardFields: string[];
    styles?: {
      hoverEffect?: 'scale' | 'shadow' | string;
      roundedEdges?: boolean;
      backgroundColor?: string;
    };
  };
}

export interface CourseDetailsProps {
  showEnroll: boolean;
  showPayment: boolean;
  showEnquiry: boolean;
  fields: {
    title: string;
    description: string;
    whyLearn: string;
    whoShouldLearn: string;
    duration: string;
    level: string;
    tags: string;
    previewImage: string;
    banner: string;
    rating: string;
    price: string;
  };
  leadCollection?: {
    enabled: boolean;
    mandatory: boolean;
    inviteLink: string | null;
    formStyle: {
      type: "single" | "multiStep";
      showProgress: boolean;
      progressType: "bar" | "dots" | "steps";
      transition: "slide" | "fade";
    };
    fields: Array<{
      name: string;
      label: string;
      type: "text" | "email" | "tel" | "chips" | "dropdown";
      required: boolean;
      step: number;
      options?: Array<{
        label: string;
        value: string;
        levelId?: string;
        packageSessionId?: string;
      }>;
      style?: {
        variant?: "filled" | "outlined";
        chipColor?: string;
        allowMultiple?: boolean;
      };
    }>;
  };
  instituteId?: string;
  courseId?: string;
  courseData?: any;
}

export interface CourseRecommendationsProps {
  title: string;
  limit: number;
}

export interface FooterProps {
  layout: "two-column" | "three-column" | "four-column";
  leftSection: {
    title: string;
    text: string;
    socials?: Array<{
      platform: string;
      icon: string;
      url: string;
      openInSameTab?: boolean;
    }>;
  };
  rightSection1?: {
    title: string;
    links: Array<{
      label: string;
      route: string;
      openInSameTab?: boolean;
    }>;
  };
  rightSection2?: {
    title: string;
    links: Array<{
      label: string;
      route: string;
      openInSameTab?: boolean;
    }>;
  };
  rightSection3?: {
    title: string;
    links: Array<{
      label: string;
      route: string;
      openInSameTab?: boolean;
    }>;
  };
  // Legacy support for backward compatibility
  rightSections?: Array<{
    title: string;
    links: Array<{
      label: string;
      route: string;
    }>;
  }>;
  rightSection?: {
    title: string;
    links: Array<{
      label: string;
      route: string;
    }>;
  };
  socialsSection?: {
    title: string;
    links: Array<{
      platform: string;
      icon: string;
      url: string;
    }>;
  };
  bottomNote: string;
}

export interface CartComponentProps {
  showItemImage?: boolean;
  showItemTitle?: boolean;
  showItemLevel?: boolean;
  showQuantitySelector?: boolean;
  quantityMin?: number;
  showRemoveButton?: boolean;
  showPrice?: boolean;
  showEmptyState?: boolean;
  emptyStateMessage?: string;
  instituteId?: string;
  globalSettings?: GlobalSettings;
  styles?: {
    padding?: string;
    roundedEdges?: boolean;
    backgroundColor?: string;
  };
  onlyLogic?: boolean;
}

export interface CartSummaryProps {
  showSubtotal?: boolean;
  showTaxes?: boolean;
  showTotal?: boolean;
  checkoutButtonEnabled?: boolean;
  checkoutButtonLabel?: string;
  styles?: {
    padding?: string;
    roundedEdges?: boolean;
    backgroundColor?: string;
  };
}