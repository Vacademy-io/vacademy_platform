// Updated to support layout configuration
export interface GlobalSettings {
  courseCatalogeType :{
        enabled: false,
         value: string
    };
  mode: "light" | "dark";
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
    provider: "razorpay" | "stripe" | "paypal";
    fields: string[];
  };
  layout?: {
    header?: {
      id: string;
      type: string;
      enabled: boolean;
      props: {
        logo?: string;
        title?: string;
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
    alignment: "top" | "center" | "bottom";
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
  styles?: {
    padding?: string;
    roundedEdges?: boolean;
    backgroundColor?: string;
  };
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