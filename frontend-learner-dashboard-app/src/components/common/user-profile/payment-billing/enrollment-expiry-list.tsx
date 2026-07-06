import { useQuery } from "@tanstack/react-query";
import { format, differenceInCalendarDays } from "date-fns";
import { CalendarBlank, SpinnerGap, WarningCircle } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { fetchStudentDetails } from "@/services/studentDetails";
import type { Student } from "@/types/user/user-detail";

interface EnrollmentExpiryListProps {
  instituteId: string;
  userId: string;
}

interface EnrollmentRow {
  packageSessionId: string;
  title: string;
  subtitle: string;
  expiryDate: string | null;
  remainingDays: number | null;
}

const buildRows = (students: Student[]): EnrollmentRow[] => {
  return students
    .filter((s) => s.package_session_id)
    .map((s) => {
      const expiry = s.expiry_date ? new Date(s.expiry_date) : null;
      const validExpiry = expiry && !isNaN(expiry.getTime()) ? expiry : null;
      return {
        packageSessionId: s.package_session_id,
        title: s.package_name || "Enrolled Course",
        subtitle: [s.level_name, s.session_name].filter(Boolean).join(" - "),
        expiryDate: validExpiry ? format(validExpiry, "dd MMM yyyy") : null,
        remainingDays: validExpiry
          ? differenceInCalendarDays(validExpiry, new Date())
          : null,
      };
    });
};

/**
 * Lists every package session the learner is enrolled in with its access
 * expiry, sourced live from /learner/info/v1/details (one row per
 * enrollment, each carrying its own expiry_date).
 */
export const EnrollmentExpiryList = ({
  instituteId,
  userId,
}: EnrollmentExpiryListProps) => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["LEARNER_ENROLLMENT_EXPIRY", instituteId, userId],
    queryFn: async () => {
      const response = await fetchStudentDetails(instituteId, userId);
      const students: Student[] = Array.isArray(response?.data)
        ? response.data
        : [];
      return buildRows(students);
    },
    enabled: Boolean(instituteId && userId),
    staleTime: 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-gray-500">
        <SpinnerGap className="size-4 animate-spin" />
        Loading your enrollments...
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-danger-600">
        <WarningCircle className="size-4" />
        Could not load enrollment expiry details.
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <p className="py-4 text-sm text-gray-500">
        You are not enrolled in any courses yet.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-gray-100">
      {data.map((row) => {
        const expired = row.remainingDays !== null && row.remainingDays < 0;
        const expiringSoon =
          row.remainingDays !== null &&
          row.remainingDays >= 0 &&
          row.remainingDays <= 14;
        return (
          <li
            key={row.packageSessionId}
            className="flex items-center justify-between gap-3 py-3"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-gray-700">
                {row.title}
              </p>
              {row.subtitle && (
                <p className="truncate text-xs text-gray-500">
                  {row.subtitle}
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2 text-right">
              <CalendarBlank className="size-4 text-gray-400" />
              {row.expiryDate ? (
                <div>
                  <p
                    className={cn(
                      "text-sm font-medium",
                      expired
                        ? "text-danger-600"
                        : expiringSoon
                          ? "text-warning-600"
                          : "text-gray-700"
                    )}
                  >
                    {row.expiryDate}
                  </p>
                  <p className="text-xs text-gray-500">
                    {expired
                      ? "Expired"
                      : row.remainingDays === 0
                        ? "Expires today"
                        : `${row.remainingDays} days left`}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-gray-500">No expiry</p>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
};
