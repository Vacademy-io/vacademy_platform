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
  /**
   * Step-by-step Level → Session → Tag picker shown once, the first time a
   * visitor opens this catalogue page, before any course grid is filtered.
   * Options are sourced live from whichever `courseCatalog` block(s) are on
   * the page (via a `courseFinderOptionsReady` event) — never a separate
   * fetch — so a pick can never reference a level/session/tag that has zero
   * matching courses. `steps` controls which of the three are asked at all,
   * in that fixed order.
   */
  courseFinder?: {
    enabled: boolean;
    steps: Array<"level" | "session" | "tag">;
    mandatory: boolean;
    /**
     * Per-catalogue text override for a step's title, bypassing Naming
     * Settings. Stopgap for institutes whose Naming Settings rename hasn't
     * reached this pre-login page yet (see use-domain-routing.ts) — prefer
     * Naming Settings once that gap is closed, since a value set here won't
     * follow a later rename there.
     */
    stepLabels?: Partial<Record<"level" | "session" | "tag", string>>;
    /**
     * Institute-specific grouping for the Level step, e.g. this institute's
     * real level values are "Mathematics Class 5", "Science Class 5", etc.
     * (subject baked into the level name) — this maps a clean group label
     * ("Class 5") to every raw level value it should stand in for. The
     * wizard shows the group labels; picking one expands to every raw value
     * in its list before filtering, so CourseCatalogComponent's exact-match
     * level filter needs no changes. Falls back to the raw (ungrouped) level
     * list when absent.
     */
    levelGroups?: Record<string, string[]>;
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

/** Sort modes offered by the catalogue's sort dropdown. The value stored in the
 *  catalogue JSON is the label itself, so what an admin picks in the page
 *  builder is exactly what a learner sees selected. */
export const COURSE_CATALOG_SORT_OPTIONS = [
  "Newest",
  "Oldest",
  "Price: Low to High",
  "Price: High to Low",
  "Rating",
  "Name A-Z",
  "Name Z-A",
] as const;

export type CourseCatalogSortOption =
  (typeof COURSE_CATALOG_SORT_OPTIONS)[number];

/** Sort used when a catalogue does not pin one — preserves the historic order. */
export const DEFAULT_COURSE_CATALOG_SORT: CourseCatalogSortOption = "Newest";

export interface CourseCatalogProps {
  title: string;
  showFilters: boolean;
  /** Sort applied on first render. Set this to "Price: Low to High" to lead
   *  with free courses (price 0 sorts first) ahead of the cheapest paid ones.
   *  Unset or unrecognised falls back to DEFAULT_COURSE_CATALOG_SORT; either
   *  way the learner can still change the sort from the dropdown. */
  defaultSort?: CourseCatalogSortOption;
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