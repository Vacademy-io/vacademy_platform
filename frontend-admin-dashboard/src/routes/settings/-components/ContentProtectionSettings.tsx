import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    getAllRoles,
    type CustomRole,
} from '@/routes/manage-custom-teams/-services/custom-team-services';
import { SettingsPageShell } from '@/components/settings/shell';
import SlideDownloadCard from './RoleDisplay/SlideDownloadCard';
import SlideContentProtectionCard from './RoleDisplay/SlideContentProtectionCard';

/**
 * Dedicated "Content Protection" settings tab. Consolidates the per-role
 * Download Permissions + Copy & Screen Protection controls (previously buried
 * inside each role's Display Settings panel) behind a single role selector, so
 * an admin configures every role's slide download/protection in one place.
 *
 * Both cards edit only the selected role's column of the shared
 * SLIDE_DOWNLOAD_PERMISSION_SETTING / SLIDE_CONTENT_PROTECTION_SETTING blobs.
 */

// Roles offered directly. `key` is the canonical stored role key; `label` is the
// dropdown label; `cardLabel` is the (plural) noun used in each card's copy.
const SYSTEM_ROLES = [
    { key: 'ADMIN', label: 'Admin', cardLabel: 'admins' },
    { key: 'TEACHER', label: 'Teacher', cardLabel: 'teachers' },
    { key: 'LEARNER', label: 'Learner', cardLabel: 'learners' },
];

// System roles already covered above (or not configured here) — excluded from
// the custom-role list so the dropdown doesn't show duplicates.
const SYSTEM_ROLE_NAMES = new Set([
    'ADMIN',
    'TEACHER',
    'STUDENT',
    'LEARNER',
    'EVALUATOR',
    'CONTENT CREATOR',
    'ASSESSMENT CREATOR',
]);

export default function ContentProtectionSettings() {
    const [selectedKey, setSelectedKey] = useState<string>('ADMIN');

    const { data: customRoles } = useQuery({
        queryKey: ['custom-roles'],
        queryFn: getAllRoles,
    });

    const customRoleEntries = (customRoles || [])
        .filter((r: CustomRole) => !SYSTEM_ROLE_NAMES.has(r.name.toUpperCase()))
        .map((r: CustomRole) => ({
            key: r.name.toUpperCase(),
            label: r.name,
            cardLabel: r.name,
        }));

    const roleOptions = [...SYSTEM_ROLES, ...customRoleEntries];
    const selected = roleOptions.find((r) => r.key === selectedKey) ?? SYSTEM_ROLES[0];

    return (
        <SettingsPageShell
            title="Content Protection"
            description="Control, per role, which slide types can be downloaded and whether right-click, copy and view-source are blocked on slides. These are best-effort, client-side deterrents — they hide our own controls and cannot stop every browser-level save."
            maxWidth="max-w-3xl"
            actions={
                <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-neutral-700">Role</span>
                    <Select value={selectedKey} onValueChange={setSelectedKey}>
                        <SelectTrigger className="h-9 w-48">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {roleOptions.map((r) => (
                                <SelectItem key={r.key} value={r.key}>
                                    {r.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            }
        >
            <div className="space-y-6">
                {/* keyed on role so the cards fully reset when the role changes */}
                <SlideDownloadCard
                    key={`dl-${selected.key}`}
                    roleKey={selected.key}
                    roleLabel={selected.cardLabel}
                />
                <SlideContentProtectionCard
                    key={`cp-${selected.key}`}
                    roleKey={selected.key}
                    roleLabel={selected.cardLabel}
                />
            </div>
        </SettingsPageShell>
    );
}
