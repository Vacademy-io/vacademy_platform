import { useState } from 'react';
import {
    CaretDown,
    Funnel,
    Prohibit,
    Trash,
    UserCircle,
    UsersThree,
    X,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { MyButton } from '@/components/design-system/button';
import { MyInput } from '@/components/design-system/input';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { MultiSelect } from '@/components/design-system/multi-select';
import { SearchableSelect } from '@/components/design-system/searchable-select';
import type { TagItem } from '@/services/tag-management';
import type { CampaignItem } from '@/routes/audience-manager/list/-services/get-campaigns-list';
import { BatchPicker } from './BatchPicker';
import { FieldError, FieldHint, LoadFailure } from './primitives';
import type {
    AudienceRule,
    AudienceRuleType,
    BatchOption,
    CustomFieldOption,
    ExclusionType,
    FieldErrors,
    FieldFilter,
    RuleExclusion,
} from '../-types';

const RULE_TYPE_LABELS: Record<AudienceRuleType, string> = {
    ROLE: 'Everyone with a role',
    PACKAGE_SESSION: 'Specific batches',
    USER: 'Specific people',
    TAG: 'People with tags',
    AUDIENCE: 'A campaign audience',
    CUSTOM_FIELD_FILTER: 'People matching field values',
};

let idSeq = 0;
const nextId = (prefix: string) => `${prefix}-${++idSeq}-${Math.random().toString(36).slice(2, 7)}`;

interface RecipientCardProps {
    rule: AudienceRule;
    index: number;
    errors: FieldErrors;
    showErrors: boolean;
    batches: BatchOption[];
    batchesLoading: boolean;
    batchNoun: string;
    batchNounPlural: string;
    learnerNounPlural: string;
    teacherNounPlural: string;
    tags: TagItem[];
    tagsLoading: boolean;
    tagsError: string | null;
    onReloadTags: () => void;
    campaigns: CampaignItem[];
    campaignsLoading: boolean;
    campaignsError: string | null;
    onReloadCampaigns: () => void;
    customFields: CustomFieldOption[];
    tagReach: number | null;
    tagReachLoading: boolean;
    onChange: (patch: Partial<AudienceRule>) => void;
    onRemove: () => void;
}

export function RecipientCard(props: RecipientCardProps) {
    const {
        rule,
        index,
        errors,
        showErrors,
        batches,
        batchesLoading,
        batchNoun,
        batchNounPlural,
        learnerNounPlural,
        teacherNounPlural,
        tags,
        tagsLoading,
        tagsError,
        onReloadTags,
        campaigns,
        campaignsLoading,
        campaignsError,
        onReloadCampaigns,
        customFields,
        onChange,
        onRemove,
    } = props;

    const [refineOpen, setRefineOpen] = useState(
        rule.fieldFilters.length > 0 || rule.exclusions.length > 0
    );
    const [userDraft, setUserDraft] = useState('');
    const err = (suffix: string) => (showErrors ? errors[`rule.${rule.key}.${suffix}`] : undefined);

    const tagOptions = tags
        .filter((tag) => {
            if (rule.tagScope === 'ALL') return true;
            if (rule.tagScope === 'DEFAULT') return Boolean(tag.defaultTag);
            return !tag.defaultTag;
        })
        .map((tag) => ({ label: tag.tagName, value: tag.id }));

    const needsOrgRole = rule.packageSessionIds.some((id) =>
        batches.find((b) => b.id === id && b.isOrgAssociated)
    );

    const addUserTokens = () => {
        // One paste of comma/space/newline separated ids should become many chips, not one.
        const parts = userDraft
            .split(/[\s,;]+/)
            .map((p) => p.trim())
            .filter(Boolean);
        if (parts.length === 0) return;
        onChange({ userIds: [...new Set([...rule.userIds, ...parts])] });
        setUserDraft('');
    };

    const updateFilter = (key: string, patch: Partial<FieldFilter>) =>
        onChange({
            fieldFilters: rule.fieldFilters.map((f) => (f.key === key ? { ...f, ...patch } : f)),
        });

    const updateExclusion = (key: string, patch: Partial<RuleExclusion>) =>
        onChange({
            exclusions: rule.exclusions.map((e) => (e.key === key ? { ...e, ...patch } : e)),
        });

    return (
        <div
            className={cn(
                'rounded-lg border bg-card p-4 shadow-sm transition-colors',
                showErrors &&
                    Object.keys(errors).some((k) => k.startsWith(`rule.${rule.key}.`)) &&
                    'border-danger-400'
            )}
        >
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-50 text-caption font-semibold text-primary-600">
                        {index + 1}
                    </span>
                    <Select
                        value={rule.type}
                        onValueChange={(value) =>
                            // Switching the rule type clears the previous type's selections so a
                            // hidden leftover value can never reach the payload.
                            onChange({
                                type: value as AudienceRuleType,
                                roleId: value === 'ROLE' ? 'STUDENT' : '',
                                packageSessionIds: [],
                                orgRole: undefined,
                                userIds: [],
                                tagIds: [],
                                campaignId: '',
                                campaignName: '',
                                fieldFilters:
                                    value === 'CUSTOM_FIELD_FILTER' ? rule.fieldFilters : [],
                            })
                        }
                    >
                        <SelectTrigger className="w-full sm:w-64">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {(Object.keys(RULE_TYPE_LABELS) as AudienceRuleType[])
                                .filter(
                                    (type) =>
                                        type !== 'CUSTOM_FIELD_FILTER' || customFields.length > 0
                                )
                                .map((type) => (
                                    <SelectItem key={type} value={type}>
                                        {type === 'PACKAGE_SESSION'
                                            ? `Specific ${batchNounPlural}`
                                            : RULE_TYPE_LABELS[type]}
                                    </SelectItem>
                                ))}
                        </SelectContent>
                    </Select>
                </div>
                <MyButton
                    buttonType="secondary"
                    scale="small"
                    layoutVariant="icon"
                    aria-label={`Remove audience ${index + 1}`}
                    onClick={onRemove}
                >
                    <Trash className="size-4" />
                </MyButton>
            </div>

            <div className="mt-4 space-y-3">
                {rule.type === 'ROLE' && (
                    <div className="space-y-1">
                        <Label className="text-caption font-semibold">Role</Label>
                        <Select
                            value={rule.roleId}
                            onValueChange={(value) => onChange({ roleId: value })}
                        >
                            <SelectTrigger className={cn(err('role') && 'border-danger-400')}>
                                <SelectValue placeholder="Choose a role" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="STUDENT">{learnerNounPlural}</SelectItem>
                                <SelectItem value="TEACHER">{teacherNounPlural}</SelectItem>
                                <SelectItem value="ADMIN">Admins</SelectItem>
                            </SelectContent>
                        </Select>
                        <FieldError message={err('role')} />
                    </div>
                )}

                {rule.type === 'PACKAGE_SESSION' && (
                    <div className="space-y-3">
                        <div className="space-y-1">
                            <Label className="text-caption font-semibold">
                                {batchNounPlural.charAt(0).toUpperCase() + batchNounPlural.slice(1)}
                            </Label>
                            <BatchPicker
                                batches={batches}
                                loading={batchesLoading}
                                selected={rule.packageSessionIds}
                                onChange={(ids) =>
                                    onChange({
                                        packageSessionIds: ids,
                                        orgRole: ids.some((id) =>
                                            batches.find((b) => b.id === id && b.isOrgAssociated)
                                        )
                                            ? rule.orgRole
                                            : undefined,
                                    })
                                }
                                invalid={!!err('batches')}
                                noun={batchNoun}
                                nounPlural={batchNounPlural}
                            />
                            <FieldError message={err('batches')} />
                        </div>
                        {needsOrgRole && (
                            <div className="space-y-1">
                                <Label className="text-caption font-semibold">
                                    Who inside the sub-organisation?
                                </Label>
                                <Select
                                    value={rule.orgRole ?? ''}
                                    onValueChange={(value) =>
                                        onChange({ orgRole: value as 'ADMIN' | 'LEARNER' })
                                    }
                                >
                                    <SelectTrigger
                                        className={cn(err('orgRole') && 'border-danger-400')}
                                    >
                                        <SelectValue placeholder="Choose Admin or Learner" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="LEARNER">Learners</SelectItem>
                                        <SelectItem value="ADMIN">Admins</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FieldHint>
                                    One or more selected {batchNounPlural} belong to a
                                    sub-organisation, which needs an explicit role.
                                </FieldHint>
                                <FieldError message={err('orgRole')} />
                            </div>
                        )}
                    </div>
                )}

                {rule.type === 'USER' && (
                    <div className="space-y-2">
                        <Label className="text-caption font-semibold">User ids or emails</Label>
                        <div className="flex flex-wrap items-start gap-2">
                            {/* MyInput caps itself at sm:w-60; the wrapper plus sm:w-full lets it
                                fill the row instead of collapsing to that cap. */}
                            <div className="min-w-0 flex-1">
                                <MyInput
                                    inputType="text"
                                    input={userDraft}
                                    onChangeFunction={(e) => setUserDraft(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            addUserTokens();
                                        }
                                    }}
                                    inputPlaceholder="Paste ids or emails, separated by commas"
                                    className="sm:w-full"
                                    size="medium"
                                />
                            </div>
                            <MyButton
                                buttonType="secondary"
                                scale="medium"
                                onClick={addUserTokens}
                                disable={!userDraft.trim()}
                            >
                                Add
                            </MyButton>
                        </div>
                        {rule.userIds.length > 0 && (
                            <ul className="flex flex-wrap gap-1.5">
                                {rule.userIds.map((id) => (
                                    <li key={id}>
                                        <span className="flex items-center gap-1 rounded-full border border-primary-200 bg-primary-50 py-0.5 pl-2 pr-1 text-caption text-primary-600">
                                            <UserCircle className="size-3.5 shrink-0" />
                                            <span className="max-w-xs truncate">{id}</span>
                                            <button
                                                type="button"
                                                aria-label={`Remove ${id}`}
                                                onClick={() =>
                                                    onChange({
                                                        userIds: rule.userIds.filter(
                                                            (u) => u !== id
                                                        ),
                                                    })
                                                }
                                                className="rounded-full p-0.5 hover:bg-primary-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                            >
                                                <X className="size-3" weight="bold" />
                                            </button>
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                        <FieldError message={err('users')} />
                    </div>
                )}

                {rule.type === 'TAG' && (
                    <div className="space-y-2">
                        <div className="flex flex-wrap items-end justify-between gap-2">
                            <Label className="text-caption font-semibold">Tags</Label>
                            <Select
                                value={rule.tagScope}
                                onValueChange={(value) =>
                                    onChange({
                                        tagScope: value as AudienceRule['tagScope'],
                                    })
                                }
                            >
                                <SelectTrigger className="h-8 w-40 text-caption">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">All tags</SelectItem>
                                    <SelectItem value="DEFAULT">Default tags</SelectItem>
                                    <SelectItem value="INSTITUTE">Institute tags</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        {tagsError ? (
                            <LoadFailure message={tagsError} onRetry={onReloadTags} />
                        ) : (
                            <MultiSelect
                                options={tagOptions}
                                selected={rule.tagIds}
                                onChange={(ids) => onChange({ tagIds: ids })}
                                placeholder={
                                    tagsLoading ? 'Loading tags…' : 'Select one or more tags'
                                }
                                disabled={tagsLoading}
                            />
                        )}
                        <FieldHint>
                            Anyone carrying <span className="font-semibold">any</span> of the
                            selected tags receives this.
                        </FieldHint>
                        <FieldError message={err('tags')} />
                    </div>
                )}

                {rule.type === 'AUDIENCE' && (
                    <div className="space-y-1">
                        <Label className="text-caption font-semibold">Campaign</Label>
                        {campaignsError ? (
                            <LoadFailure message={campaignsError} onRetry={onReloadCampaigns} />
                        ) : (
                            <SearchableSelect
                                value={rule.campaignId}
                                onChange={(value) => {
                                    const campaign = campaigns.find(
                                        (c) => (c.id || c.campaign_id) === value
                                    );
                                    onChange({
                                        campaignId: value,
                                        campaignName: campaign?.campaign_name ?? '',
                                    });
                                }}
                                options={campaigns
                                    .filter((c) => !!(c.id || c.campaign_id))
                                    .map((c) => ({
                                        value: (c.id || c.campaign_id) as string,
                                        label: `${c.campaign_name} · ${c.status}`,
                                    }))}
                                placeholder={
                                    campaignsLoading ? 'Loading campaigns…' : 'Select a campaign'
                                }
                                searchPlaceholder="Search campaigns…"
                                emptyText="No campaigns found."
                                disabled={campaignsLoading}
                                triggerClassName={cn(err('campaign') && 'border-danger-400')}
                            />
                        )}
                        <FieldError message={err('campaign')} />
                    </div>
                )}

                {rule.type === 'CUSTOM_FIELD_FILTER' && (
                    <FieldHint>
                        Everyone whose profile matches the filters below receives this. Add them
                        under <span className="font-semibold">Refine</span>.
                    </FieldHint>
                )}
                {rule.type === 'CUSTOM_FIELD_FILTER' && <FieldError message={err('filters')} />}
            </div>

            {/* ---------------------------------------------------------- refine */}
            <div className="mt-4 border-t pt-3">
                <button
                    type="button"
                    onClick={() => setRefineOpen((open) => !open)}
                    aria-expanded={refineOpen}
                    className="flex w-full items-center justify-between gap-2 rounded-sm py-1 text-caption font-semibold text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                    <span className="flex items-center gap-2">
                        <Funnel className="size-4" />
                        Refine — field filters and exclusions
                        {(rule.fieldFilters.length > 0 || rule.exclusions.length > 0) && (
                            <span className="rounded-full bg-primary-50 px-2 py-0.5 text-primary-600">
                                {rule.fieldFilters.length + rule.exclusions.length}
                            </span>
                        )}
                    </span>
                    <CaretDown
                        className={cn('size-4 transition-transform', refineOpen && 'rotate-180')}
                    />
                </button>

                {refineOpen && (
                    <div className="mt-3 space-y-4">
                        {/* field filters */}
                        <div className="space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="text-caption font-semibold">Field filters</span>
                                <MyButton
                                    buttonType="secondary"
                                    scale="small"
                                    disable={customFields.length === 0}
                                    onClick={() =>
                                        onChange({
                                            fieldFilters: [
                                                ...rule.fieldFilters,
                                                {
                                                    key: nextId('filter'),
                                                    fieldId: '',
                                                    fieldName: '',
                                                    fieldType: 'text',
                                                    filterValue: '',
                                                    operator: 'equals',
                                                },
                                            ],
                                        })
                                    }
                                >
                                    Add filter
                                </MyButton>
                            </div>
                            {customFields.length === 0 ? (
                                <FieldHint>
                                    No custom fields are configured for this institute.
                                </FieldHint>
                            ) : rule.fieldFilters.length === 0 ? (
                                <FieldHint>No filters — everyone above is included.</FieldHint>
                            ) : (
                                rule.fieldFilters.map((filter) => {
                                    const field = customFields.find((f) => f.id === filter.fieldId);
                                    return (
                                        <div
                                            key={filter.key}
                                            className="space-y-2 rounded-md border bg-muted/30 p-3"
                                        >
                                            <div className="flex items-start gap-2">
                                                <Select
                                                    value={filter.fieldId}
                                                    onValueChange={(fieldId) => {
                                                        const picked = customFields.find(
                                                            (f) => f.id === fieldId
                                                        );
                                                        updateFilter(filter.key, {
                                                            fieldId,
                                                            fieldName: picked?.name ?? '',
                                                            fieldType: picked?.type ?? 'text',
                                                            filterValue:
                                                                picked?.type === 'dropdown'
                                                                    ? []
                                                                    : '',
                                                            operator:
                                                                picked?.type === 'text'
                                                                    ? 'equals'
                                                                    : undefined,
                                                        });
                                                    }}
                                                >
                                                    <SelectTrigger className="flex-1">
                                                        <SelectValue placeholder="Choose a field" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {customFields.map((f) => (
                                                            <SelectItem key={f.id} value={f.id}>
                                                                {f.name}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <MyButton
                                                    buttonType="secondary"
                                                    scale="small"
                                                    layoutVariant="icon"
                                                    aria-label="Remove filter"
                                                    onClick={() =>
                                                        onChange({
                                                            fieldFilters: rule.fieldFilters.filter(
                                                                (f) => f.key !== filter.key
                                                            ),
                                                        })
                                                    }
                                                >
                                                    <X className="size-4" />
                                                </MyButton>
                                            </div>

                                            {field?.type === 'dropdown' ? (
                                                <MultiSelect
                                                    options={(field.options ?? []).map((o) => ({
                                                        label: o,
                                                        value: o,
                                                    }))}
                                                    selected={
                                                        Array.isArray(filter.filterValue)
                                                            ? filter.filterValue
                                                            : []
                                                    }
                                                    onChange={(values) =>
                                                        updateFilter(filter.key, {
                                                            filterValue: values,
                                                        })
                                                    }
                                                    placeholder="Select values"
                                                />
                                            ) : field?.type === 'number' ? (
                                                <Input
                                                    type="number"
                                                    value={
                                                        Array.isArray(filter.filterValue)
                                                            ? ''
                                                            : filter.filterValue
                                                    }
                                                    onChange={(e) =>
                                                        updateFilter(filter.key, {
                                                            filterValue: e.target.value,
                                                        })
                                                    }
                                                    placeholder="Enter a number"
                                                />
                                            ) : (
                                                <div className="grid gap-2 sm:grid-cols-[10rem_1fr]">
                                                    <Select
                                                        value={filter.operator ?? 'equals'}
                                                        onValueChange={(operator) =>
                                                            updateFilter(filter.key, {
                                                                operator:
                                                                    operator as FieldFilter['operator'],
                                                            })
                                                        }
                                                    >
                                                        <SelectTrigger>
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="equals">
                                                                Equals
                                                            </SelectItem>
                                                            <SelectItem value="contains">
                                                                Contains
                                                            </SelectItem>
                                                            <SelectItem value="starts_with">
                                                                Starts with
                                                            </SelectItem>
                                                            <SelectItem value="ends_with">
                                                                Ends with
                                                            </SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    <Input
                                                        value={
                                                            Array.isArray(filter.filterValue)
                                                                ? ''
                                                                : filter.filterValue
                                                        }
                                                        onChange={(e) =>
                                                            updateFilter(filter.key, {
                                                                filterValue: e.target.value,
                                                            })
                                                        }
                                                        placeholder="Value to match"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* exclusions */}
                        <div className="space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="flex items-center gap-1.5 text-caption font-semibold">
                                    <Prohibit className="size-4" />
                                    Exclusions
                                </span>
                                <MyButton
                                    buttonType="secondary"
                                    scale="small"
                                    onClick={() =>
                                        onChange({
                                            exclusions: [
                                                ...rule.exclusions,
                                                {
                                                    key: nextId('exclusion'),
                                                    exclusionType: 'ROLE',
                                                    exclusionId: '',
                                                },
                                            ],
                                        })
                                    }
                                >
                                    Add exclusion
                                </MyButton>
                            </div>
                            {rule.exclusions.length === 0 ? (
                                <FieldHint>Nobody is excluded from this audience.</FieldHint>
                            ) : (
                                rule.exclusions.map((exclusion) => (
                                    <div
                                        key={exclusion.key}
                                        className="flex flex-wrap items-start gap-2 rounded-md border bg-muted/30 p-3"
                                    >
                                        <Select
                                            value={exclusion.exclusionType}
                                            onValueChange={(value) =>
                                                updateExclusion(exclusion.key, {
                                                    exclusionType: value as ExclusionType,
                                                    exclusionId: '',
                                                    exclusionName: '',
                                                })
                                            }
                                        >
                                            <SelectTrigger className="w-full sm:w-40">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="ROLE">Role</SelectItem>
                                                <SelectItem value="PACKAGE_SESSION">
                                                    {batchNoun.charAt(0).toUpperCase() +
                                                        batchNoun.slice(1)}
                                                </SelectItem>
                                                <SelectItem value="TAG">Tag</SelectItem>
                                                <SelectItem value="USER">User</SelectItem>
                                            </SelectContent>
                                        </Select>

                                        <div className="min-w-0 flex-1">
                                            {exclusion.exclusionType === 'ROLE' ? (
                                                <Select
                                                    value={exclusion.exclusionId}
                                                    onValueChange={(value) =>
                                                        updateExclusion(exclusion.key, {
                                                            exclusionId: value,
                                                            exclusionName: value,
                                                        })
                                                    }
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select a role" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="STUDENT">
                                                            {learnerNounPlural}
                                                        </SelectItem>
                                                        <SelectItem value="TEACHER">
                                                            {teacherNounPlural}
                                                        </SelectItem>
                                                        <SelectItem value="ADMIN">
                                                            Admins
                                                        </SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            ) : exclusion.exclusionType === 'PACKAGE_SESSION' ? (
                                                <SearchableSelect
                                                    value={exclusion.exclusionId}
                                                    onChange={(value) =>
                                                        updateExclusion(exclusion.key, {
                                                            exclusionId: value,
                                                            exclusionName:
                                                                batches.find((b) => b.id === value)
                                                                    ?.label ?? '',
                                                        })
                                                    }
                                                    options={batches.map((b) => ({
                                                        value: b.id,
                                                        label: b.label,
                                                    }))}
                                                    placeholder={`Select a ${batchNoun}`}
                                                    searchPlaceholder={`Search ${batchNounPlural}…`}
                                                    emptyText={`No ${batchNounPlural} found.`}
                                                />
                                            ) : exclusion.exclusionType === 'TAG' ? (
                                                <SearchableSelect
                                                    value={exclusion.exclusionId}
                                                    onChange={(value) =>
                                                        updateExclusion(exclusion.key, {
                                                            exclusionId: value,
                                                            exclusionName:
                                                                tags.find((t) => t.id === value)
                                                                    ?.tagName ?? '',
                                                        })
                                                    }
                                                    options={tags.map((t) => ({
                                                        value: t.id,
                                                        label: t.tagName,
                                                    }))}
                                                    placeholder="Select a tag"
                                                    searchPlaceholder="Search tags…"
                                                    emptyText="No tags found."
                                                />
                                            ) : (
                                                <Input
                                                    value={exclusion.exclusionId}
                                                    onChange={(e) =>
                                                        updateExclusion(exclusion.key, {
                                                            exclusionId: e.target.value,
                                                        })
                                                    }
                                                    placeholder="User id or email"
                                                />
                                            )}
                                        </div>

                                        <MyButton
                                            buttonType="secondary"
                                            scale="small"
                                            layoutVariant="icon"
                                            aria-label="Remove exclusion"
                                            onClick={() =>
                                                onChange({
                                                    exclusions: rule.exclusions.filter(
                                                        (e) => e.key !== exclusion.key
                                                    ),
                                                })
                                            }
                                        >
                                            <X className="size-4" />
                                        </MyButton>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>

            {rule.type === 'TAG' && rule.tagIds.length > 0 && (
                <p className="mt-3 flex items-center gap-1.5 text-caption text-muted-foreground">
                    <UsersThree className="size-4" />
                    {props.tagReachLoading
                        ? 'Estimating reach…'
                        : props.tagReach !== null
                          ? `About ${props.tagReach.toLocaleString()} people carry the tags selected across this announcement.`
                          : 'Reach estimate unavailable.'}
                </p>
            )}
        </div>
    );
}
