/**
 * RoleAccessGrid — a simple ADMIN/STUDENT/PARENT × view/edit checkbox grid.
 * Reused for both the per-step and per-field role-access editors.
 */
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { Checkbox } from '@/components/ui/checkbox';
import {
    ONBOARDING_ROLE_KEYS,
    type OnboardingRoleAccess,
    type OnboardingRoleKey,
} from '../-services/onboarding-service';

const buildRoleLabels = (t: TFunction): Record<OnboardingRoleKey, string> => ({
    ADMIN: t('roleLabels.admin'),
    STUDENT: t('roleLabels.student'),
    PARENT: t('roleLabels.parent'),
});

interface RoleAccessGridProps {
    value: OnboardingRoleAccess[];
    onChange: (next: OnboardingRoleAccess[]) => void;
    /** Compact mode for nesting inside a per-field row. */
    compact?: boolean;
}

export function RoleAccessGrid({ value, onChange, compact = false }: RoleAccessGridProps) {
    const { t } = useTranslation('audienceManagerRoleAccessGrid');
    const roleLabels = buildRoleLabels(t);
    const byRole = new Map(value.map((r) => [r.role_key, r]));

    const update = (role: OnboardingRoleKey, patch: Partial<OnboardingRoleAccess>) => {
        const existing = byRole.get(role) ?? { role_key: role, can_view: false, can_edit: false };
        const next = { ...existing, ...patch };
        const rest = value.filter((r) => r.role_key !== role);
        onChange([...rest, next]);
    };

    return (
        <div className={compact ? 'flex flex-wrap gap-4' : 'grid grid-cols-1 gap-3 sm:grid-cols-3'}>
            {ONBOARDING_ROLE_KEYS.map((role) => {
                const entry = byRole.get(role) ?? { role_key: role, can_view: false, can_edit: false };
                return (
                    <div
                        key={role}
                        className={
                            compact
                                ? 'flex items-center gap-3 text-caption'
                                : 'flex flex-col gap-1.5 rounded-md border border-neutral-200 p-2.5'
                        }
                    >
                        <span
                            className={
                                compact
                                    ? 'font-medium text-neutral-700'
                                    : 'text-caption font-semibold text-neutral-700'
                            }
                        >
                            {roleLabels[role]}
                        </span>
                        <label className="flex items-center gap-1.5">
                            <Checkbox
                                checked={entry.can_view}
                                onCheckedChange={(v) => update(role, { can_view: v === true })}
                            />
                            <span className="text-caption text-neutral-600">{t('actions.view')}</span>
                        </label>
                        <label className="flex items-center gap-1.5">
                            <Checkbox
                                checked={entry.can_edit}
                                onCheckedChange={(v) => update(role, { can_edit: v === true })}
                            />
                            <span className="text-caption text-neutral-600">{t('actions.edit')}</span>
                        </label>
                    </div>
                );
            })}
        </div>
    );
}
