import { useCallback, useEffect, useMemo, useState } from 'react';
import { createLazyFileRoute, useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import { ListChecks, PaperPlaneTilt } from '@phosphor-icons/react';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { MyButton } from '@/components/design-system/button';
import { MyDialog } from '@/components/design-system/dialog';
import { AnnouncementService, type MediumType, type ModeType } from '@/services/announcement';
import { getUserId, getUserName } from '@/utils/userDetails';
import {
    getTerminology,
    getTerminologyPlural,
} from '@/components/common/layout-container/sidebar/utils';
import { ContentTerms, RoleTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';
import { PreviewPanel } from './-components/PreviewPanel';
import { IssueSummary } from './-components/primitives';
import { BasicInfoStep } from './-components/steps/BasicInfoStep';
import { RecipientsStep } from './-components/steps/RecipientsStep';
import { DisplayLocationsStep } from './-components/steps/DisplayLocationsStep';
import { DeliveryStep } from './-components/steps/DeliveryStep';
import { ReviewStep } from './-components/steps/ReviewStep';
import { useAnnouncementDraft } from './-hooks/useAnnouncementDraft';
import { ANNOUNCEMENT_PRESETS, FORM_SECTIONS, defaultModeSettings } from './-utils/constants';
import { mergeErrors, validateAll } from './-utils/validation';
import { buildCreatePayload, expandRecipients, interpretApiError } from './-utils/payload';
import type { FieldErrors, FormSectionId } from './-types';

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

/** Anchors so the review summary's "Edit" links can jump to the right section. */
const SECTION_ID: Record<FormSectionId, string> = {
    basics: 'announcement-basics',
    recipients: 'announcement-recipients',
    placements: 'announcement-placements',
    delivery: 'announcement-delivery',
    review: 'announcement-basics',
};

function CreateAnnouncementPage() {
    const { setNavHeading } = useNavHeadingStore();
    const navigate = useNavigate();
    const draft = useAnnouncementDraft();

    const [contentView, setContentView] = useState<'editor' | 'source'>('editor');
    const [submitting, setSubmitting] = useState(false);
    /** Errors stay hidden until the first create attempt, so a fresh form isn't a wall of red. */
    const [attempted, setAttempted] = useState(false);
    const [serverErrors, setServerErrors] = useState<FieldErrors>({});
    const [reviewOpen, setReviewOpen] = useState(false);

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

    const errors = useMemo<FieldErrors>(
        () => ({ ...mergeErrors(validation), ...serverErrors }),
        [validation, serverErrors]
    );

    /** Every blocker on the page, in section order, so the summary reads top to bottom. */
    const blockers = useMemo(
        () =>
            FORM_SECTIONS.filter((definition) => definition.id !== 'review').flatMap(
                (definition) => validation[definition.id].blockers
            ),
        [validation]
    );

    const warnings = useMemo(
        () =>
            FORM_SECTIONS.filter((definition) => definition.id !== 'review').flatMap(
                (definition) => validation[definition.id].warnings
            ),
        [validation]
    );

    /** Has the user actually begun filling this in? Gates the advisory notes. */
    const started = draft.title.trim().length > 0 || draft.contentText.trim().length > 0;

    const scrollToSection = useCallback((section: FormSectionId) => {
        setReviewOpen(false);
        if (typeof document === 'undefined') return;
        document
            .getElementById(SECTION_ID[section])
            ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, []);

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
    const tagNameById = useMemo(
        () =>
            Object.fromEntries(Object.entries(draft.tagById).map(([id, tag]) => [id, tag.tagName])),
        [draft.tagById]
    );

    const recipientsPreview = useMemo(
        () => expandRecipients(draft.rules, draft.batchById, tagNameById),
        [draft.rules, draft.batchById, tagNameById]
    );

    const handleCreate = async () => {
        setAttempted(true);
        setServerErrors({});

        if (blockers.length > 0) {
            const firstBroken = FORM_SECTIONS.find(
                (definition) =>
                    definition.id !== 'review' && validation[definition.id].blockers.length > 0
            );
            if (firstBroken) scrollToSection(firstBroken.id);
            toast.error(
                `Fix ${blockers.length} ${blockers.length === 1 ? 'issue' : 'issues'} before creating this announcement.`
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
                tagNameById,
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
            if (failure.section) scrollToSection(failure.section);
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

    const reviewBody = (
        <div className="space-y-6">
            <ReviewStep
                title={draft.title}
                previewText={draft.previewText}
                contentText={draft.contentText}
                rules={draft.rules}
                batchById={draft.batchById}
                tagNameById={tagNameById}
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
                onEditSection={scrollToSection}
            />
            <div className="space-y-2">
                <h3 className="text-subtitle font-semibold">How it will look</h3>
                <PreviewPanel
                    title={draft.title}
                    previewText={draft.previewText}
                    htmlContent={draft.htmlContent}
                    contentText={draft.contentText}
                    modes={draft.modes}
                    push={draft.push}
                    whatsapp={draft.whatsapp}
                    whatsappTemplate={draft.selectedWaTemplate}
                    senderName={emailSenderLabel}
                />
            </div>
        </div>
    );

    return (
        <div className="flex min-h-full flex-1 flex-col">
            <div className="flex-1 px-4 py-6 sm:px-6">
                <div className="mx-auto w-full max-w-5xl">
                    <div className="min-w-0 space-y-6">
                        {/* A pristine form shouldn't greet the user with advice about content
                            they haven't written yet. */}
                        <IssueSummary
                            blockers={blockers}
                            warnings={started || attempted ? warnings : []}
                            showBlockers={attempted}
                        />

                        <section id={SECTION_ID.basics} className="scroll-mt-24">
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
                                showErrors={attempted}
                            />
                        </section>

                        <section id={SECTION_ID.recipients} className="scroll-mt-24">
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
                                showErrors={attempted}
                            />
                        </section>

                        <section id={SECTION_ID.placements} className="scroll-mt-24">
                            <DisplayLocationsStep
                                modes={draft.modes}
                                modeSettings={draft.modeSettings}
                                allowedModes={draft.allowedModes}
                                loading={draft.permissionsLoading}
                                onToggle={draft.toggleMode}
                                onSettingsChange={draft.updateModeSettings}
                                errors={errors}
                                showErrors={attempted}
                            />
                        </section>

                        <section id={SECTION_ID.delivery} className="scroll-mt-24">
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
                                showErrors={attempted}
                            />
                        </section>
                    </div>
                </div>
            </div>

            <div className="sticky bottom-0 z-20 border-t bg-background/95 px-4 py-3 backdrop-blur sm:px-6">
                <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-end gap-3">
                    <MyButton
                        buttonType="secondary"
                        scale="medium"
                        onClick={() => setReviewOpen(true)}
                        disable={submitting}
                    >
                        <ListChecks className="mr-1 size-4" />
                        Review &amp; preview
                    </MyButton>
                    <MyButton
                        buttonType="primary"
                        scale="medium"
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
                </div>
            </div>

            <MyDialog
                heading="Review & preview"
                open={reviewOpen}
                onOpenChange={setReviewOpen}
                dialogWidth="max-w-4xl"
                footer={
                    <>
                        <MyButton
                            buttonType="secondary"
                            scale="medium"
                            onClick={() => setReviewOpen(false)}
                        >
                            Keep editing
                        </MyButton>
                        <MyButton
                            buttonType="primary"
                            scale="medium"
                            disable={submitting}
                            onClick={() => {
                                setReviewOpen(false);
                                void handleCreate();
                            }}
                        >
                            {draft.scheduleType === 'IMMEDIATE'
                                ? 'Create and send'
                                : 'Schedule announcement'}
                        </MyButton>
                    </>
                }
            >
                {reviewBody}
            </MyDialog>
        </div>
    );
}
