import { CheckCircle, ListChecks, PencilSimple } from '@phosphor-icons/react';
import { MyButton } from '@/components/design-system/button';
import type { MediumType, ModeType } from '@/services/announcement';
import type { CreateAnnouncementRequest } from '@/services/announcement';
import { MEDIUM_META, MODE_META } from '../../-utils/constants';
import { SectionCard, SummaryRow } from '../primitives';
import type { AudienceRule, BatchOption, ScheduleType, FormSectionId } from '../../-types';

interface ReviewStepProps {
    title: string;
    previewText: string;
    contentText: string;
    rules: AudienceRule[];
    batchById: Record<string, BatchOption>;
    tagNameById: Record<string, string>;
    recipients: CreateAnnouncementRequest['recipients'];
    modes: ModeType[];
    mediums: MediumType[];
    emailSenderLabel: string;
    whatsappTemplateName: string;
    scheduleType: ScheduleType;
    timezone: string;
    oneTimeStart: string;
    cronExpression: string;
    batchNounPlural: string;
    onEditSection: (step: FormSectionId) => void;
}

const Chip = ({ children }: { children: React.ReactNode }) => (
    <span className="rounded-full border border-border bg-muted/60 px-2 py-0.5 text-caption text-foreground">
        {children}
    </span>
);

function describeRule(
    rule: AudienceRule,
    batchById: Record<string, BatchOption>,
    tagNameById: Record<string, string>,
    batchNounPlural: string
): string {
    switch (rule.type) {
        case 'ROLE':
            return `Everyone with the ${rule.roleId.toLowerCase()} role`;
        case 'PACKAGE_SESSION': {
            const names = rule.packageSessionIds
                .map((id) => batchById[id]?.label ?? id)
                .slice(0, 3)
                .join(', ');
            const extra = rule.packageSessionIds.length - 3;
            const role = rule.orgRole ? ` (${rule.orgRole.toLowerCase()}s)` : '';
            return `${rule.packageSessionIds.length} ${batchNounPlural}${role}: ${names}${
                extra > 0 ? ` and ${extra} more` : ''
            }`;
        }
        case 'USER':
            return `${rule.userIds.length} specific ${rule.userIds.length === 1 ? 'person' : 'people'}`;
        case 'TAG':
            return `Tagged: ${rule.tagIds.map((id) => tagNameById[id] ?? id).join(', ')}`;
        case 'AUDIENCE':
            return `Campaign: ${rule.campaignName || rule.campaignId}`;
        case 'CUSTOM_FIELD_FILTER':
            return `Field filters: ${rule.fieldFilters
                .filter((f) => f.fieldId)
                .map(
                    (f) =>
                        `${f.fieldName} ${f.operator ?? 'is'} ${
                            Array.isArray(f.filterValue) ? f.filterValue.join('/') : f.filterValue
                        }`
                )
                .join('; ')}`;
        default:
            return '—';
    }
}

export function ReviewStep(props: ReviewStepProps) {
    const scheduleLabel =
        props.scheduleType === 'IMMEDIATE'
            ? `Immediately (${props.timezone})`
            : props.scheduleType === 'ONE_TIME'
              ? `${props.oneTimeStart.replace('T', ', ') || '—'} (${props.timezone})`
              : `Repeating — ${props.cronExpression || '—'} (${props.timezone})`;

    const EditButton = ({ step }: { step: FormSectionId }) => (
        <MyButton buttonType="text" scale="small" onClick={() => props.onEditSection(step)}>
            <PencilSimple className="mr-1 size-4" />
            Edit
        </MyButton>
    );

    return (
        <div className="space-y-6">
            <SectionCard title="Message" Icon={ListChecks} action={<EditButton step="basics" />}>
                <dl className="divide-y">
                    <SummaryRow label="Title">{props.title || '—'}</SummaryRow>
                    <SummaryRow label="Preview text">{props.previewText || '—'}</SummaryRow>
                    <SummaryRow label="Content">
                        <p className="line-clamp-3 text-muted-foreground">
                            {props.contentText || '—'}
                        </p>
                    </SummaryRow>
                </dl>
            </SectionCard>

            <SectionCard
                title="Recipients"
                description={`${props.recipients.length} targeting ${
                    props.recipients.length === 1 ? 'entry' : 'entries'
                } will be sent to the server, de-duplicated on delivery.`}
                Icon={CheckCircle}
                action={<EditButton step="recipients" />}
            >
                {props.rules.length === 0 ? (
                    <p className="text-body text-muted-foreground">No audience selected.</p>
                ) : (
                    <ul className="space-y-2">
                        {props.rules.map((rule) => (
                            <li
                                key={rule.key}
                                className="rounded-md border bg-muted/30 px-3 py-2 text-body"
                            >
                                {describeRule(
                                    rule,
                                    props.batchById,
                                    props.tagNameById,
                                    props.batchNounPlural
                                )}
                                {(rule.exclusions.length > 0 || rule.fieldFilters.length > 0) && (
                                    <span className="mt-1 flex flex-wrap gap-1.5">
                                        {rule.fieldFilters.length > 0 && (
                                            <Chip>{rule.fieldFilters.length} filter(s)</Chip>
                                        )}
                                        {rule.exclusions.length > 0 && (
                                            <Chip>{rule.exclusions.length} exclusion(s)</Chip>
                                        )}
                                    </span>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </SectionCard>

            <SectionCard
                title="Placement and delivery"
                Icon={CheckCircle}
                action={<EditButton step="delivery" />}
            >
                <dl className="divide-y">
                    <SummaryRow label="Appears in">
                        <span className="flex flex-wrap gap-1.5">
                            {props.modes.length === 0
                                ? '—'
                                : props.modes.map((mode) => (
                                      <Chip key={mode}>
                                          {MODE_META.find((m) => m.type === mode)?.label ?? mode}
                                      </Chip>
                                  ))}
                        </span>
                    </SummaryRow>
                    <SummaryRow label="Delivered via">
                        <span className="flex flex-wrap gap-1.5">
                            {props.mediums.length === 0
                                ? 'In-product only'
                                : props.mediums.map((medium) => (
                                      <Chip key={medium}>
                                          {MEDIUM_META.find((m) => m.type === medium)?.label ??
                                              medium}
                                      </Chip>
                                  ))}
                        </span>
                    </SummaryRow>
                    {props.mediums.includes('EMAIL') && (
                        <SummaryRow label="Email from">{props.emailSenderLabel || '—'}</SummaryRow>
                    )}
                    {props.mediums.includes('WHATSAPP') && (
                        <SummaryRow label="WhatsApp template">
                            {props.whatsappTemplateName || '—'}
                        </SummaryRow>
                    )}
                    <SummaryRow label="Schedule">{scheduleLabel}</SummaryRow>
                </dl>
            </SectionCard>
        </div>
    );
}
