// ─────────────────────────────────────────────────────────────
// Parent Portal — Zustand State Store
// ─────────────────────────────────────────────────────────────

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type {
  ChildProfile,
  AdmissionOverview,
  RegistrationFormData,
  PaymentSummary,
  PaymentTransaction,
  DocumentListResponse,
  ParentNotification,
  AdmissionTimelineEvent,
  InterviewSchedule,
  AssessmentSchedule,
} from "@/types/parent-portal";

// ── Store Shape ────────────────────────────────────────────────

interface ParentPortalState {
  // Children
  children: ChildProfile[];
  selectedChild: ChildProfile | null;
  isLoadingChildren: boolean;

  // Admission overview
  admissionOverview: AdmissionOverview | null;
  timeline: AdmissionTimelineEvent[];
  isLoadingOverview: boolean;

  // Registration
  registrationForm: RegistrationFormData | null;
  currentSection: number;
  isLoadingRegistration: boolean;
  isSavingRegistration: boolean;

  // Interview & Assessment
  interview: InterviewSchedule | null;
  assessment: AssessmentSchedule | null;

  // Payments
  paymentSummary: PaymentSummary | null;
  paymentHistory: PaymentTransaction[];
  isLoadingPayments: boolean;

  // Documents
  documents: DocumentListResponse | null;
  isLoadingDocuments: boolean;
  isUploadingDocument: boolean;

  // Notifications
  notifications: ParentNotification[];
  unreadCount: number;

  // Global
  error: string | null;

  // ── Actions ──────────────────────────────────────────────────

  // Children
  setChildren: (children: ChildProfile[]) => void;
  selectChild: (child: ChildProfile | null) => void;
  setLoadingChildren: (loading: boolean) => void;

  // Admission
  setAdmissionOverview: (overview: AdmissionOverview | null) => void;
  setTimeline: (timeline: AdmissionTimelineEvent[]) => void;
  setLoadingOverview: (loading: boolean) => void;

  // Registration
  setRegistrationForm: (form: RegistrationFormData | null) => void;
  setCurrentSection: (section: number) => void;
  setLoadingRegistration: (loading: boolean) => void;
  setSavingRegistration: (saving: boolean) => void;
  updateFieldValue: (
    sectionId: string,
    fieldId: string,
    value: string | string[]
  ) => void;

  // Interview & Assessment
  setInterview: (interview: InterviewSchedule | null) => void;
  setAssessment: (assessment: AssessmentSchedule | null) => void;

  // Payments
  setPaymentSummary: (summary: PaymentSummary | null) => void;
  setPaymentHistory: (history: PaymentTransaction[]) => void;
  setLoadingPayments: (loading: boolean) => void;

  // Documents
  setDocuments: (docs: DocumentListResponse | null) => void;
  setLoadingDocuments: (loading: boolean) => void;
  setUploadingDocument: (uploading: boolean) => void;

  // Notifications
  setNotifications: (notifications: ParentNotification[]) => void;
  markNotificationRead: (notificationId: string) => void;

  // Global
  setError: (error: string | null) => void;
  resetChildState: () => void;
  resetAll: () => void;
}

// ── Initial Child-Scoped State ─────────────────────────────────

const initialChildState = {
  admissionOverview: null,
  timeline: [],
  isLoadingOverview: false,
  registrationForm: null,
  currentSection: 0,
  isLoadingRegistration: false,
  isSavingRegistration: false,
  interview: null,
  assessment: null,
  paymentSummary: null,
  paymentHistory: [],
  isLoadingPayments: false,
  documents: null,
  isLoadingDocuments: false,
  isUploadingDocument: false,
};

// ── Store ──────────────────────────────────────────────────────

