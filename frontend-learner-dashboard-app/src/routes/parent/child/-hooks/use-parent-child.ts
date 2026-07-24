// TanStack Query hooks for the "My Child" parent portal. Distinct query-key root
// ("parent-portal-monitor") so invalidation never touches the admissions portal's
// ["parent-portal"] cache. Relies on the global QueryClient defaults (staleTime 5m,
// gcTime 30m, retry 1); live-sessions overrides staleTime so "starting soon" isn't stale.

import { useQuery } from "@tanstack/react-query";
import {
  fetchParentSettings,
  fetchChildren,
  fetchChildOverview,
  fetchChildAttendance,
  fetchChildUpcomingSessions,
  fetchChildSubjectProgress,
  fetchChildAssessments,
  fetchChildInvoices,
  fetchChildBadges,
  fetchChildPoints,
  fetchChildCertificates,
  fetchChildReports,
} from "../-services/parent-portal-api";

export const parentPortalQueryKeys = {
  all: ["parent-portal-monitor"] as const,
  settings: () => [...parentPortalQueryKeys.all, "settings"] as const,
  children: () => [...parentPortalQueryKeys.all, "children"] as const,
  child: (id: string) => [...parentPortalQueryKeys.all, "child", id] as const,
  overview: (id: string) => [...parentPortalQueryKeys.child(id), "overview"] as const,
  attendance: (id: string, ps?: string) =>
    [...parentPortalQueryKeys.child(id), "attendance", ps ?? "primary"] as const,
  upcoming: (id: string, ps?: string) =>
    [...parentPortalQueryKeys.child(id), "upcoming", ps ?? "primary"] as const,
  progress: (id: string, ps?: string) =>
    [...parentPortalQueryKeys.child(id), "progress", ps ?? "primary"] as const,
  assessments: (id: string) => [...parentPortalQueryKeys.child(id), "assessments"] as const,
  invoices: (id: string) => [...parentPortalQueryKeys.child(id), "invoices"] as const,
  badges: (id: string) => [...parentPortalQueryKeys.child(id), "badges"] as const,
  points: (id: string) => [...parentPortalQueryKeys.child(id), "points"] as const,
  certificates: (id: string) => [...parentPortalQueryKeys.child(id), "certificates"] as const,
  reports: (id: string) => [...parentPortalQueryKeys.child(id), "reports"] as const,
};

export function useParentSettings() {
  return useQuery({
    queryKey: parentPortalQueryKeys.settings(),
    queryFn: fetchParentSettings,
  });
}

export function useChildren() {
  return useQuery({
    queryKey: parentPortalQueryKeys.children(),
    queryFn: fetchChildren,
  });
}

export function useChildOverview(childId: string | undefined) {
  return useQuery({
    queryKey: parentPortalQueryKeys.overview(childId ?? ""),
    queryFn: () => fetchChildOverview(childId!),
    enabled: !!childId,
  });
}

export function useChildAttendance(childId: string | undefined, packageSessionId?: string) {
  return useQuery({
    queryKey: parentPortalQueryKeys.attendance(childId ?? "", packageSessionId),
    queryFn: () => fetchChildAttendance(childId!, { packageSessionId }),
    enabled: !!childId,
  });
}

export function useChildUpcomingSessions(childId: string | undefined, packageSessionId?: string) {
  return useQuery({
    queryKey: parentPortalQueryKeys.upcoming(childId ?? "", packageSessionId),
    queryFn: () => fetchChildUpcomingSessions(childId!, packageSessionId),
    enabled: !!childId,
    staleTime: 60_000, // a "starting in 5 min" card must not be 5 minutes stale
  });
}

export function useChildSubjectProgress(childId: string | undefined, packageSessionId?: string) {
  return useQuery({
    queryKey: parentPortalQueryKeys.progress(childId ?? "", packageSessionId),
    queryFn: () => fetchChildSubjectProgress(childId!, packageSessionId),
    enabled: !!childId,
  });
}

export function useChildAssessments(childId: string | undefined) {
  return useQuery({
    queryKey: parentPortalQueryKeys.assessments(childId ?? ""),
    queryFn: () => fetchChildAssessments(childId!),
    enabled: !!childId,
  });
}

export function useChildInvoices(childId: string | undefined) {
  return useQuery({
    queryKey: parentPortalQueryKeys.invoices(childId ?? ""),
    queryFn: () => fetchChildInvoices(childId!),
    enabled: !!childId,
  });
}

export function useChildBadges(childId: string | undefined) {
  return useQuery({
    queryKey: parentPortalQueryKeys.badges(childId ?? ""),
    queryFn: () => fetchChildBadges(childId!),
    enabled: !!childId,
  });
}

export function useChildPoints(childId: string | undefined) {
  return useQuery({
    queryKey: parentPortalQueryKeys.points(childId ?? ""),
    queryFn: () => fetchChildPoints(childId!),
    enabled: !!childId,
  });
}

export function useChildCertificates(childId: string | undefined) {
  return useQuery({
    queryKey: parentPortalQueryKeys.certificates(childId ?? ""),
    queryFn: () => fetchChildCertificates(childId!),
    enabled: !!childId,
  });
}

export function useChildReports(childId: string | undefined) {
  return useQuery({
    queryKey: parentPortalQueryKeys.reports(childId ?? ""),
    queryFn: () => fetchChildReports(childId!),
    enabled: !!childId,
  });
}
