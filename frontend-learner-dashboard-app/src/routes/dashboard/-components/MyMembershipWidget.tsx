import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getInstituteId } from "@/constants/helper";
import { GET_BATCH_LIST, urlPublicCourseDetails, urlInstituteDetails } from "@/constants/urls";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { cn } from "@/lib/utils";
import { Crown, BookOpen } from "lucide-react";

interface MyMembershipWidgetProps {
    className?: string;
}

export const MyMembershipWidget: React.FC<MyMembershipWidgetProps> = ({ className }) => {
    const [loading, setLoading] = useState(true);
    const [memberships, setMemberships] = useState<any[]>([]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const instituteId = await getInstituteId();
                if (!instituteId) return;

                // STEP 1: Fetch Institute details to find the "Plan" session
                const instResponse = await authenticatedAxiosInstance.get(`${urlInstituteDetails}/${instituteId}`);
                const sessions = instResponse.data?.sessions || [];
                const batchesForSessions = instResponse.data?.batches_for_sessions || [];

                // Only condition we care about: session_name === "Plan" (case-insensitive, trimmed)
                const planSession = sessions.find(
                    (s: any) => (s?.session_name || "").trim().toLowerCase() === "plan"
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
                    (batchesForSessions || [])
                        .filter((b: any) => b?.session?.id === planSessionId)
                        .map((b: any) => b?.id)
                        .filter(Boolean)
                        .forEach((id: string) => planPackageSessionIds.add(id));
                } else {
                    // Fallback mapping: batches-by-session API returns package_session_ids for a given sessionId
                    // This is required for institutes where details-non-batches returns batches_for_sessions: []
                    try {
                        const batchListResponse = await authenticatedAxiosInstance.get(GET_BATCH_LIST, {
                            params: { sessionId: planSessionId, instituteId },
                        });

                        const batchData = batchListResponse.data;
                        // Expected shapes seen in codebase: BatchData[] or { content: BatchData[] } etc.
                        const batchGroups: any[] =
                            (Array.isArray(batchData) ? batchData : batchData?.content) || [];

                        batchGroups.forEach((group: any) => {
                            const batches: any[] = Array.isArray(group?.batches) ? group.batches : [];
                            batches
                                .map((b: any) => b?.package_session_id)
                                .filter(Boolean)
                                .forEach((id: string) => planPackageSessionIds.add(id));
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

                const allContent = pkgResponse.data?.content || [];

                // STEP 4: Filter memberships by package_type "MEMBERSHIP" and package_session_id
                // Only show memberships that belong to the Plan session (using mapped package_session_ids)
                const filtered = allContent.filter((pkg: any) => {
                    // Only condition we care about: package_type === "MEMBERSHIP" (case-insensitive, trimmed)
                    const packageType = (pkg.package_type || "").trim().toUpperCase();
                    const pkgSessionId = pkg.package_session_id;
                    // Filter: Must be MEMBERSHIP type AND belong to one of the Plan session's mapped package_session_ids
                    return packageType === "MEMBERSHIP" && pkgSessionId && planPackageSessionIds.has(pkgSessionId);
                });

                const unique = filtered.filter((pkg: any, index: number, self: any[]) =>
                    index === self.findIndex((p) => p.package_name === pkg.package_name)
                );

                setMemberships(unique);
            } catch (error) {
                // Silently fail
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    if (loading) {
        return (
            <Card className={cn("border border-border shadow-sm bg-card", className)}>
                <CardHeader className="pb-2">
                    <Skeleton className="h-5 w-32" />
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-16 w-full rounded-lg" />
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className={cn("border border-border shadow-sm bg-card", className)}>
            <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-primary uppercase">
                    <Crown className="w-5 h-5" />
                    My Membership
                </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-3">
                {memberships.length > 0 ? (
                    memberships.map((membership, idx) => (
                        <div key={membership.id || idx} className="space-y-3">
                            {/* Membership Item */}
                            <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card shadow-sm">
                                <div className="flex-1 min-w-0 pr-2">
                                    <h3 className="font-bold text-base text-foreground truncate">
                                        {membership.package_name}
                                    </h3>
                                    <span className="text-[10px] text-primary/70 font-bold uppercase tracking-widest mt-0.5 inline-block">Plan Active</span>
                                </div>
                                <div className="flex flex-col items-center justify-center min-w-[50px] p-1.5 rounded-md bg-primary/5 border border-primary/10">
                                    <span className="text-lg font-bold text-primary leading-none">
                                        {membership.validity_in_days || 0}
                                    </span>
                                    <span className="text-[8px] font-bold text-primary/70 uppercase">Days Remaining</span>
                                </div>
                            </div>

                            {/* Sub-packages (Books) */}
                            {membership.child_packages && membership.child_packages.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                    {membership.child_packages.map((child: any, cidx: number) => (
                                        <div key={child.id || cidx} className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-secondary/50 border border-border">
                                            <BookOpen className="w-3 h-3 text-muted-foreground" />
                                            <span className="text-[11px] font-medium text-foreground truncate max-w-[120px]">
                                                {child.package_name}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))
                ) : (
                    <div className="py-4 px-3 rounded-lg border border-dashed border-border flex items-center justify-center">
                        <p className="text-sm text-muted-foreground italic">No active membership found.</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};