export const useParentPortalStore = create<ParentPortalState>()(
  devtools(
    (set) => ({
      // Initial state
      children: [],
      selectedChild: null,
      isLoadingChildren: false,
      ...initialChildState,
      notifications: [],
      unreadCount: 0,
      error: null,

      // ── Children Actions ──────────────────────────────────
      setChildren: (children) =>
        set({ children }, false, "setChildren"),

      selectChild: (child) =>
        set(
          { selectedChild: child, ...initialChildState },
          false,
          "selectChild"
        ),

      setLoadingChildren: (loading) =>
        set({ isLoadingChildren: loading }, false, "setLoadingChildren"),

      // ── Admission Actions ─────────────────────────────────
      setAdmissionOverview: (overview) =>
        set({ admissionOverview: overview }, false, "setAdmissionOverview"),

      setTimeline: (timeline) =>
        set({ timeline }, false, "setTimeline"),

      setLoadingOverview: (loading) =>
        set({ isLoadingOverview: loading }, false, "setLoadingOverview"),

      // ── Registration Actions ──────────────────────────────
      setRegistrationForm: (form) =>
        set({ registrationForm: form }, false, "setRegistrationForm"),

      setCurrentSection: (section) =>
        set({ currentSection: section }, false, "setCurrentSection"),

      setLoadingRegistration: (loading) =>
        set({ isLoadingRegistration: loading }, false, "setLoadingRegistration"),

      setSavingRegistration: (saving) =>
        set({ isSavingRegistration: saving }, false, "setSavingRegistration"),

      updateFieldValue: (sectionId, fieldId, value) =>
        set(
          (state) => {
            if (!state.registrationForm) return state;
            const sections = state.registrationForm.sections.map((section) => {
              if (section.id !== sectionId) return section;
              return {
                ...section,
                fields: section.fields.map((field) =>
                  field.id === fieldId ? { ...field, value, error: undefined } : field
                ),
              };
            });
            return {
              registrationForm: { ...state.registrationForm, sections },
            };
          },
          false,
          "updateFieldValue"
        ),

      // ── Interview & Assessment Actions ────────────────────
      setInterview: (interview) =>
        set({ interview }, false, "setInterview"),

      setAssessment: (assessment) =>
        set({ assessment }, false, "setAssessment"),

      // ── Payment Actions ───────────────────────────────────
      setPaymentSummary: (summary) =>
        set({ paymentSummary: summary }, false, "setPaymentSummary"),

      setPaymentHistory: (history) =>
        set({ paymentHistory: history }, false, "setPaymentHistory"),

      setLoadingPayments: (loading) =>
        set({ isLoadingPayments: loading }, false, "setLoadingPayments"),

      // ── Document Actions ──────────────────────────────────
      setDocuments: (docs) =>
        set({ documents: docs }, false, "setDocuments"),

      setLoadingDocuments: (loading) =>
        set({ isLoadingDocuments: loading }, false, "setLoadingDocuments"),

      setUploadingDocument: (uploading) =>
        set({ isUploadingDocument: uploading }, false, "setUploadingDocument"),

      // ── Notification Actions ──────────────────────────────
      setNotifications: (notifications) =>
        set(
          {
            notifications,
            unreadCount: notifications.filter((n) => !n.is_read).length,
          },
          false,
          "setNotifications"
        ),

      markNotificationRead: (notificationId) =>
        set(
          (state) => {
            const notifications = state.notifications.map((n) =>
              n.id === notificationId ? { ...n, is_read: true } : n
            );
            return {
              notifications,
              unreadCount: notifications.filter((n) => !n.is_read).length,
            };
          },
          false,
          "markNotificationRead"
        ),

      // ── Global Actions ────────────────────────────────────
      setError: (error) => set({ error }, false, "setError"),

      resetChildState: () =>
        set(initialChildState, false, "resetChildState"),

      resetAll: () =>
        set(
          {
            children: [],
            selectedChild: null,
            isLoadingChildren: false,
            ...initialChildState,
            notifications: [],
            unreadCount: 0,
            error: null,
          },
          false,
          "resetAll"
        ),
    }),
    { name: "ParentPortalStore" }
  )
);
