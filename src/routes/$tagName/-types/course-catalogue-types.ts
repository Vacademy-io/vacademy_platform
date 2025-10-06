// Updated to support layout configuration
export interface GlobalSettings {
  mode: "light" | "dark";
  compactness: "small" | "medium" | "large";
  audience: "children" | "adults" | "all";
  leadCollection: {
    enabled: boolean;
    mandatory: boolean;
    inviteLink: string;
    fields: string[];
  };
  enrollment: {
    enabled: boolean;
    requirePayment: boolean;
  };
  payment: {
    enabled: boolean;
    provider: "razorpay" | "stripe" | "paypal";
  };
  layout?: {
    header?: {
      id: string;
      type: string;
      props: {
        logo?: string;
        title?: string;
        navigation?: Array<{
          label: string;
          route: string;
        }>;
      };
    };
    footer?: {
      id: string;
      type: string;
      props: {
        text?: string;
        links?: Array<{
          label: string;
          route: string;
        }>;
      };
    };
  };
}

export interface Page {
  id: string;
  route: string;
  title: string;
  components: Component[];
}

export interface Component {
  id: string;
  type: string;
  props: Record<string, any>;
}

export interface CourseCatalogueData {
  globalSettings: GlobalSettings;
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
  filtersConfig: Array<{
    id: string;
    label: string;
    type: "dropdown" | "checkbox" | "range";
    field: string;
  }>;
  render: {
    layout: "grid" | "list";
    cardFields: string[];
  };
}

export interface CourseDetailsProps {
  showEnroll: boolean;
  showPayment: boolean;
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
}

export interface CourseRecommendationsProps {
  title: string;
  limit: number;
}

export interface FooterProps {
  description: string;
}
