import { TestContent } from '@/types/assessments/schedule-test-list';
import { MyButton } from '@/components/design-system/button';
import {
    ArrowSquareOut,
    CalendarBlank,
    CalendarCheck,
    CheckSquareOffset,
    Copy,
    DownloadSimple,
    LinkSimple,
    QrCode,
    Timer,
    UsersThree,
    WarningCircle,
} from '@phosphor-icons/react';
import QRCode from 'react-qr-code';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { resolveSubjectName } from '@/services/subject-names';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useInstituteQuery } from '@/services/student-list-section/getInstituteDetails';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
    copyToClipboard,
    getAssessmentJoinLink,
    handleDownloadQRCode,
} from '../../create-assessment/$assessmentId/$examtype/-utils/helper';
import { ScheduleTestMainDropdownComponent } from './ScheduleTestDetailsDropdownMenu';
import { useNavigate } from '@tanstack/react-router';
import { useRef } from 'react';
import { getBatchNamesByIds } from '../assessment-details/$assessmentId/$examType/$assesssmentType/$assessmentTab/-utils/helper';
import { ContentTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';
import {
    getTerminology,
    getTerminologyPlural,
} from '@/components/common/layout-container/sidebar/utils';
import { useTranslation } from 'react-i18next';
import {
    AccessBadge,
    SessionBatches,
    SessionCardFooter,
    SessionCardShell,
    SessionMetaDivider,
    SessionMetaItem,
    SessionMetaRow,
} from '@/routes/study-library/live-session/-components/session-card-shell';
import {
    AssessmentIconBox,
    AssessmentTag,
    statusForTab,
    typeMetaFor,
} from './assessment-presentation';

/**
 * "26 Sep 2026, 6:15 PM" in the viewer's zone. Same UTC handling as
 * convertToLocalDateTime (the API sometimes omits the trailing Z), shorter text
 * so the metadata row fits on one line.
 */
const toCardDate = (value: string | null | undefined): string => {
    if (!value) return '';
    const hasTimezone = /Z$|[+-]\d{2}:?\d{2}$/i.test(value);
    const date = new Date(hasTimezone ? value : `${value.replace(' ', 'T')}Z`);
    return Number.isNaN(date.getTime()) ? '' : format(date, 'dd MMM yyyy, h:mm a');
};

/**
 * One assessment in the list, drawn with the same card system as the live
 * session list (shell, metadata row, batches, footer) so the two lists read
 * alike. Presentation only: navigation, copy, QR download and the ⋮ menu do
 * exactly what they did before.
 */
const ScheduleTestDetails = ({
    scheduleTestContent,
    selectedTab,
    handleRefetchData,
    subjectNamesById = {},
}: {
    scheduleTestContent: TestContent;
    selectedTab: string;
    handleRefetchData: () => void;
    /** Names for the subject ids the institute list cannot resolve — see subject-names.ts. */
    subjectNamesById?: Record<string, string>;
}) => {
    const { t } = useTranslation('assessmentScheduleTestDetails');
    const navigate = useNavigate();
    const cardRef = useRef<HTMLDivElement>(null);
    const { data: instituteDetails, isLoading } = useSuspenseQuery(useInstituteQuery());
    const batchNames = getBatchNamesByIds(
        instituteDetails?.batches_for_sessions,
        scheduleTestContent.batch_ids
    );
    const handleNavigateAssessment = (assessmentId: string) => {
        navigate({
            to: '/assessment/assessment-list/assessment-details/$assessmentId/$examType/$assesssmentType/$assessmentTab',
            params: {
                assessmentId: assessmentId,
                examType: scheduleTestContent.play_mode,
                assesssmentType: scheduleTestContent.assessment_visibility,
                assessmentTab: selectedTab,
            },
        });
    };

    // Dialogs and popovers portal to document.body, but React re-bubbles their
    // clicks through the component tree — only a click that really lands inside
    // the card opens the assessment.
    const handleCardClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!cardRef.current?.contains(e.target as Node)) return;
        handleNavigateAssessment(scheduleTestContent.assessment_id);
    };

    const joinLink = getAssessmentJoinLink(
        instituteDetails?.learner_portal_base_url,
        scheduleTestContent.join_link
    );
    const qrId = `qr-code-svg-assessment-list-${scheduleTestContent.join_link}`;

    const playMode = scheduleTestContent.play_mode;
    const type = typeMetaFor(playMode);
    const status = statusForTab(selectedTab);
    const hasWindow = playMode === 'EXAM' || playMode === 'SURVEY';
    const hasDuration = playMode === 'EXAM' || playMode === 'MOCK';
    const isPrivate = scheduleTestContent.assessment_visibility === 'PRIVATE';
    const subjectName = resolveSubjectName(
        instituteDetails?.subjects,
        subjectNamesById,
        scheduleTestContent.subject_id
    );
    const subtitle = [
        t(`types.${type.key}`),
        subjectName
            ? t('info.subject', {
                  label: getTerminology(ContentTerms.Subjects, SystemTerms.Subjects),
                  name: subjectName,
              })
            : null,
        scheduleTestContent.created_at
            ? t('meta.createdOn', { date: toCardDate(scheduleTestContent.created_at) })
            : null,
    ]
        .filter(Boolean)
        .join(' · ');

    const duration = scheduleTestContent.duration;
    const durationLabel =
        duration >= 60
            ? [
                  t('info.duration.hours', { count: Math.floor(duration / 60) }),
                  duration % 60 > 0 ? t('info.duration.minutes', { count: duration % 60 }) : null,
              ]
                  .filter(Boolean)
                  .join(' ')
            : t('info.duration.minutes', { count: duration });

    const copyLink = async () => {
        await copyToClipboard(joinLink);
        toast.success(t('joinLink.copied'));
    };

    if (isLoading) return <DashboardLoader />;
    return (
        <SessionCardShell cardRef={cardRef} onClick={handleCardClick}>
            <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                    <AssessmentIconBox Icon={type.Icon} tone={type.tone} />
                    <div className="min-w-0">
                        <h3
                            className="truncate text-base font-semibold text-neutral-900 sm:text-lg"
                            title={scheduleTestContent.name}
                        >
                            {scheduleTestContent.name}
                        </h3>
                        {subtitle ? (
                            <p
                                className="mt-0.5 truncate text-sm text-neutral-500"
                                title={subtitle}
                            >
                                {subtitle}
                            </p>
                        ) : null}
                    </div>
                </div>
                <div
                    className="flex shrink-0 flex-wrap items-center justify-end gap-2"
                    onClick={(e) => e.stopPropagation()}
                >
                    <AssessmentTag tone={status.tone} dot>
                        {t(`status.${status.key}`)}
                    </AssessmentTag>
                    <AccessBadge
                        accessLevel={scheduleTestContent.assessment_visibility?.toLowerCase()}
                    />
                    <ScheduleTestMainDropdownComponent
                        scheduleTestContent={scheduleTestContent}
                        selectedTab={selectedTab}
                        handleRefetchData={handleRefetchData}
                    />
                </div>
            </div>

            <SessionMetaRow>
                {hasWindow && (
                    <SessionMetaItem
                        icon={<CalendarBlank size={16} />}
                        tone="primary"
                        label={t('meta.starts')}
                        value={toCardDate(scheduleTestContent.bound_start_time)}
                    />
                )}
                {hasWindow && (
                    <SessionMetaItem
                        icon={<CalendarCheck size={16} />}
                        tone="info"
                        label={t('meta.ends')}
                        value={toCardDate(scheduleTestContent.bound_end_time)}
                    />
                )}
                {hasDuration && (
                    <SessionMetaItem
                        icon={<Timer size={16} />}
                        tone="warning"
                        label={t('meta.duration')}
                        value={durationLabel}
                    />
                )}
                {hasWindow || hasDuration ? <SessionMetaDivider /> : null}
                <SessionMetaItem
                    icon={<UsersThree size={16} />}
                    tone="success"
                    label={t('meta.participants')}
                    value={
                        <span className="font-semibold text-neutral-900">
                            {scheduleTestContent.user_registrations}
                        </span>
                    }
                />
                <SessionMetaItem
                    icon={<CheckSquareOffset size={16} />}
                    tone="neutral"
                    label={t('meta.evaluation')}
                    value={
                        scheduleTestContent.evaluation_type === 'MANUAL'
                            ? t('meta.evaluationManual')
                            : t('meta.evaluationAuto')
                    }
                />
            </SessionMetaRow>

            <SessionCardFooter>
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-8 gap-y-3">
                    {batchNames.length ? (
                        <SessionBatches
                            batches={batchNames}
                            maxVisible={2}
                            label={getTerminologyPlural(ContentTerms.Batch, SystemTerms.Batch)}
                            moreLabel={(count) => t('batchDialog.moreLink', { count })}
                            lessLabel={t('batches.less')}
                        />
                    ) : null}
                    {batchNames.length ? <SessionMetaDivider /> : null}
                    <div
                        className="flex min-w-0 items-center gap-2"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <LinkSimple size={16} className="shrink-0 text-primary-500" />
                        <div className="min-w-0 leading-tight">
                            <div className="flex items-center gap-1 text-xs text-neutral-500">
                                {t('meta.joinLink')}
                                {isPrivate ? (
                                    <TooltipProvider delayDuration={150}>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <span
                                                    className="inline-flex items-center text-warning-600"
                                                    aria-label={t('joinLink.privateWarning')}
                                                >
                                                    <WarningCircle size={12} weight="fill" />
                                                </span>
                                            </TooltipTrigger>
                                            <TooltipContent className="max-w-xs">
                                                {t('joinLink.privateWarning')}
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                ) : null}
                            </div>
                            <div
                                className="mt-0.5 max-w-xs truncate text-sm text-neutral-700"
                                title={joinLink}
                            >
                                {joinLink}
                            </div>
                        </div>
                        <MyButton
                            type="button"
                            scale="medium"
                            buttonType="secondary"
                            layoutVariant="icon"
                            aria-label={t('joinLink.copy')}
                            title={t('joinLink.copy')}
                            onClick={copyLink}
                        >
                            <Copy size={16} />
                        </MyButton>
                        <Popover>
                            <PopoverTrigger asChild>
                                <MyButton
                                    type="button"
                                    scale="medium"
                                    buttonType="secondary"
                                    layoutVariant="icon"
                                    aria-label={t('joinLink.qr')}
                                    title={t('joinLink.qr')}
                                >
                                    <QrCode size={16} />
                                </MyButton>
                            </PopoverTrigger>
                            <PopoverContent
                                align="end"
                                className="flex w-56 flex-col items-center gap-3 p-4"
                            >
                                <QRCode value={joinLink} className="size-40" id={qrId} />
                                <MyButton
                                    type="button"
                                    scale="medium"
                                    buttonType="secondary"
                                    className="w-full gap-1.5"
                                    onClick={() => handleDownloadQRCode(qrId)}
                                >
                                    <DownloadSimple size={16} />
                                    {t('joinLink.downloadQr')}
                                </MyButton>
                            </PopoverContent>
                        </Popover>
                    </div>
                </div>
                <div
                    className="flex shrink-0 items-center gap-2"
                    onClick={(e) => e.stopPropagation()}
                >
                    <MyButton
                        type="button"
                        scale="medium"
                        buttonType="secondary"
                        className="w-full gap-1.5 sm:w-auto sm:!min-w-0 sm:px-5"
                        onClick={() => handleNavigateAssessment(scheduleTestContent.assessment_id)}
                    >
                        <ArrowSquareOut size={16} />
                        {t('actions.viewDetails')}
                    </MyButton>
                </div>
            </SessionCardFooter>
        </SessionCardShell>
    );
};

export default ScheduleTestDetails;
