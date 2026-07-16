import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getInstituteId } from "@/constants/helper";
import { GET_BATCH_LIST, urlPublicCourseDetails, urlInstituteDetails } from "@/constants/urls";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { cn } from "@/lib/utils";
import { Crown, BookOpen } from "@phosphor-icons/react";
import { useCleanerPlayTheme } from "@/hooks/use-cleaner-play-theme";
import iconShop from "@/assets/cleaner-play/icon-shop.webp";
import { shouldHidePaidPurchaseUI } from "@/utils/ios-iap-compliance";

interface MyMembershipWidgetProps {
    className?: string;
}

interface InstituteSession {
    id: string;
    session_name?: string;
}

interface BatchForSession {
    id?: string;
    session?: { id?: string } | null;
}

interface BatchGroup {
    batches?: { package_session_id?: string }[];
}

interface MembershipPackage {
    id?: string;
    package_name?: string;
    package_type?: string;
    package_session_id?: string;
    validity_in_days?: number;
    child_packages?: { id?: string; package_name?: string }[] | null;
}

export const MyMembershipWidget: React.FC<MyMembershipWidgetProps> = ({ className }) => {
    const isCleanerPlay = useCleanerPlayTheme();
    const [loading, setLoading] = useState(true);
    const [memberships, setMemberships] = useState<MembershipPackage[]>([]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const instituteId = await getInstituteId();
                if (!instituteId) return;

                // STEP 1: Fetch Institute details to find the "Plan" session
                const instResponse = await authenticatedAxiosInstance.get(`${urlInstituteDetails}/${instituteId}`);
                const sessions: InstituteSession[] = instResponse.data?.sessions || [];
                const batchesForSessions: BatchForSession[] =
                    instResponse.data?.batches_for_sessions || [];

                // Only condition we care about: session_name === "Plan" (case-insensitive, trimmed)
                const planSession = sessions.find(
                    (s) => (s?.session_name || "").trim().toLowerCase() === "plan"
                );

                if (!planSession) {
                    setLoading(false);
                    return;
                }

                // STEP 2: Map session_id to package_session_id
                // IMPORTANT: `session_id` (from institute sessions) ≠ `package_session_id` (from package_session table)
                // The `batches_for_sessions` array represents the package_session table data where:
                //   - batch.id = package_session_id (from DB table package_session)
                //   - batch.session.id = session_id (from DB table session)
                // We need to find all package_session_ids that correspond to the Plan session_id
                const planSessionId = planSession.id;

                const planPackageSessionIds = new Set<string>();

                // Preferred mapping: from institute details (if backend provides it)
                if (Array.isArray(batchesForSessions) && batchesForSessions.length > 0) {
                    batchesForSessions
                        .filter((b) => b?.session?.id === planSessionId)
                        .forEach((b) => {
                            if (b?.id) planPackageSessionIds.add(b.id);
                        });
                } else {
                    // Fallback mapping: batches-by-session API returns package_session_ids for a given sessionId
                    // This is required for institutes where details-non-batches returns batches_for_sessions: []
                    try {
                        const batchListResponse = await authenticatedAxiosInstance.get(GET_BATCH_LIST, {
                            params: { sessionId: planSessionId, instituteId },
                        });

                        const batchData = batchListResponse.data;
                        // Expected shapes seen in codebase: BatchData[] or { content: BatchData[] } etc.
                        const batchGroups: BatchGroup[] =
                            (Array.isArray(batchData) ? batchData : batchData?.content) || [];

                        batchGroups.forEach((group) => {
                            const batches = Array.isArray(group?.batches) ? group.batches : [];
                            batches.forEach((b) => {
                                if (b?.package_session_id) {
                                    planPackageSessionIds.add(b.package_session_id);
                                }
                            });
                        });
                    } catch {
                        // Silent fallback failure
                    }
                }

                // If no package_session_ids found for Plan session, exit early
                if (planPackageSessionIds.size === 0) {
                    setLoading(false);
                    return;
                }

                // STEP 3: Fetch Packages
                const pkgResponse = await authenticatedAxiosInstance.post(
                    urlPublicCourseDetails,
                    {
                        status: [],
                        level_ids: [],
                        faculty_ids: [],
                        search_by_name: "",
                        tag: [],
                        min_percentage_completed: 0,
                        max_percentage_completed: 0,
                        type: "PROGRESS",
                        sort_columns: { createdAt: "DESC" },
                    },
                    {
                        params: { instituteId, page: 0, size: 100 },
                    }
                );

                const allContent: MembershipPackage[] = pkgResponse.data?.content || [];

                // STEP 4: Filter memberships by package_type "MEMBERSHIP" and package_session_id
                // Only show memberships that belong to the Plan session (using mapped package_session_ids)
                const filtered = allContent.filter((pkg) => {
                    // Only condition we care about: package_type === "MEMBERSHIP" (case-insensitive, trimmed)
                    const packageType = (pkg.package_type || "").trim().toUpperCase();
                    const pkgSessionId = pkg.package_session_id;
                    // Filter: Must be MEMBERSHIP type AND belong to one of the Plan session's mapped package_session_ids
                    return packageType === "MEMBERSHIP" && pkgSessionId && planPackageSessionIds.has(pkgSessionId);
                });

                const unique = filtered.filter(
                    (pkg, index, self) =>
                        index === self.findIndex((p) => p.package_name === pkg.package_name)
                );

                setMemberships(unique);
            } catch {
                // Silently fail
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    // Reader mode: "My Membership" + "Plan Active" + "Days Remaining" reads as a
    // paid subscription status to App Review (Apple 3.1.1) — hide it entirely.
    if (shouldHidePaidPurchaseUI()) {
        return null;
    }

    if (loading) {
        return (
            <Card className={cn("border border-border shadow-sm bg-card", "cp-card", className)}>
                <CardHeader className="pb-2">
                    <Skeleton className="h-5 w-32" />
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-16 w-full rounded-lg" />
                </CardContent>
            </Card>
        );
    }

    // Settled and empty: render nothing instead of an empty commerce shell
    if (memberships.length === 0) {
        return null;
    }

    return (
        <Card className={cn("border border-border shadow-sm bg-card", "cp-card", className)}>
            <CardHeader className="p-4 pb-2">
                <CardTitle className={cn(
                    "text-sm font-bold flex items-center gap-2 text-primary uppercase",
                    "cp-heading [.ui-cleaner-play_&]:normal-case"
                )}>
                    {isCleanerPlay ? (
                        <img src={iconShop} alt="" aria-hidden="true" className="h-9 w-9 object-contain" />
                    ) : (
                        <Crown className="w-5 h-5" />
                    )}
                    My Membership
                </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-3">
                {memberships.map((membership, idx) => (
                        <div key={membership.id || idx} className="space-y-3">
                            {/* Membership Item */}
                            <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card shadow-sm">
                                <div className="flex-1 min-w-0 pr-2">
                                    <h3 className="font-bold text-base text-foreground truncate">
                                        {membership.package_name}
                                    </h3>
                                    <span className="text-caption text-primary/70 font-bold uppercase tracking-widest mt-0.5 inline-block">Plan Active</span>
                                </div>
                                <div className="flex flex-col items-center justify-center min-w-12 p-1.5 rounded-md bg-primary/5 border border-primary/10">
                                    <span className="text-lg font-bold text-primary leading-none">
                                        {membership.validity_in_days || 0}
                                    </span>
                                    <span className="text-caption font-bold text-primary/70 uppercase">Days Remaining</span>
                                </div>
                            </div>

                            {/* Sub-packages (Books) */}
                            {membership.child_packages && membership.child_packages.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                    {membership.child_packages.map((child, cidx) => (
                                        <div key={child.id || cidx} className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-secondary/50 border border-border">
                                            <BookOpen className="w-3 h-3 text-muted-foreground" />
                                            <span className="text-caption font-medium text-foreground truncate max-w-32">
                                                {child.package_name}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                    </div>
                ))}
            </CardContent>
        </Card>
    );
};
