// Parent-portal ("My Child") API layer.
//
// Uses the shared authenticatedAxiosInstance — its interceptor attaches the JWT
// and the clientId / X-Institute-Id header, which is how the BFF derives the
// guardian and institute. We never send a parentUserId; the only id we pass is
// the childUserId, which the backend guard verifies is linked to the caller.

import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import {
  PARENT_PORTAL_SETTINGS,
  PARENT_PORTAL_CHILDREN,
  PARENT_PORTAL_CHILD_ATTENDANCE,
  PARENT_PORTAL_CHILD_INVOICES,
  PARENT_PORTAL_CHILD_BADGES,
  PARENT_PORTAL_CHILD_CERTIFICATES,
} from "@/constants/urls";
import { BASE_URL } from "@/constants/urls";
import type {
  ChildOverview,
  ParentChildSummary,
  ParentPortalSettings,
  IssuedCertificate,
  LearnerBadge,
  AttendanceReport,
  LiveSessionsGrouped,
  SubjectProgress,
  AssessmentHistory,
  ChildReportListItem,
} from "../-types/parent-child";

const PARENT_PORTAL_V1 = `${BASE_URL}/admin-core-service/parent-portal/v1`;

export async function fetchParentSettings(): Promise<ParentPortalSettings> {
  const { data } = await authenticatedAxiosInstance.get(PARENT_PORTAL_SETTINGS);
  return data;
}

export async function fetchChildren(): Promise<ParentChildSummary[]> {
  const { data } = await authenticatedAxiosInstance.get(PARENT_PORTAL_CHILDREN);
  return data ?? [];
}

export async function fetchChildOverview(childUserId: string): Promise<ChildOverview> {
  const { data } = await authenticatedAxiosInstance.get(
    `${PARENT_PORTAL_V1}/children/${childUserId}/overview`,
  );
  return data;
}

export async function fetchChildAttendance(
  childUserId: string,
  params?: { packageSessionId?: string; startDate?: string; endDate?: string },
): Promise<AttendanceReport> {
  const { data } = await authenticatedAxiosInstance.get(
    PARENT_PORTAL_CHILD_ATTENDANCE(childUserId),
    { params },
  );
  return data;
}

export async function fetchChildUpcomingSessions(
  childUserId: string,
  packageSessionId?: string,
): Promise<LiveSessionsGrouped> {
  const { data } = await authenticatedAxiosInstance.get(
    `${PARENT_PORTAL_V1}/children/${childUserId}/live-sessions/upcoming`,
    { params: { packageSessionId } },
  );
  return data ?? [];
}

export async function fetchChildSubjectProgress(
  childUserId: string,
  packageSessionId?: string,
): Promise<SubjectProgress> {
  const { data } = await authenticatedAxiosInstance.get(
    `${PARENT_PORTAL_V1}/children/${childUserId}/progress/subjects`,
    { params: { packageSessionId } },
  );
  return data ?? [];
}

export async function fetchChildAssessments(
  childUserId: string,
  params?: { startDate?: string; endDate?: string },
): Promise<AssessmentHistory> {
  const { data } = await authenticatedAxiosInstance.get(
    `${PARENT_PORTAL_V1}/children/${childUserId}/assessments`,
    { params },
  );
  return data ?? null;
}

export async function fetchChildInvoices(childUserId: string): Promise<Record<string, unknown>[]> {
  const { data } = await authenticatedAxiosInstance.get(
    PARENT_PORTAL_CHILD_INVOICES(childUserId),
  );
  return data ?? [];
}

export async function fetchChildBadges(childUserId: string): Promise<LearnerBadge[]> {
  const { data } = await authenticatedAxiosInstance.get(
    PARENT_PORTAL_CHILD_BADGES(childUserId),
  );
  return data ?? [];
}

export async function fetchChildCertificates(childUserId: string): Promise<IssuedCertificate[]> {
  const { data } = await authenticatedAxiosInstance.get(
    PARENT_PORTAL_CHILD_CERTIFICATES(childUserId),
  );
  return data ?? [];
}

export async function fetchChildReports(childUserId: string): Promise<ChildReportListItem[]> {
  const { data } = await authenticatedAxiosInstance.get(
    `${PARENT_PORTAL_V1}/children/${childUserId}/reports`,
  );
  return data ?? [];
}

export interface ChildReportDetail {
  process_id: string;
  status: string;
  report_version?: string;
  comprehensive_report?: unknown;
  report?: unknown;
  error_message?: string;
}

/**
 * Fetch a single staff-generated report. Uses the general student-analysis endpoint,
 * which is parent-accessible via the canAccess() guardian link leg (the guard verifies
 * the report's subject is the caller's linked child).
 */
export async function fetchChildReportDetail(processId: string): Promise<ChildReportDetail> {
  const { data } = await authenticatedAxiosInstance.get(
    `${BASE_URL}/admin-core-service/v1/student-analysis/report/${processId}`,
  );
  return data;
}
