import { useCallback, useEffect, useMemo, useState } from 'react';
import { createLazyFileRoute, useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, Eye, PaperPlaneTilt } from '@phosphor-icons/react';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { MyButton } from '@/components/design-system/button';
import { AnnouncementService, type MediumType, type ModeType } from '@/services/announcement';
import { getUserId, getUserName } from '@/utils/userDetails';
import {
    getTerminology,
    getTerminologyPlural,
} from '@/components/common/layout-container/sidebar/utils';
import { ContentTerms, RoleTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';
import { WizardRail } from './-components/WizardRail';
import { PreviewRail } from './-components/PreviewRail';
import { IssueSummary } from './-components/primitives';
import { BasicInfoStep } from './-components/steps/BasicInfoStep';
import { RecipientsStep } from './-components/steps/RecipientsStep';
import { DisplayLocationsStep } from './-components/steps/DisplayLocationsStep';
import { DeliveryStep } from './-components/steps/DeliveryStep';
import { ReviewStep } from './-components/steps/ReviewStep';
import { useAnnouncementDraft } from './-hooks/useAnnouncementDraft';
import { ANNOUNCEMENT_PRESETS, WIZARD_STEPS, defaultModeSettings } from './-utils/constants';
import { mergeErrors, validateAll, validateStep } from './-utils/validation';
import { buildCreatePayload, expandRecipients, interpretApiError } from './-utils/payload';
import type { FieldErrors, WizardStepId } from './-types';

export const Route = createLazyFileRoute('/announcement/create/')({
    component: () => (
        /* overflow-x-clip overrides the layout's overflow-x-hidden. `hidden` computes overflow-y
           to `auto`, which turns the layout into a scroll container and silently kills the sticky
           footer and preview rail below; `clip` clips exactly the same way without creating one.
           Browsers too old for `clip` drop the declaration and keep `hidden` — sticky then simply
           degrades to static, which this layout still reads correctly. */
        <LayoutContainer intrnalMargin={false} className="overflow-x-clip">
            <CreateAnnouncementPage />
        </LayoutContainer>
    ),
});

function CreateAnnouncementPage() {
    const { setNavHeading } = useNavHeadingStore();
    const navigate = useNavigate();
    const draft = useAnnouncementDraft();

    const [step, setStep] = useState<WizardStepId>('basics');
    const [visited, setVisited] = useState<Set<WizardStepId>>(new Set(['basics']));
    /** Steps the user has tried to leave — only these show blocking errors. */
    const [attempted, setAttempted] = useState<Set<WizardStepId>>(new Set());
    const [contentView, setContentView] = useState<'editor' | 'source'>('editor');
    const [submitting, setSubmitting] = useState(false);
    const [serverErrors, setServerErrors] = useState<FieldErrors>({});
    const [previewOpen, setPreviewOpen] = useState(false);

    useEffect(() => {
        setNavHeading('Create Announcement');
    }, [setNavHeading]);

    const batchNoun = getTerminology(ContentTerms.Batch, SystemTerms.Batch).toLowerCase();
    const batchNounPlural = getTerminologyPlural(
        ContentTerms.Batch,
        SystemTerms.Batch
    ).toLowerCase();
    const learnerNounPlural = getTerminologyPlural(
        RoleTerms.Learner,
        SystemTerms.Learner
    ).toLowerCase();
    const teacherNounPlural = getTerminologyPlural(
        RoleTerms.Teacher,
        SystemTerms.Teacher
    ).toLowerCase();

    // ------------------------------------------------------------------ validation
    const validationInput = useMemo(
        () => ({
            title: draft.title,
            htmlContent: draft.htmlContent,
            contentText: draft.contentText,
            previewText: draft.previewText,
            rules: draft.rules,
            batchById: draft.batchById,
            modes: draft.modes,
            modeSettings: draft.modeSettings,
            mediums: draft.mediums,
            push: draft.push,
            email: draft.email,
            whatsapp: draft.whatsapp,
            selectedWaTemplate: draft.selectedWaTemplate,
            hasEmailSenders: draft.emailSenders.length > 0,
            scheduleType: draft.scheduleType,
            oneTimeStart: draft.oneTimeStart,
            cronExpression: draft.cronExpression,
        }),
        [
            draft.title,
            draft.htmlContent,
            draft.contentText,
            draft.previewText,
            draft.rules,
            draft.batchById,
            draft.modes,
            draft.modeSettings,
            draft.mediums,
            draft.push,
            draft.email,
            draft.whatsapp,
            draft.selectedWaTemplate,
            draft.emailSenders.length,
            draft.scheduleType,
            draft.oneTimeStart,
            draft.cronExpression,
        ]
    );

    const validation = useMemo(() => validateAll(validationInput), [validationInput]);
    const currentValidation = useMemo(
        () => validateStep(step, validationInput),
        [step, validationInput]
    );

    const errors = useMemo<FieldErrors>(
        () => ({ ...mergeErrors(validation), ...serverErrors }),
        [validation, serverErrors]
    );

    const issues = useMemo(
        () =>
            WIZARD_STEPS.reduce<Record<WizardStepId, number>>(
                (acc, definition) => {
                    acc[definition.id] = validation[definition.id].blockers.length;
                    return acc;
                },
                {} as Record<WizardStepId, number>
            ),
        [validation]
    );

    const totalBlockers = Object.values(issues).reduce((sum, count) => sum + count, 0);

    // ------------------------------------------------------------------ navigation
    const goToStep = useCallback((next: WizardStepId) => {
        setStep(next);
        setVisited((prev) => new Set(prev).add(next));
        if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
    }, []);

    const stepIndex = WIZARD_STEPS.findIndex((definition) => definition.id === step);

    const handleNext = () => {
        setAttempted((prev) => new Set(prev).add(step));
        if (currentValidation.blockers.length > 0) {
            toast.error(
                currentValidation.blockers.length === 1
                    ? currentValidation.blockers[0]
                    : `${currentValidation.blockers.length} things need fixing on this step.`
            );
            return;
        }
        const next = WIZARD_STEPS[stepIndex + 1];
        if (next) goToStep(next.id);
    };

    const handleBack = () => {
        const previous = WIZARD_STEPS[stepIndex - 1];
        if (previous) goToStep(previous.id);
    };

    // ------------------------------------------------------------------ presets
    const applyPreset = (presetId: 'GENERAL' | 'PINNED') => {
        const preset = ANNOUNCEMENT_PRESETS.find((p) => p.id === presetId);
        if (!preset) return;
        draft.setModes((prev) => [...new Set([...prev, ...preset.modes])] as ModeType[]);
        draft.setModeSettings((prev) => {
            const next = { ...prev };
            preset.modes.forEach((mode) => {
                if (!next[mode]) next[mode] = defaultModeSettings(mode);
            });
            return next;
        });
        draft.setMediums((prev) => [...new Set([...prev, ...preset.mediums])] as MediumType[]);
    };

    // ------------------------------------------------------------------ submit
    const recipientsPreview = useMemo(
        () =>
            expandRecipients(
                draft.rules,
                draft.batchById,
                Object.fromEntries(Object.entries(draft.tagById).map(([id, t]) => [id, t.tagName]))
            ),
        [draft.rules, draft.batchById, draft.tagById]
    );

    const handleCreate = async () => {
        setAttempted(new Set(WIZARD_STEPS.map((definition) => definition.id)));
        setServerErrors({});

        const firstBrokenStep = WIZARD_STEPS.find(
            (definition) => validation[definition.id].blockers.length > 0
        );
        if (firstBrokenStep) {
            goToStep(firstBrokenStep.id);
            toast.error(
                `Fix ${totalBlockers} ${totalBlockers === 1 ? 'issue' : 'issues'} before creating this announcement.`
            );
            return;
        }

        setSubmitting(true);
        try {
            const payload = buildCreatePayload({
                title: draft.title,
                htmlContent: draft.htmlContent,
                previewText: draft.previewText,
                createdBy: getUserId(),
                createdByName: getUserName(),
                createdByRole: draft.primaryRole,
                rules: draft.rules,
                batchById: draft.batchById,
                tagNameById: Object.fromEntries(
                    Object.entries(draft.tagById).map(([id, tag]) => [id, tag.tagName])
                ),
                modes: draft.modes,
                modeSettings: draft.modeSettings,
                mediums: draft.mediums,
                push: draft.push,
                email: draft.email,
                emailSenders: draft.emailSenders,
                whatsapp: draft.whatsapp,
                selectedWaTemplate: draft.selectedWaTemplate,
                scheduleType: draft.scheduleType,
                timezone: draft.timezone,
                oneTimeStart: draft.oneTimeStart,
                cronExpression: draft.cronExpression,
            });

            await AnnouncementService.create(payload);
            toast.success(
                draft.scheduleType === 'IMMEDIATE'
                    ? 'Announcement created and queued for delivery.'
                    : 'Announcement scheduled.'
            );
            navigate({ to: '/announcement/history' });
        } catch (err) {
            const failure = interpretApiError(err);
            setServerErrors(failure.fieldErrors);
            toast.error(failure.message);
            if (failure.step) goToStep(failure.step);
        } finally {
            setSubmitting(false);
        }
    };

    // ------------------------------------------------------------------ preview data
    const emailSenderLabel = useMemo(() => {
        const sender = draft.emailSenders.find(
            (config) => `${config.email}-${config.name}` === draft.email.fromKey
        );
        return sender ? `${sender.name} (${sender.email})` : '';
    }, [draft.emailSenders, draft.email.fromKey]);

    const tips = useMemo(() => {
        const list: string[] = [];
        if (!draft.previewText.trim()) list.push('Add preview text so the inbox line reads well.');
        if (draft.title.length > 60)
            list.push('Shorter titles survive truncation on mobile inboxes.');
        if (draft.mediums.includes('WHATSAPP') && !draft.whatsapp.templateName)
            list.push('WhatsApp needs an approved template before it can send.');
        if (draft.rules.length === 0) list.push('Nobody is targeted yet.');
        return list.slice(0, 3);
    }, [
        draft.previewText,
        draft.title,
        draft.mediums,
        draft.whatsapp.templateName,
        draft.rules.length,
    ]);

    const showErrors = attempted.has(step);

    return (
        <div className="flex min-h-full flex-1 flex-col">
            {/* Deliberately not sticky: the app navbar is already `sticky top-0 z-50`, so anything
                pinned here would scroll underneath it. The footer bar carries the step indicator. */}
            <div className="border-b bg-card px-4 py-3 sm:px-6">
                <WizardRail current={step} visited={visited} issues={issues} onSelect={goToStep} />
            </div>

            <div className="flex-1 px-4 py-6 sm:px-6">
                <div className="mx-auto grid w-full max-w-7xl gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
                    <div className="min-w-0 space-y-6">
                        <IssueSummary
                            blockers={currentValidation.blockers}
                            warnings={currentValidation.warnings}
                            showBlockers={showErrors}
                        />

                        {step === 'basics' && (
                            <BasicInfoStep
                                title={draft.title}
                                onTitleChange={draft.setTitle}
                                previewText={draft.previewText}
                                onPreviewTextChange={draft.setPreviewText}
                                htmlContent={draft.htmlContent}
                                onHtmlContentChange={draft.setHtmlContent}
                                contentView={contentView}
                                onContentViewChange={setContentView}
                                modes={draft.modes}
                                mediums={draft.mediums}
                                onApplyPreset={applyPreset}
                                errors={errors}
                                showErrors={showErrors}
                            />
                        )}

                        {step === 'recipients' && (
                            <RecipientsStep
                                rules={draft.rules}
                                onAddRule={draft.addRule}
                                onUpdateRule={draft.updateRule}
                                onRemoveRule={draft.removeRule}
                                batches={draft.batches}
                                batchesLoading={draft.batchesLoading}
                                batchNoun={batchNoun}
                                batchNounPlural={batchNounPlural}
                                learnerNounPlural={learnerNounPlural}
                                teacherNounPlural={teacherNounPlural}
                                tags={draft.tags}
                                tagsLoading={draft.tagsLoading}
                                tagsError={draft.tagsError}
                                onReloadTags={draft.reloadTags}
                                campaigns={draft.campaigns}
                                campaignsLoading={draft.campaignsLoading}
                                campaignsError={draft.campaignsError}
                                onReloadCampaigns={draft.reloadCampaigns}
                                customFields={draft.customFields}
                                tagReach={draft.tagReach}
                                tagReachLoading={draft.tagReachLoading}
                                errors={errors}
                                showErrors={showErrors}
                            />
                        )}

                        {step === 'placements' && (
                            <DisplayLocationsStep
                                modes={draft.modes}
                                modeSettings={draft.modeSettings}
                                allowedModes={draft.allowedModes}
                                loading={draft.permissionsLoading}
                                onToggle={draft.toggleMode}
                                onSettingsChange={draft.updateModeSettings}
                                errors={errors}
                                showErrors={showErrors}
                            />
                        )}

                        {step === 'delivery' && (
                            <DeliveryStep
                                mediums={draft.mediums}
                                onToggleMedium={draft.toggleMedium}
                                push={draft.push}
                                onPushChange={(patch) => {
                                    draft.setPushSynced(false);
                                    draft.setPush((prev) => ({ ...prev, ...patch }));
                                }}
                                pushSynced={draft.pushSynced}
                                onPushSyncedChange={draft.setPushSynced}
                                email={draft.email}
                                onEmailChange={(patch) =>
                                    draft.setEmail((prev) => ({ ...prev, ...patch }))
                                }
                                onApplyEmailTemplate={draft.applyEmailTemplate}
                                applyingEmailTemplate={draft.applyingEmailTemplate}
                                emailTemplates={draft.emailTemplates}
                                emailTemplatesLoading={draft.emailTemplatesLoading}
                                emailTemplatesError={draft.emailTemplatesError}
                                onLoadEmailTemplates={draft.loadEmailTemplates}
                                emailSenders={draft.emailSenders}
                                emailSendersLoading={draft.emailSendersLoading}
                                emailSendersError={draft.emailSendersError}
                                onReloadEmailSenders={draft.reloadEmailSenders}
                                announcementTitle={draft.title}
                                whatsapp={draft.whatsapp}
                                onWhatsAppChange={(patch) =>
                                    draft.setWhatsapp((prev) => ({ ...prev, ...patch }))
                                }
                                whatsappTemplates={draft.approvedWaTemplates}
                                selectedWhatsAppTemplate={draft.selectedWaTemplate}
                                whatsappLoading={draft.waTemplatesLoading}
                                whatsappError={draft.waTemplatesError}
                                whatsappSyncing={draft.waSyncing}
                                onLoadWhatsApp={draft.loadWhatsAppTemplates}
                                onReloadWhatsApp={() => draft.loadWhatsAppTemplates(true)}
                                onSyncWhatsApp={draft.syncWhatsAppTemplates}
                                scheduleType={draft.scheduleType}
                                onScheduleTypeChange={draft.setScheduleType}
                                timezone={draft.timezone}
                                onTimezoneChange={draft.setTimezone}
                                oneTimeStart={draft.oneTimeStart}
                                onOneTimeStartChange={draft.setOneTimeStart}
                                cronExpression={draft.cronExpression}
                                onCronExpressionChange={draft.setCronExpression}
                                errors={errors}
                                showErrors={showErrors}
                            />
                        )}

                        {step === 'review' && (
                            <ReviewStep
                                title={draft.title}
                                previewText={draft.previewText}
                                contentText={draft.contentText}
                                rules={draft.rules}
                                batchById={draft.batchById}
                                tagNameById={Object.fromEntries(
                                    Object.entries(draft.tagById).map(([id, tag]) => [
                                        id,
                                        tag.tagName,
                                    ])
                                )}
                                recipients={recipientsPreview}
                                modes={draft.modes}
                                mediums={draft.mediums}
                                emailSenderLabel={emailSenderLabel}
                                whatsappTemplateName={draft.whatsapp.templateName}
                                scheduleType={draft.scheduleType}
                                timezone={draft.timezone}
                                oneTimeStart={draft.oneTimeStart}
                                cronExpression={draft.cronExpression}
                                batchNounPlural={batchNounPlural}
                                onEditStep={goToStep}
                            />
                        )}
                    </div>

                    {/* Always mounted so the footer's Preview button can open the dialog on
                        narrow screens; only the inline card is hidden below xl. */}
                    <aside className="min-w-0">
                        {/* top-24 clears the sticky app navbar (max 72px tall). */}
                        <div className="sticky top-24">
                            <PreviewRail
                                title={draft.title}
                                previewText={draft.previewText}
                                htmlContent={draft.htmlContent}
                                contentText={draft.contentText}
                                modes={draft.modes}
                                mediums={draft.mediums}
                                push={draft.push}
                                whatsapp={draft.whatsapp}
                                whatsappTemplate={draft.selectedWaTemplate}
                                senderName={emailSenderLabel}
                                tips={tips}
                                expanded={previewOpen}
                                onExpandedChange={setPreviewOpen}
                                cardClassName="hidden xl:block"
                            />
                        </div>
                    </aside>
                </div>
            </div>

            <div className="sticky bottom-0 z-20 border-t bg-background/95 px-4 py-3 backdrop-blur sm:px-6">
                <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3">
                    <MyButton
                        buttonType="secondary"
                        scale="medium"
                        onClick={handleBack}
                        disable={stepIndex === 0 || submitting}
                    >
                        <ArrowLeft className="mr-1 size-4" />
                        Back
                    </MyButton>

                    <div className="flex items-center gap-3">
                        <p className="hidden text-caption text-muted-foreground sm:block">
                            Step {stepIndex + 1} of {WIZARD_STEPS.length} ·{' '}
                            {WIZARD_STEPS[stepIndex]?.title}
                        </p>
                        <MyButton
                            buttonType="text"
                            scale="small"
                            className="xl:hidden"
                            onClick={() => setPreviewOpen(true)}
                        >
                            <Eye className="mr-1 size-4" />
                            Preview
                        </MyButton>
                    </div>

                    {step === 'review' ? (
                        <MyButton
                            buttonType="primary"
                            scale="large"
                            onClick={handleCreate}
                            disable={submitting}
                            loadingText="Creating…"
                        >
                            <PaperPlaneTilt className="mr-1 size-4" />
                            {submitting
                                ? 'Creating…'
                                : draft.scheduleType === 'IMMEDIATE'
                                  ? 'Create and send'
                                  : 'Schedule announcement'}
                        </MyButton>
                    ) : (
                        <MyButton buttonType="primary" scale="medium" onClick={handleNext}>
                            Continue
                            <ArrowRight className="ml-1 size-4" />
                        </MyButton>
                    )}
                </div>
            </div>
        </div>
    );
}
