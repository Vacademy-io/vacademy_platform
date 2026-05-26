/**
 * StudentProfileOverlay — the "full profile" surface.
 *
 * A large centered dialog (~90vw × 90vh) launched from either the side drawer's
 * "Expand" button OR a row-level expand button. Gives the same data far more
 * room to breathe than the ~400px drawer can — hero band on top, vertical
 * section nav on the left, scrollable content panel on the right.
 *
 * Renders the exact same tab body components as the drawer (StudentOverview,
 * StudentCourses, etc.) so there is one source of truth for what each section
 * shows; only the layout differs.
 */
import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useStudentSidebar } from '@/routes/manage-students/students-list/-context/selected-student-sidebar-context';
import {
    X,
    ArrowsInSimple,
    User,
    BookOpen,
    ChartLineUp,
    Exam,
    Receipt,
    Key,
    EnvelopeSimple,
    Tag,
    Folder,
    Buildings,
    FileMagnifyingGlass,
    UserSwitch,
    ClipboardText,
    Crosshair,
    ClockCounterClockwise,
    Crown,
    type Icon as PhosphorIcon,
} from '@phosphor-icons/react';
import { StatusChips } from '@/components/design-system/chips';
import { cn } from '@/lib/utils';
import DummyProfile from '@/assets/svgs/dummy_profile_photo.svg';
import { getPublicUrl } from '@/services/upload_file';
import {
    getDisplaySettingsWithFallback,
    getDisplaySettingsFromCache,
} from '@/services/display-settings';
import { type StudentSideViewSettings, type StudentSideViewTabId } from '@/types/display-settings';
import {
    TAB_ID_TO_VISIBILITY_KEY,
    STUDENT_SIDE_VIEW_TAB_LABELS as TAB_LABELS,
} from '@/constants/display-settings/student-side-view-tabs';
import { getActiveRoleDisplaySettingsKey } from '@/lib/auth/instituteUtils';
import { useLeadSettings } from '@/hooks/use-lead-settings';
import {
    getTerminology,
    getTerminologyPlural,
} from '@/components/common/layout-container/sidebar/utils';
import { ContentTerms, RoleTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';
import { ProfileQuickContact, ProfileContextStrip, type ContextStripItem } from './profile-ui';

// Tab body components — same source of truth used by the drawer.
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

type SectionId = StudentSideViewTabId | 'subOrg';

// Icon per section — duotone in nav, plain elsewhere.
const SECTION_ICONS: Record<SectionId, PhosphorIcon> = {
    overview: User,
    courses: BookOpen,
    learningProgress: ChartLineUp,
    testRecord: Exam,
    notifications: EnvelopeSimple,
    membership: Crown,
    paymentHistory: Receipt,
    userTagging: Tag,
    files: Folder,
    portalAccess: Key,
    reports: FileMagnifyingGlass,
    enrollDeroll: UserSwitch,
    enquiry: ClipboardText,
    application: ClipboardText,
    lead: Crosshair,
    fullHistory: ClockCounterClockwise,
    subOrg: Buildings,
};

// Stable section order — mirrors the drawer's orderedVisibleTabIds but kept
// local so the overlay nav order is predictable.
const DEFAULT_ORDER: StudentSideViewTabId[] = [
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

function orderedVisibleSectionIds(settings: StudentSideViewSettings): StudentSideViewTabId[] {
    const orders = settings.tabOrders ?? {};
    return DEFAULT_ORDER.filter((id) => {
        const flag = settings[TAB_ID_TO_VISIBILITY_KEY[id]];
        return flag === true;
    }).sort((a, b) => {
        const oa = orders[a] ?? Number.MAX_SAFE_INTEGER;
        const ob = orders[b] ?? Number.MAX_SAFE_INTEGER;
        return oa - ob;
    });
}

function resolveInitialSection(settings: StudentSideViewSettings): StudentSideViewTabId {
    const visible = orderedVisibleSectionIds(settings);
    if (settings.defaultTab && visible.includes(settings.defaultTab)) {
        return settings.defaultTab;
    }
    return visible[0] ?? 'overview';
}

export const StudentProfileOverlay = () => {
    const { selectedStudent, isOverlayOpen, closeOverlay } = useStudentSidebar();
    const leadSettings = useLeadSettings();
    const [tabSettings, setTabSettings] = useState<StudentSideViewSettings | null>(null);
    const [activeSection, setActiveSection] = useState<SectionId>('overview');
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [faceLoader, setFaceLoader] = useState(false);
    const contentScrollRef = useRef<HTMLDivElement>(null);

    // Load display settings (which sections are visible + order) when the overlay opens.
    useEffect(() => {
        if (!isOverlayOpen) return;
        let cancelled = false;
        (async () => {
            const roleKey = getActiveRoleDisplaySettingsKey();
            const cached = getDisplaySettingsFromCache(roleKey);
            const settings =
                cached?.studentSideView ||
                (await getDisplaySettingsWithFallback(roleKey)).studentSideView;
            if (!cancelled && settings) {
                setTabSettings(settings);
                setActiveSection(resolveInitialSection(settings));
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [isOverlayOpen]);

    // Face image loading — mirrors the drawer's behavior.
    useEffect(() => {
        if (!isOverlayOpen) return;
        const fileId = selectedStudent?.face_file_id;
        if (!fileId) {
            setImageUrl(null);
            return;
        }
        let cancelled = false;
        setFaceLoader(true);
        getPublicUrl(fileId)
            .then((url) => {
                if (!cancelled) setImageUrl(url);
            })
            .finally(() => {
                if (!cancelled) setFaceLoader(false);
            });
        return () => {
            cancelled = true;
        };
    }, [isOverlayOpen, selectedStudent?.face_file_id]);

    // Reset scroll to top whenever the user picks a new section.
    useEffect(() => {
        if (contentScrollRef.current) contentScrollRef.current.scrollTop = 0;
    }, [activeSection]);

    if (!selectedStudent) return null;

    const visibleIds = tabSettings ? orderedVisibleSectionIds(tabSettings) : [];

    const renderSection = (id: SectionId) => {
        switch (id) {
            case 'overview':
                return <StudentOverview />;
            case 'courses':
                return <StudentCourses />;
            case 'learningProgress':
                return <StudentLearningProgress />;
            case 'testRecord':
                return <StudentTestRecord selectedTab={undefined} examType={undefined} />;
            case 'notifications':
                return <StudentCommunicationTimeline />;
            case 'membership':
                return <StudentMembership />;
            case 'paymentHistory':
                return <StudentPaymentHistory />;
            case 'userTagging':
                return <StudentUserTagging />;
            case 'files':
                return <StudentFiles />;
            case 'portalAccess':
                return <StudentPortalAccess />;
            case 'reports':
                return <StudentReports />;
            case 'enrollDeroll':
                return <StudentEnrollDeroll />;
            case 'enquiry':
                return <StudentEnquiry />;
            case 'application':
                return <StudentApplication />;
            case 'lead':
                return <StudentLeadProfile userId={selectedStudent.user_id || selectedStudent.id} />;
            case 'fullHistory':
                return (
                    <StudentFullHistory
                        studentUserId={selectedStudent.user_id || selectedStudent.id}
                    />
                );
            case 'subOrg':
                return <StudentSubOrg />;
            default:
                return null;
        }
    };

    const sectionLabel = (id: SectionId): string => {
        if (id === 'subOrg') return 'Sub-Org';
        if (id === 'courses') return getTerminologyPlural(ContentTerms.Course, SystemTerms.Course);
        return TAB_LABELS[id];
    };

    return (
        <Dialog open={isOverlayOpen} onOpenChange={(open) => !open && closeOverlay()}>
            <DialogContent
                /* `dialog-no-close-icon` suppresses the primitive's built-in X
                   (we render our own in the hero band). */
                className="dialog-no-close-icon flex flex-col gap-0 overflow-hidden rounded-xl border border-neutral-200 p-0 shadow-2xl sm:max-w-none"
                /* Modal must claim ~90vw × 90vh of the viewport — viewport-relative
                   sizing isn't tokenizable; isolated inline style with comment. */
                style={{ width: '90vw', maxWidth: '90vw', height: '90vh' }}
            >
                {/* HERO BAND */}
                <header className="relative shrink-0 border-b border-neutral-200 bg-white">
                    {/* Primary accent strip */}
                    <div className="h-1 w-full bg-gradient-to-r from-primary-500 via-primary-400 to-primary-300" />

                    <div className="flex flex-col gap-3 px-6 py-4">
                        <div className="flex items-start gap-4">
                            {/* Avatar */}
                            <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-neutral-100 ring-2 ring-primary-100">
                                {faceLoader ? (
                                    <div className="size-6 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
                                ) : imageUrl ? (
                                    <img
                                        src={imageUrl}
                                        alt={selectedStudent.full_name || 'Profile'}
                                        className="size-full object-cover"
                                    />
                                ) : (
                                    <DummyProfile className="size-10 text-neutral-400" />
                                )}
                            </div>

                            {/* Identity */}
                            <div className="flex min-w-0 flex-1 flex-col gap-1">
                                <span className="text-xs font-semibold uppercase tracking-widest text-primary-500">
                                    {`${getTerminology(RoleTerms.Learner, SystemTerms.Learner)} Profile`}
                                </span>
                                <h1
                                    className={cn(
                                        'truncate text-2xl font-bold leading-tight',
                                        selectedStudent.full_name
                                            ? 'text-neutral-900'
                                            : 'text-neutral-400'
                                    )}
                                    title={selectedStudent.full_name || undefined}
                                >
                                    {selectedStudent.full_name || 'Unknown'}
                                </h1>
                                <div className="mt-1 flex flex-wrap items-center gap-2">
                                    {selectedStudent.status && (
                                        <StatusChips status={selectedStudent.status} />
                                    )}
                                    {selectedStudent.sub_org_name && (
                                        <span className="rounded-full bg-info-50 px-2 py-0.5 text-xs font-medium text-info-600">
                                            {selectedStudent.sub_org_name}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Right controls — Quick contact + collapse + close */}
                            <div className="flex shrink-0 items-center gap-2">
                                <ProfileQuickContact
                                    email={selectedStudent.email}
                                    phone={selectedStudent.mobile_number}
                                />
                                <button
                                    type="button"
                                    onClick={closeOverlay}
                                    className="flex size-9 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                                    aria-label="Collapse to side panel"
                                    title="Collapse to side panel"
                                >
                                    <ArrowsInSimple className="size-5" />
                                </button>
                                <button
                                    type="button"
                                    onClick={closeOverlay}
                                    className="flex size-9 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                                    aria-label="Close"
                                >
                                    <X className="size-5" />
                                </button>
                            </div>
                        </div>

                        {/* Context strip */}
                        <ProfileContextStrip
                            items={
                                [
                                    selectedStudent.institute_enrollment_number && {
                                        label: 'ID',
                                        value: selectedStudent.institute_enrollment_number,
                                    },
                                    selectedStudent.created_at && {
                                        label: 'Joined',
                                        value: new Date(
                                            selectedStudent.created_at
                                        ).toLocaleDateString(undefined, {
                                            day: 'numeric',
                                            month: 'short',
                                            year: 'numeric',
                                        }),
                                    },
                                    selectedStudent.city && {
                                        label: 'City',
                                        value: selectedStudent.city,
                                    },
                                    selectedStudent.email && {
                                        label: 'Email',
                                        value: selectedStudent.email,
                                    },
                                    selectedStudent.mobile_number && {
                                        label: 'Phone',
                                        value: selectedStudent.mobile_number,
                                    },
                                ] as Array<ContextStripItem | false | null | undefined>
                            }
                        />
                    </div>
                </header>

                {/* BODY — left section nav + main content */}
                <div className="flex min-h-0 flex-1">
                    {/* LEFT NAV */}
                    <nav
                        aria-label="Profile sections"
                        className="hidden w-60 shrink-0 overflow-y-auto border-r border-neutral-200 bg-neutral-50/40 p-3 md:block"
                    >
                        <ul className="flex flex-col gap-0.5">
                            {visibleIds.map((id) => {
                                // lead/fullHistory require the lead system to be enabled
                                if (
                                    (id === 'lead' || id === 'fullHistory') &&
                                    (leadSettings.isLoading || !leadSettings.enabled)
                                ) {
                                    return null;
                                }
                                const Icon = SECTION_ICONS[id] ?? User;
                                const isActive = activeSection === id;
                                return (
                                    <li key={id}>
                                        <button
                                            type="button"
                                            onClick={() => setActiveSection(id)}
                                            aria-current={isActive ? 'page' : undefined}
                                            className={cn(
                                                'group flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400',
                                                isActive
                                                    ? 'bg-primary-50 text-primary-700'
                                                    : 'text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900'
                                            )}
                                        >
                                            <Icon
                                                className={cn(
                                                    'size-4 shrink-0',
                                                    isActive
                                                        ? 'text-primary-600'
                                                        : 'text-neutral-400 group-hover:text-neutral-600'
                                                )}
                                                weight={isActive ? 'duotone' : 'regular'}
                                            />
                                            <span className="truncate">{sectionLabel(id)}</span>
                                        </button>
                                    </li>
                                );
                            })}
                            {selectedStudent.sub_org_name && (
                                <li>
                                    <button
                                        type="button"
                                        onClick={() => setActiveSection('subOrg')}
                                        aria-current={
                                            activeSection === 'subOrg' ? 'page' : undefined
                                        }
                                        className={cn(
                                            'group flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400',
                                            activeSection === 'subOrg'
                                                ? 'bg-primary-50 text-primary-700'
                                                : 'text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900'
                                        )}
                                    >
                                        <Buildings
                                            className={cn(
                                                'size-4 shrink-0',
                                                activeSection === 'subOrg'
                                                    ? 'text-primary-600'
                                                    : 'text-neutral-400 group-hover:text-neutral-600'
                                            )}
                                            weight={activeSection === 'subOrg' ? 'duotone' : 'regular'}
                                        />
                                        <span className="truncate">Sub-Org</span>
                                    </button>
                                </li>
                            )}
                        </ul>
                    </nav>

                    {/* MAIN CONTENT */}
                    <main
                        ref={contentScrollRef}
                        className="min-w-0 flex-1 overflow-y-auto bg-neutral-50/30"
                    >
                        <div className="mx-auto flex max-w-4xl flex-col gap-4 p-6">
                            {renderSection(activeSection)}
                        </div>
                    </main>
                </div>
            </DialogContent>
        </Dialog>
    );
};
