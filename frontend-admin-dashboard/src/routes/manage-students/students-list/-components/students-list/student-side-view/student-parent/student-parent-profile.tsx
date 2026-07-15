/**
 * StudentParentProfile — the "Guardian" side-view tab.
 *
 * A single userId can be EITHER side of a guardian-student link:
 *   - a guardian, with one or more linked children, or
 *   - a student, with at most one linked guardian.
 * `selectedStudent` (StudentTable) carries no `is_parent` flag, so this
 * component determines which case it is itself: it fetches the children
 * list first — a non-empty result means "this is a guardian profile" — and
 * only falls back to the parent lookup when there are no children.
 *
 * Supports linking a guardian/child directly from this tab (not just from
 * the assignment-time dialog) — reuses the same GuardianLinkPanel +
 * /parent-link/v1/link plumbing built for the bulk-assign dialog. The anchor
 * (this profile's own userId) always already exists here, so this is the
 * simple LINK/CREATE case — no need for the new-guardian-from-scratch
 * endpoint the assignment dialog needs for brand-new manual chips.
 *
 * Click-through navigation: clicking a linked child or a linked guardian
 * pivots this tab's own view to that person (an in-panel history stack,
 * with a "back" trail) — NOT a jump to their full StudentTable side-view.
 * A guardian isn't an enrolled student and has no StudentTable row to jump
 * to, and a synthesized placeholder row risked breaking enrollment-shaped
 * tabs (courses, payments, …) elsewhere in the side-view for real students
 * too. Pivoting in-panel works for both directions with zero backend
 * changes and no risk to other tabs.
 */
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { GET_PARENT_LINK_PARENT, GET_PARENT_LINK_CHILDREN } from '@/constants/urls';
import { Users, Plus, ArrowLeft } from '@phosphor-icons/react';
import { useStudentCredentails } from '@/services/student-list-section/getStudentCredentails';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import { useParentSettings } from '@/hooks/use-parent-settings';
import { useParentLink } from '../../../../-hooks/useParentLink';
import { GuardianLinkPanel } from '../../../../-components/enroll-bulk/components/GuardianLinkPanel';
import { ParentLinkPersonInput, isParentLinkPersonValid } from '../../../../-types/bulk-assign-types';
import { MyButton } from '@/components/design-system/button';
import {
    ProfileHero,
    ProfileSectionCard,
    ProfileFieldRow,
    ProfileSkeleton,
    ProfileEmpty,
    ProfileError,
} from '../profile-ui';

// ── Types ─────────────────────────────────────────────────────────────────────
// Subset of the backend UserDTO — only the fields this tab renders.
interface GuardianLinkedUser {
    id: string;
    username: string | null;
    email: string | null;
    full_name: string | null;
    mobile_number: string | null;
}

interface ViewedPerson {
    id: string;
    name: string;
}

// ── API helpers ───────────────────────────────────────────────────────────────

async function fetchGuardian(studentUserId: string): Promise<GuardianLinkedUser | null> {
    const response = await authenticatedAxiosInstance({
        method: 'GET',
        url: GET_PARENT_LINK_PARENT,
        params: { studentUserId },
    });
    return response.data ?? null;
}

async function fetchChildren(parentUserId: string): Promise<GuardianLinkedUser[]> {
    const response = await authenticatedAxiosInstance({
        method: 'GET',
        url: GET_PARENT_LINK_CHILDREN,
        params: { parentUserId },
    });
    return response.data ?? [];
}

function extractErrorMessage(err: unknown): string {
    const e = err as { response?: { data?: { message?: string } }; message?: string };
    return e?.response?.data?.message || e?.message || 'Failed to link guardian.';
}

// ── Inline link form (shared by both directions) ───────────────────────────────

interface InlineLinkFormProps {
    instituteId: string;
    /** "Guardian" (student adding a guardian) or "Student" (guardian adding a child). */
    personLabel: string;
    searchRoles: string[];
    onSubmit: (person: ParentLinkPersonInput) => Promise<void>;
    onCancel: () => void;
    submitting: boolean;
}

function InlineLinkForm({
    instituteId,
    personLabel,
    searchRoles,
    onSubmit,
    onCancel,
    submitting,
}: InlineLinkFormProps) {
    const [person, setPerson] = useState<ParentLinkPersonInput | undefined>(undefined);
    const ready = isParentLinkPersonValid(person);

    return (
        <div className="flex flex-col gap-3">
            <GuardianLinkPanel
                instituteId={instituteId}
                personLabel={personLabel}
                searchRoles={searchRoles}
                value={person}
                onChange={setPerson}
            />
            <div className="flex items-center justify-end gap-2">
                <MyButton buttonType="secondary" scale="small" onClick={onCancel} disable={submitting}>
                    Cancel
                </MyButton>
                <MyButton
                    buttonType="primary"
                    scale="small"
                    onClick={() => person && onSubmit(person)}
                    disable={!ready || submitting}
                >
                    {submitting ? 'Linking…' : `Link ${personLabel}`}
                </MyButton>
            </div>
        </div>
    );
}

// ── Back-navigation trail ───────────────────────────────────────────────────────

