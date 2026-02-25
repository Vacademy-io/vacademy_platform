import {
  House,
  ClipboardText,
  CalendarCheck,
  GraduationCap,
  ShieldCheck,
  CurrencyDollar,
  Gauge,
} from "@phosphor-icons/react";

export type TabId =
  | "dashboard"
  | "application"
  | "schedule"
  | "admission"
  | "documents"
  | "payments"
  | "tracker";

export interface NavTab {
  id: TabId;
  label: string;
  icon: React.ElementType;
  mobileLabel: string;
  /** Canonical URL for this tab. */
  route: string;
}

export const NAV_TABS: NavTab[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: House,
    mobileLabel: "Home",
    route: "/parent/",
  },
  {
    id: "application",
    label: "Application",
    icon: ClipboardText,
    mobileLabel: "Apply",
    route: "/parent/application/",
  },
  {
    id: "schedule",
    label: "Interview & Tests",
    icon: CalendarCheck,
    mobileLabel: "Tests",
    route: "/parent/schedule/",
  },
  {
    id: "admission",
    label: "Admissions",
    icon: GraduationCap,
    mobileLabel: "Admission",
    route: "/parent/admission/",
  },
  {
    id: "documents",
    label: "Verification",
    icon: ShieldCheck,
    mobileLabel: "Verify",
    route: "/parent/documents/",
  },
  {
    id: "payments",
    label: "Payment",
    icon: CurrencyDollar,
    mobileLabel: "Pay",
    route: "/parent/payment/",
  },
  {
    id: "tracker",
    label: "Status",
    icon: Gauge,
    mobileLabel: "Status",
    route: "/parent/tracker/",
  },
];
