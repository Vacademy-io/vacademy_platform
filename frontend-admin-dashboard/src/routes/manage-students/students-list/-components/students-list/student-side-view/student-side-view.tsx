import { getActiveRoleDisplaySettingsKey } from '@/lib/auth/instituteUtils';
import { Sidebar, SidebarContent, SidebarHeader } from '@/components/ui/sidebar';
import { useSidebar } from '@/components/ui/sidebar';
import { X } from '@phosphor-icons/react';
import { useState, useEffect, useRef } from 'react';
import DummyProfile from '@/assets/svgs/dummy_profile_photo.svg';
import { StatusChips } from '@/components/design-system/chips';
import { StudentOverview } from './student-overview/student-overview';
import { StudentCourses } from './student-courses/student-courses';
import { StudentLearningProgress } from './student-learning-progress/student-learning-progress';
import { StudentTestRecord } from './student-test-records/student-test-record';
import { StudentCommunicationTimeline } from './student-email-notifications/student-communication-timeline';
import { StudentMembership } from './student-membership/student-membership';
import { StudentUserTagging } from './student-user-tagging/student-user-tagging';
import { StudentFiles } from './student-files/student-files';
import { StudentPortalAccess } from './student-portal-access/student-portal-access';
import { StudentSubOrg } from './student-sub-org/student-sub-org';
import { StudentReports } from './student-reports/student-reports';
import { StudentEnrollDeroll } from './student-enroll-deroll/student-enroll-deroll';
import { StudentPaymentHistory } from './student-payment-history/student-payment-history';
import { StudentEnquiry } from './student-enquiry/student-enquiry';
import { StudentApplication } from './student-application/student-application';
import { StudentLeadProfile } from './student-lead-profile/student-lead-profile';
import { StudentFullHistory } from './student-full-history/student-full-history';
import { LeadFormResponseCard } from '@/routes/audience-manager/list/-components/campaign-users/lead-form-response-card';
import { useLeadSettings } from '@/hooks/use-lead-settings';
import { getPublicUrl } from '@/services/upload_file';
import { ErrorBoundary } from '@/components/core/dashboard-loader';
import { useStudentSidebar } from '../../../-context/selected-student-sidebar-context';
import {
    getTerminology,
    getTerminologyPlural,
} from '@/components/common/layout-container/sidebar/utils';
import { ContentTerms, RoleTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';
import { cn } from '@/lib/utils';
import {
    getDisplaySettingsWithFallback,
    getDisplaySettingsFromCache,
} from '@/services/display-settings';
import { type StudentSideViewSettings, type StudentSideViewTabId } from '@/types/display-settings';
import {
    TAB_ID_TO_VISIBILITY_KEY,
    STUDENT_SIDE_VIEW_TAB_LABELS as TAB_LABELS,
} from '@/constants/display-settings/student-side-view-tabs';

// Resolve which tab should open when the side view first renders. Honours
// the saved default tab when it's still visible, otherwise falls back to
// the first visible tab in the configured render order.
function resolveInitialCategory(settings: StudentSideViewSettings): StudentSideViewTabId {
    const orderedVisible = orderedVisibleTabIds(settings);
    if (settings.defaultTab && orderedVisible.includes(settings.defaultTab)) {
        return settings.defaultTab;
    }
    return orderedVisible[0] ?? 'overview';
}

// Tabs filtered by visibility flags and sorted by `tabOrders`. Tabs without
// an explicit order land at the end (preserving their declaration order).
function orderedVisibleTabIds(settings: StudentSideViewSettings): StudentSideViewTabId[] {
    const all: StudentSideViewTabId[] = [
        'overview',
        'courses',
        'learningProgress',
        'testRecord',
        'notifications',
        'membership',
        'paymentHistory',
        'userTagging',
        'files',
        'portalAccess',
        'reports',
        'enrollDeroll',
        'enquiry',
        'application',
        'lead',
        'fullHistory',
    ];
    const orders = settings.tabOrders ?? {};
    return all
        .filter((id) => {
            const flag = settings[TAB_ID_TO_VISIBILITY_KEY[id]];
            return flag === true;
        })
        .sort((a, b) => {
            const oa = orders[a] ?? Number.MAX_SAFE_INTEGER;
            const ob = orders[b] ?? Number.MAX_SAFE_INTEGER;
            return oa - ob;
        });
}

export const StudentSidebar = ({
    selectedTab,
    examType,
    isStudentList,
    isSubmissionTab,
    isEnrollRequestStudentList,
    enquiryId,
    applicantId,
    className,
    packageSessionId,
    defaultLeadProfile,
}: {
    selectedTab?: string;
    examType?: string;
    isStudentList?: boolean;
    isSubmissionTab?: boolean;
    isEnrollRequestStudentList?: boolean;
    enquiryId?: string;
    applicantId?: string;
    className?: string;
    packageSessionId?: string;
    /** Open the Lead Profile tab by default each time a lead is opened (lead lists). */
    defaultLeadProfile?: boolean;
}) => {
    const { state } = useSidebar();
    const [category, setCategory] = useState('overview');
    const { toggleSidebar } = useSidebar();
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [faceLoader, setFaceLoader] = useState(false);
    const { selectedStudent } = useStudentSidebar();
    const [tabSettings, setTabSettings] = useState<StudentSideViewSettings | null>(null);
    const tabContainerRef = useRef<HTMLDivElement>(null);
    const activeTabRef = useRef<HTMLButtonElement>(null);
    const leadSettings = useLeadSettings();

    useEffect(() => {
        if (state == 'expanded') {
            document.body.classList.add('sidebar-open');
        } else {
            document.body.classList.remove('sidebar-open');
        }

        // Cleanup on unmount
        return () => {
            document.body.classList.remove('sidebar-open');
        };
    }, [state]);

    useEffect(() => {
        const fetchTabSettings = async () => {
            const roleKey = getActiveRoleDisplaySettingsKey();

            // Try cache first
            const cachedSettings = getDisplaySettingsFromCache(roleKey);
            const settings =
                cachedSettings?.studentSideView ||
                (await getDisplaySettingsWithFallback(roleKey)).studentSideView;

            if (settings) {
                setTabSettings(settings);
                setCategory(resolveInitialCategory(settings));
            }
        };

        fetchTabSettings();
    }, []);

    // Default to enquiry tab when an enquiryId is passed in (e.g. from /enquiries route)
    // or application tab when applicantId is passed in (e.g. from /application route)
    useEffect(() => {
        if (applicantId && tabSettings?.applicationTab) {
            setCategory('application');
        } else if (enquiryId && tabSettings?.enquiryTab) {
            setCategory('enquiry');
        }
    }, [applicantId, enquiryId, tabSettings]);

    // Lead lists (Lead List / Recent Leads): open the Lead Profile tab by default
    // each time a lead is opened — but only when the lead tab is actually available.
    useEffect(() => {
        if (
            defaultLeadProfile &&
            selectedStudent?.user_id &&
            tabSettings?.leadTab &&
            !leadSettings.isLoading &&
            leadSettings.enabled
        ) {
            setCategory('lead');
        }
    }, [
        defaultLeadProfile,
        selectedStudent?.user_id,
        tabSettings,
        leadSettings.isLoading,
        leadSettings.enabled,
    ]);

    useEffect(() => {
        const fetchImageUrl = async () => {
            if (selectedStudent?.face_file_id) {
                try {
                    setFaceLoader(true);
                    const url = await getPublicUrl(selectedStudent.face_file_id);
                    setImageUrl(url);
                    setFaceLoader(false);
                } catch (error) {
                    console.error('Failed to fetch image URL:', error);
                    setFaceLoader(false);
                }
            } else {
                setImageUrl(null);
            }
        };

        fetchImageUrl();
    }, [selectedStudent, selectedStudent?.face_file_id]);

    // Auto-scroll active tab into view
    useEffect(() => {
        if (activeTabRef.current && tabContainerRef.current) {
            activeTabRef.current.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest',
                inline: 'center',
            });
        }
    }, [category]);

    return (
        <Sidebar side="right" className={cn('!top-14 md:!top-20', className)}>
            <SidebarContent
                className={`sidebar-content flex flex-col border-l border-neutral-200 bg-white text-neutral-700`}
            >
                <SidebarHeader className="sticky top-0 z-10 border-b border-neutral-100 bg-white/95 shadow-sm backdrop-blur-sm">
                    <div className="flex flex-col gap-2 px-3 pb-2 pt-0">
                        {/* Compact title row: label + avatar + name + status + close */}
                        <div className="flex items-center gap-2">
                            <div className="h-5 w-0.5 shrink-0 rounded-full bg-gradient-to-b from-primary-500 to-primary-400"></div>

                            <div className="group relative shrink-0">
                                <div className="relative flex size-7 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-neutral-100 to-neutral-200 ring-1 ring-primary-500/20 transition-all duration-300 group-hover:ring-primary-500/40">
                                    {faceLoader ? (
                                        <div className="size-3 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
                                    ) : imageUrl ? (
                                        <img
                                            src={imageUrl}
                                            alt="Profile"
                                            className="size-full object-cover"
                                        />
                                    ) : (
                                        <DummyProfile className="size-5 text-neutral-400" />
                                    )}
                                </div>
                                <div className="absolute -bottom-0.5 -right-0.5 size-2 rounded-full border-2 border-white bg-green-500"></div>
                            </div>

                            <div className="flex min-w-0 flex-1 flex-col leading-tight">
                                <span className="truncate text-xs font-medium uppercase tracking-wide text-neutral-500">
                                    {`${getTerminology(RoleTerms.Learner, SystemTerms.Learner)} Profile`}
                                </span>
                                {selectedStudent?.full_name && (
                                    <h2 className="truncate bg-gradient-to-r from-neutral-800 to-neutral-600 bg-clip-text text-sm font-semibold text-transparent">
                                        {selectedStudent.full_name}
                                    </h2>
                                )}
                            </div>

                            {selectedStudent?.status && (
                                <div className="shrink-0">
                                    <StatusChips status={selectedStudent.status} />
                                </div>
                            )}

                            <button
                                onClick={toggleSidebar}
                                className="group shrink-0 rounded-lg p-1 transition-all duration-300 hover:bg-gradient-to-r hover:from-red-50 hover:to-red-100 active:scale-95"
                                aria-label="Close"
                            >
                                <X className="size-4 text-neutral-500 transition-colors duration-200 group-hover:text-red-500" />
                            </button>
                        </div>

                        {/* Sub Organization and Roles Badges */}
                        {(selectedStudent?.sub_org_name ||
                            selectedStudent?.comma_separated_org_roles) && (
                            <div className="flex flex-wrap items-center gap-1.5">
                                {selectedStudent?.sub_org_name && (
                                    <div className="flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                                        <span>{selectedStudent.sub_org_name}</span>
                                    </div>
                                )}
                                {selectedStudent?.comma_separated_org_roles && (
                                    <>
                                        {selectedStudent.comma_separated_org_roles
                                            .split(',')
                                            .map((role, index) => (
                                                <div
                                                    key={index}
                                                    className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium capitalize text-amber-700"
                                                >
                                                    {role.trim().toLowerCase().replace(/_/g, ' ')}
                                                </div>
                                            ))}
                                    </>
                                )}
                            </div>
                        )}

                        {/* Enhanced tab navigation with modern design */}
                        {!isEnrollRequestStudentList && tabSettings && (
                            <div className="relative overflow-hidden rounded-lg bg-gradient-to-r from-neutral-50 to-neutral-100 p-0.5 shadow-inner">
                                {/* Scrollable tabs container */}
                                <div
                                    ref={tabContainerRef}
                                    className="scrollbar-hide flex gap-0.5 overflow-x-auto scroll-smooth"
                                >
                                    {orderedVisibleTabIds(tabSettings).map((tabId) => {
                                        // lead/fullHistory require the lead system to be enabled
                                        if (
                                            (tabId === 'lead' || tabId === 'fullHistory') &&
                                            (leadSettings.isLoading || !leadSettings.enabled)
                                        ) {
                                            return null;
                                        }
                                        const label =
                                            tabId === 'courses'
                                                ? getTerminologyPlural(
                                                      ContentTerms.Course,
                                                      SystemTerms.Course
                                                  )
                                                : TAB_LABELS[tabId];
                                        return (
                                            <button
                                                key={tabId}
                                                ref={category === tabId ? activeTabRef : null}
                                                className={`group relative z-10 shrink-0 whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium transition-all duration-200 ${
                                                    category === tabId
                                                        ? 'bg-white text-primary-500 shadow-sm'
                                                        : 'text-neutral-600 hover:text-neutral-800'
                                                }`}
                                                onClick={() => setCategory(tabId)}
                                            >
                                                {label}
                                            </button>
                                        );
                                    })}

                                    {/* SubOrg is shown alongside the configurable tabs whenever the
                                        student belongs to one — it has no settings flag of its own. */}
                                    {selectedStudent?.sub_org_name && (
                                        <button
                                            ref={category === 'subOrg' ? activeTabRef : null}
                                            className={`group relative z-10 shrink-0 whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium transition-all duration-200 ${
                                                category === 'subOrg'
                                                    ? 'bg-white text-primary-500 shadow-sm'
                                                    : 'text-neutral-600 hover:text-neutral-800'
                                            }`}
                                            onClick={() => setCategory('subOrg')}
                                        >
                                            SubOrg
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </SidebarHeader>

                <div className="flex-1 overflow-y-auto p-3">
                    {/* Audience-form responses card — only on the Lead tab.
                        Renders only when the side view was opened from a lead
                        row (campaign-users / recent-leads); manage-students
                        rows don't carry the attached metadata. */}
                    {category === 'lead' && <LeadFormResponseCard />}
                    <ErrorBoundary>
                        {category === 'courses' && tabSettings?.coursesTab && (
                            <StudentCourses
                                isSubmissionTab={isSubmissionTab}
                                packageSessionId={packageSessionId}
                            />
                        )}
                        {category === 'overview' && tabSettings?.overviewTab && (
                            <StudentOverview isSubmissionTab={isSubmissionTab} />
                        )}
                        {category === 'learningProgress' &&
                            tabSettings?.progressTab &&
                            !isEnrollRequestStudentList && (
                                <StudentLearningProgress isSubmissionTab={isSubmissionTab} />
                            )}
                        {category === 'testRecord' &&
                            tabSettings?.testTab &&
                            !isEnrollRequestStudentList && (
                                <StudentTestRecord
                                    selectedTab={selectedTab || ''}
                                    examType={examType || ''}
                                    isStudentList={isStudentList || false}
                                />
                            )}
                        {category === 'notifications' &&
                            tabSettings?.notificationTab &&
                            !isEnrollRequestStudentList && <StudentCommunicationTimeline />}
                        {category === 'membership' &&
                            tabSettings?.membershipTab &&
                            !isEnrollRequestStudentList && (
                                <StudentMembership isSubmissionTab={isSubmissionTab} />
                            )}
                        {category === 'paymentHistory' &&
                            tabSettings?.paymentHistoryTab &&
                            !isEnrollRequestStudentList && <StudentPaymentHistory />}
                        {category === 'userTagging' &&
                            tabSettings?.userTaggingTab &&
                            !isEnrollRequestStudentList && (
                                <StudentUserTagging isSubmissionTab={isSubmissionTab} />
                            )}
                        {category === 'files' &&
                            tabSettings?.fileTab &&
                            !isEnrollRequestStudentList && <StudentFiles />}
                        {category === 'portalAccess' &&
                            tabSettings?.portalAccessTab &&
                            !isEnrollRequestStudentList && (
                                <StudentPortalAccess isSubmissionTab={isSubmissionTab} />
                            )}
                        {category === 'subOrg' &&
                            selectedStudent?.sub_org_name &&
                            !isEnrollRequestStudentList && (
                                <StudentSubOrg isSubmissionTab={isSubmissionTab} />
                            )}
                        {category === 'reports' &&
                            tabSettings?.reportsTab &&
                            !isEnrollRequestStudentList && <StudentReports />}
                        {category === 'enrollDeroll' &&
                            tabSettings?.enrollDerollTab &&
                            !isEnrollRequestStudentList && <StudentEnrollDeroll />}
                        {category === 'enquiry' &&
                            tabSettings?.enquiryTab &&
                            !isEnrollRequestStudentList && <StudentEnquiry enquiryId={enquiryId} />}
                        {category === 'application' &&
                            tabSettings?.applicationTab &&
                            !isEnrollRequestStudentList && (
                                <StudentApplication applicantId={applicantId} />
                            )}
                        {category === 'lead' &&
                            tabSettings?.leadTab &&
                            !leadSettings.isLoading &&
                            leadSettings.enabled &&
                            !isEnrollRequestStudentList &&
                            selectedStudent?.user_id && (
                                <StudentLeadProfile userId={selectedStudent.user_id} />
                            )}
                        {category === 'fullHistory' &&
                            tabSettings?.fullHistoryTab &&
                            !leadSettings.isLoading &&
                            leadSettings.enabled &&
                            !isEnrollRequestStudentList &&
                            selectedStudent?.user_id && (
                                <StudentFullHistory studentUserId={selectedStudent.user_id} />
                            )}
                    </ErrorBoundary>
                </div>
            </SidebarContent>
        </Sidebar>
    );
};