function BackTrail({ current, onBack }: { current: ViewedPerson; onBack: () => void }) {
    return (
        <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 self-start text-caption font-medium text-primary-500 hover:text-primary-700"
        >
            <ArrowLeft size={14} weight="bold" />
            Back — viewing {current.name}
        </button>
    );
}

// ── Main component ────────────────────────────────────────────────────────────

interface StudentParentProfileProps {
    userId: string;
}

export function StudentParentProfile({ userId }: StudentParentProfileProps) {
    const [copiedField, setCopiedField] = useState<string>('');
    const [showLinkForm, setShowLinkForm] = useState(false);
    // In-panel pivot history: empty = viewing `userId` itself. Each entry is a
    // person clicked into (a linked child or guardian) — see file header.
    const [history, setHistory] = useState<ViewedPerson[]>([]);
    const queryClient = useQueryClient();
    const instituteId = getCurrentInstituteId() ?? '';
    const { enabled: guardianLinkingEnabled } = useParentSettings();
    const { mutateAsync: linkGuardian, isPending: isLinking } = useParentLink();

    // noUncheckedIndexedAccess means history[n] is `ViewedPerson | undefined`
    // even right after a length check — resolve it once, explicitly.
    const lastView = history.length > 0 ? history[history.length - 1] : undefined;
    const currentId = lastView ? lastView.id : userId;

    // The actual selected student changed upstream (e.g. admin picked a
    // different learner) — drop any in-panel pivot so we don't show a stale
    // "back to X" trail pointing at the wrong root.
    useEffect(() => {
        setHistory([]);
        setShowLinkForm(false);
    }, [userId]);

    const goInto = (person: ViewedPerson) => {
        setShowLinkForm(false);
        setHistory((h) => [...h, person]);
    };
    const goBack = () => {
        setShowLinkForm(false);
        setHistory((h) => h.slice(0, -1));
    };

    const handleCopy = async (text: string, fieldName: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedField(fieldName);
            toast.success(`${fieldName} copied to clipboard!`);
            setTimeout(() => setCopiedField(''), 2000);
        } catch {
            toast.error(`Failed to copy ${fieldName}`);
        }
    };

    const childrenQuery = useQuery({
        queryKey: ['parent-link-children', currentId],
        queryFn: () => fetchChildren(currentId),
        enabled: !!currentId,
        staleTime: 2 * 60 * 1000,
        retry: 1,
    });

    const isGuardian = (childrenQuery.data?.length ?? 0) > 0;

    // Only look up a guardian once we know this profile has no children of
    // its own — avoids an unnecessary request for guardian profiles.
    const parentQuery = useQuery({
        queryKey: ['parent-link-parent', currentId],
        queryFn: () => fetchGuardian(currentId),
        enabled: !!currentId && !childrenQuery.isLoading && !isGuardian,
        staleTime: 2 * 60 * 1000,
        retry: 1,
    });

    // Same credential-reveal endpoint/hook already used by the student
    // portal-access tab (GET /auth-service/v1/user/user-credentials/{userId}) —
    // reused here rather than inventing a second plaintext-exposure path.
    // Called unconditionally (Rules of Hooks) — only *enabled* once we know
    // this profile is a student with a resolved guardian id.
    const guardianId = parentQuery.data?.id ?? '';
    const credentialsQuery = useStudentCredentails({ userId: guardianId });
    const guardianPassword = guardianId
        ? credentialsQuery.data?.password || (credentialsQuery.isLoading ? 'Loading...' : 'Password not found')
        : null;

    const submitLink = async (
        direction: 'PARENT_ADDS_STUDENT' | 'STUDENT_ADDS_PARENT',
        person: ParentLinkPersonInput
    ) => {
        const base = {
            institute_id: instituteId,
            direction,
            anchor_user_id: currentId,
        } as const;
        const request =
            person.kind === 'create_new'
                ? {
                      ...base,
                      mode: 'CREATE_NEW' as const,
                      new_full_name: person.fullName,
                      new_email: person.email,
                      new_mobile_number: person.mobileNumber || undefined,
                  }
                : {
                      ...base,
                      mode: 'LINK_EXISTING' as const,
                      existing_user_id: person.userId,
                  };
        try {
            await linkGuardian(request);
            toast.success(direction === 'STUDENT_ADDS_PARENT' ? 'Guardian linked' : 'Student linked');
            setShowLinkForm(false);
            queryClient.invalidateQueries({ queryKey: ['parent-link-children', currentId] });
            queryClient.invalidateQueries({ queryKey: ['parent-link-parent', currentId] });
        } catch (err) {
            toast.error(extractErrorMessage(err));
        }
    };

    const backTrail = lastView && <BackTrail current={lastView} onBack={goBack} />;

    if (childrenQuery.isLoading || parentQuery.isLoading) {
        return (
            <div className="flex flex-col gap-3">
                {backTrail}
                <ProfileSkeleton blocks={2} />
            </div>
        );
    }

    if (childrenQuery.isError) {
        return (
            <div className="flex flex-col gap-3">
                {backTrail}
                <ProfileError
                    title="Couldn't load guardian information"
                    onRetry={() => childrenQuery.refetch()}
                />
            </div>
        );
    }

    // ── Guardian profile: show the linked children ──
    if (isGuardian) {
        const children = childrenQuery.data ?? [];
        return (
            <div className="flex flex-col gap-3">
                {backTrail}
                <ProfileHero
                    icon={Users}
                    tone="info"
                    eyebrow="Guardian Profile"
                    title="This is a guardian profile"
                    subtitle={`Linked to ${children.length} ${children.length === 1 ? 'child' : 'children'}`}
                />
                <ProfileSectionCard
                    icon={Users}
                    heading="Linked Children"
                    action={
                        guardianLinkingEnabled && !showLinkForm ? (
                            <MyButton
                                buttonType="secondary"
                                scale="small"
                                onClick={() => setShowLinkForm(true)}
                            >
                                <Plus size={14} weight="bold" /> Add Child
                            </MyButton>
                        ) : undefined
                    }
                >
                    <div className="flex flex-col divide-y divide-border">
                        {children.map((child) => (
                            <button
                                key={child.id}
                                type="button"
                                onClick={() =>
                                    goInto({ id: child.id, name: child.full_name || child.email || 'this learner' })
                                }
                                className="flex flex-col gap-0.5 py-2 text-left first:pt-0 last:pb-0 hover:opacity-80"
                                title="View this learner's guardian info"
                            >
                                <span className="text-sm font-medium text-primary-600 underline-offset-2 hover:underline">
                                    {child.full_name || '—'}
                                </span>
                                <span className="text-2xs text-muted-foreground">
                                    {child.email || '—'}
                                </span>
                                <span className="text-2xs text-muted-foreground">
                                    {child.mobile_number || '—'}
                                </span>
                            </button>
                        ))}
                    </div>
                    {showLinkForm && (
                        <div className="mt-3 border-t border-border pt-3">
                            <InlineLinkForm
                                instituteId={instituteId}
                                personLabel="Student"
                                searchRoles={['STUDENT']}
                                submitting={isLinking}
                                onCancel={() => setShowLinkForm(false)}
                                onSubmit={(person) => submitLink('PARENT_ADDS_STUDENT', person)}
                            />
                        </div>
                    )}
                </ProfileSectionCard>
            </div>
        );
    }

    // ── Student profile: show the linked guardian, if any ──
    if (parentQuery.isError) {
        return (
            <div className="flex flex-col gap-3">
                {backTrail}
                <ProfileError
                    title="Couldn't load guardian information"
                    onRetry={() => parentQuery.refetch()}
                />
            </div>
        );
    }

    const guardian = parentQuery.data;

    if (!guardian) {
        return (
            <div className="flex flex-col gap-3">
                {backTrail}
                <ProfileEmpty
                    icon={Users}
                    title="No guardian linked yet"
                    hint="Link an existing guardian, or add a new one, right from here."
                />
                {guardianLinkingEnabled && (
                    <ProfileSectionCard icon={Users} heading="Link a Guardian">
                        {showLinkForm ? (
                            <InlineLinkForm
                                instituteId={instituteId}
                                personLabel="Guardian"
                                searchRoles={['PARENT']}
                                submitting={isLinking}
                                onCancel={() => setShowLinkForm(false)}
                                onSubmit={(person) => submitLink('STUDENT_ADDS_PARENT', person)}
                            />
                        ) : (
                            <MyButton
                                buttonType="secondary"
                                scale="small"
                                onClick={() => setShowLinkForm(true)}
                            >
                                <Plus size={14} weight="bold" /> Add Guardian
                            </MyButton>
                        )}
                    </ProfileSectionCard>
                )}
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-3">
            {backTrail}
            <ProfileSectionCard
                icon={Users}
                heading="Guardian"
                action={
                    <button
                        type="button"
                        onClick={() =>
                            goInto({ id: guardian.id, name: guardian.full_name || guardian.email || 'this guardian' })
                        }
                        className="text-caption font-medium text-primary-500 hover:text-primary-700 hover:underline"
                        title="View this guardian's own profile"
                    >
                        View guardian's profile →
                    </button>
                }
            >
                <dl>
                    <ProfileFieldRow label="Name" value={guardian.full_name} />
                    <ProfileFieldRow
                        label="Username"
                        value={guardian.username}
                        copied={copiedField === 'Username'}
                        onCopy={guardian.username ? () => handleCopy(guardian.username!, 'Username') : undefined}
                    />
                    <ProfileFieldRow
                        label="Email"
                        value={guardian.email}
                        copied={copiedField === 'Email'}
                        onCopy={guardian.email ? () => handleCopy(guardian.email!, 'Email') : undefined}
                    />
                    <ProfileFieldRow label="Mobile" value={guardian.mobile_number} />
                    <ProfileFieldRow
                        label="Password"
                        value={guardianPassword}
                        copied={copiedField === 'Password'}
                        onCopy={
                            guardianPassword && guardianPassword !== 'Password not found' && guardianPassword !== 'Loading...'
                                ? () => handleCopy(guardianPassword, 'Password')
                                : undefined
                        }
                    />
                </dl>
            </ProfileSectionCard>
        </div>
    );
}
