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
import { X } from '@phosphor-icons/react';
import { StatusChips } from '@/components/design-system/chips';
import { cn } from '@/lib/utils';
import DummyProfile from '@/assets/svgs/dummy_profile_photo.svg';
import { getPublicUrl } from '@/services/upload_file';
import {
    getDisplaySettingsWithFallback,
    getDisplaySettingsFromCache,
} from '@/services/display-settings';
import { type StudentSideViewSettings, type StudentSideViewTabId } from '@/types/display-settings';
import { TAB_ID_TO_VISIBILITY_KEY } from '@/constants/display-settings/student-side-view-tabs';
import { getActiveRoleDisplaySettingsKey } from '@/lib/auth/instituteUtils';
import { useLeadSettings } from '@/hooks/use-lead-settings';
import { useLeadProfiles } from '@/hooks/use-lead-profiles';
import { getTerminology } from '@/components/common/layout-container/sidebar/utils';
import { RoleTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';
import { ProfileQuickContact, ProfileContextStrip, type ContextStripItem } from './profile-ui';

/** Two-letter initials from a full name, ALL CAPS. */
function initialsOf(name: string | null | undefined): string {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
    return ((parts[0]![0] ?? '') + (parts[parts.length - 1]![0] ?? '')).toUpperCase();
}

/** Tier → tonal classes for the inline lead-tier pill. */
const TIER_PILL: Record<'HOT' | 'WARM' | 'COLD', string> = {
    HOT: 'bg-danger-100 text-danger-700',
    WARM: 'bg-warning-100 text-warning-700',
    COLD: 'bg-info-100 text-info-700',
};
import { GroupedNavRail } from './grouped-nav-rail';
import { SECTION_REGISTRY } from './nav-groups';

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

// Per-section icon + label resolution lives inside the shared GroupedNavRail
// + SECTION_REGISTRY (see ./nav-groups) so the overlay nav stays in lockstep
// with the side-drawer's grouped nav and tenant tab-renaming settings.

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

    // Lead profile for the header tier pill. Reuses the batch hook so this
    // request is deduped against any list-level fetch already in flight.
    const headerUserId = selectedStudent?.user_id || selectedStudent?.id || '';
    const { profiles: leadProfilesMap } = useLeadProfiles(
        headerUserId ? [headerUserId] : [],
        !!leadSettings.enabled
    );
    const leadHeaderProfile = headerUserId ? leadProfilesMap[headerUserId] : undefined;
    const tier = leadHeaderProfile?.lead_tier?.toUpperCase() as
        | 'HOT'
        | 'WARM'
        | 'COLD'
        | undefined;
    const isActive = (selectedStudent?.status || '').toUpperCase() === 'ACTIVE';

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

    return (
        <Dialog open={isOverlayOpen} onOpenChange={(open) => !open && closeOverlay()}>
            <DialogContent
                /* `dialog-no-close-icon` suppresses the primitive's built-in X
                   (we render our own in the hero band). All corners rounded
                   per the design handoff fullscreen card (--r-2xl ≈
                   rounded-2xl). The dim background is owned by the Dialog
                   primitive (DialogOverlay). */
                className="dialog-no-close-icon flex flex-col gap-0 overflow-hidden rounded-2xl border border-neutral-200 bg-white p-0 shadow-2xl sm:max-w-none"
                /* Viewport-relative sizing isn't tokenizable. Handoff spec:
                   100% width / height with a 22px gutter around the card,
                   capped at 1240px wide so the layout stays readable on
                   ultrawide displays. Isolated inline style with comment. */
                style={{
                    width: 'calc(100vw - 44px)',
                    maxWidth: '1240px',
                    height: 'calc(100vh - 44px)',
                }}
            >
                {/* HERO BAND — handoff identity row + meta strip pattern.
                    No leading accent gradient (the eyebrow + name carry the
                    brand voice on their own per LearnerProfile.jsx). */}
                <header className="relative shrink-0 border-b border-neutral-200 bg-white">
                    <div className="flex flex-col gap-3 px-6 pt-5">
                        <div className="flex items-start gap-4">
                            {/* Avatar — handoff calls for ~52px initials circle
                                with --accent-soft bg + --accent-text initials
                                and a status dot bottom-right. We render a
                                photo when face_file_id resolves, falling back
                                to initials (handoff: "avatars are initial
                                circles"). size-14 (56px) is the closest
                                design-token to the spec's 52px and reads
                                noticeably more prominent than size-12 (48px).
                                The status dot is a 12px green dot with a
                                2.5px white border for ACTIVE learners. */}
                            <div className="relative shrink-0">
                                <div className="flex size-14 items-center justify-center overflow-hidden rounded-full bg-primary-50 text-primary-700 ring-2 ring-primary-200">
                                    {faceLoader ? (
                                        <div className="size-6 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
                                    ) : imageUrl ? (
                                        <img
                                            src={imageUrl}
                                            alt={selectedStudent.full_name || 'Profile'}
                                            className="size-full object-cover"
                                        />
                                    ) : selectedStudent.full_name ? (
                                        <span className="text-h4 font-bold">
                                            {initialsOf(selectedStudent.full_name)}
                                        </span>
                                    ) : (
                                        <DummyProfile className="size-9 text-neutral-400" />
                                    )}
                                </div>
                                {isActive && (
                                    <span
                                        aria-hidden
                                        className="absolute bottom-0 right-0 block size-3.5 rounded-full border-2 border-white bg-success-500"
                                    />
                                )}
                            </div>

                            {/* Identity — eyebrow + name + status / tier / sub-org
                                pills inline per handoff identity row. */}
                            <div className="flex min-w-0 flex-1 flex-col gap-1">
                                <span className="text-xs font-bold uppercase tracking-widest text-primary-700">
                                    {`${getTerminology(RoleTerms.Learner, SystemTerms.Learner)} Profile`}
                                </span>
                                <div className="flex flex-wrap items-center gap-2">
                                    <h1
                                        className={cn(
                                            'truncate text-h2 font-bold leading-tight',
                                            selectedStudent.full_name
                                                ? 'text-neutral-900'
                                                : 'text-neutral-400'
                                        )}
                                        title={selectedStudent.full_name || undefined}
                                    >
                                        {selectedStudent.full_name || 'Unknown'}
                                    </h1>
                                    {selectedStudent.status && (
                                        <StatusChips status={selectedStudent.status} />
                                    )}
                                    {tier && (
                                        <span
                                            className={cn(
                                                'rounded-full px-2 py-0.5 text-xs font-semibold',
                                                TIER_PILL[tier]
                                            )}
                                            title={`Lead tier ${tier}${
                                                typeof leadHeaderProfile?.best_score === 'number'
                                                    ? ` · score ${leadHeaderProfile.best_score}`
                                                    : ''
                                            }`}
                                        >
                                            {tier}
                                            {typeof leadHeaderProfile?.best_score === 'number'
                                                ? ` · ${leadHeaderProfile.best_score}`
                                                : ''}
                                        </span>
                                    )}
                                    {selectedStudent.sub_org_name && (
                                        <span className="rounded-full bg-info-50 px-2 py-0.5 text-xs font-medium text-info-600">
                                            {selectedStudent.sub_org_name}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Right controls — Email/Call/WhatsApp + divider + Close.
                                Collapse-to-drawer button removed — the overlay IS the
                                design's primary surface; we don't push users back to
                                the cramped right-side drawer. */}
                            <div className="flex shrink-0 items-center gap-2">
                                <ProfileQuickContact
                                    email={selectedStudent.email}
                                    phone={selectedStudent.mobile_number}
                                />
                                <span className="mx-1 h-7 w-px bg-neutral-200" />
                                <button
                                    type="button"
                                    onClick={closeOverlay}
                                    className="flex size-9 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                                    aria-label="Close (Esc)"
                                    title="Close (Esc)"
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

                {/* BODY — grouped left rail + scrollable content panel,
                    matching the handoff fullscreen LearnerProfile layout. */}
                <div className="flex min-h-0 flex-1 border-t border-neutral-200">
                    {/* LEFT RAIL — same primitive used by the side-drawer
                        navStyle === 'grouped' branch, so behavior + tenant
                        gating + visual style stay in lockstep. */}
                    <div className="hidden md:flex">
                        <GroupedNavRail
                            activeId={activeSection}
                            onSelect={(id) => setActiveSection(id as SectionId)}
                            visibleIds={
                                new Set<string>([
                                    ...visibleIds.filter((id) => {
                                        // lead/fullHistory require the lead system to be enabled
                                        if (
                                            (id === 'lead' || id === 'fullHistory') &&
                                            (leadSettings.isLoading || !leadSettings.enabled)
                                        ) {
                                            return false;
                                        }
                                        // Only registry-known IDs render in the rail.
                                        return SECTION_REGISTRY.some((s) => s.id === id);
                                    }),
                                    ...(selectedStudent.sub_org_name ? ['subOrg'] : []),
                                ])
                            }
                            enabledModules={{
                                learning: true,
                                finance: true,
                                crm: !!(leadSettings && leadSettings.enabled),
                                account: true,
                                records: true,
                            }}
                        />
                    </div>

                    {/* MAIN CONTENT — warm cream surface so the white cards
                        inside each section get visible elevation. */}
                    <main
                        ref={contentScrollRef}
                        className="min-w-0 flex-1 overflow-y-auto bg-neutral-50"
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
