/**
 * StudentParentProfile — the "Guardian" side-view tab.
 *
 * Read-only, informational for v1 (no inline add/create guardian form — that
 * lives in the assignment-time dialog elsewhere).
 *
 * A single userId can be EITHER side of a guardian-student link:
 *   - a guardian, with one or more linked children, or
 *   - a student, with at most one linked guardian.
 * `selectedStudent` (StudentTable) carries no `is_parent` flag, so this
 * component determines which case it is itself: it fetches the children
 * list first — a non-empty result means "this is a guardian profile" — and
 * only falls back to the parent lookup when there are no children.
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { GET_PARENT_LINK_PARENT, GET_PARENT_LINK_CHILDREN } from '@/constants/urls';
import { Users } from '@phosphor-icons/react';
import { useStudentCredentails } from '@/services/student-list-section/getStudentCredentails';
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

// ── Main component ────────────────────────────────────────────────────────────

interface StudentParentProfileProps {
    userId: string;
}

export function StudentParentProfile({ userId }: StudentParentProfileProps) {
    const [copiedField, setCopiedField] = useState<string>('');

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
        queryKey: ['parent-link-children', userId],
        queryFn: () => fetchChildren(userId),
        enabled: !!userId,
        staleTime: 2 * 60 * 1000,
        retry: 1,
    });

    const isGuardian = (childrenQuery.data?.length ?? 0) > 0;

    // Only look up a guardian once we know this profile has no children of
    // its own — avoids an unnecessary request for guardian profiles.
    const parentQuery = useQuery({
        queryKey: ['parent-link-parent', userId],
        queryFn: () => fetchGuardian(userId),
        enabled: !!userId && !childrenQuery.isLoading && !isGuardian,
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

    if (childrenQuery.isLoading || parentQuery.isLoading) {
        return <ProfileSkeleton blocks={2} />;
    }

    if (childrenQuery.isError) {
        return (
            <ProfileError
                title="Couldn't load guardian information"
                onRetry={() => childrenQuery.refetch()}
            />
        );
    }

    // ── Guardian profile: show the linked children ──
    if (isGuardian) {
        const children = childrenQuery.data ?? [];
        return (
            <div className="flex flex-col gap-3">
                <ProfileHero
                    icon={Users}
                    tone="info"
                    eyebrow="Guardian Profile"
                    title="This is a guardian profile"
                    subtitle={`Linked to ${children.length} ${children.length === 1 ? 'child' : 'children'}`}
                />
                <ProfileSectionCard icon={Users} heading="Linked Children">
                    <div className="flex flex-col divide-y divide-border">
                        {children.map((child) => (
                            <div key={child.id} className="flex flex-col gap-0.5 py-2 first:pt-0 last:pb-0">
                                <span className="text-sm font-medium text-card-foreground">
                                    {child.full_name || '—'}
                                </span>
                                <span className="text-2xs text-muted-foreground">
                                    {child.email || '—'}
                                </span>
                                <span className="text-2xs text-muted-foreground">
                                    {child.mobile_number || '—'}
                                </span>
                            </div>
                        ))}
                    </div>
                </ProfileSectionCard>
            </div>
        );
    }

    // ── Student profile: show the linked guardian, if any ──
    if (parentQuery.isError) {
        return (
            <ProfileError
                title="Couldn't load guardian information"
                onRetry={() => parentQuery.refetch()}
            />
        );
    }

    const guardian = parentQuery.data;

    if (!guardian) {
        return (
            <ProfileEmpty
                icon={Users}
                title="No guardian linked yet"
                hint="A guardian can be linked to this learner from the enrolment or bulk-assign flow."
            />
        );
    }

    return (
        <ProfileSectionCard icon={Users} heading="Guardian">
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
    );
}
