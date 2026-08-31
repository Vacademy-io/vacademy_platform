import { Button } from '@/components/ui/button';
import {
    DotsThreeVertical as MoreVertical,
    PencilSimple as Edit2,
    Trash as Trash2,
    Code,
    CodeBlock as Code2,
    UserPlus,
    UploadSimple as Upload,
    ChatText as MessageSquare,
    Lightning as Zap,
    FlowArrow as WorkflowIcon,
    CalendarCheck,
    QrCode,
} from '@phosphor-icons/react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CampaignItem, CampaignListResponse } from '../../-services/get-campaigns-list';
import { deleteAudienceCampaign } from '../../-services/delete-audience-campaign';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { useNavigate } from '@tanstack/react-router';
import { ApiIntegrationDialog } from '../api-integration-dialog/ApiIntegrationDialog';
import { EmbedCodeDialog } from '../embed-code-dialog/EmbedCodeDialog';
import { ShareQrDialog } from '../share-qr-dialog/ShareQrDialog';
import { LeadBulkImportDialog } from '../campaign-users/LeadBulkImportDialog';
import { SendMessageDialog } from '../campaign-users/SendMessageDialog';
import { LinkedWorkflowsDialog } from './linked-workflows-dialog';
import { ConfigureAudienceWorkflowDialog } from './configure-audience-workflow-dialog';
import { BookingSettingsDialog } from '../booking-settings/BookingSettingsDialog';
import { getActiveWorkflowsQuery } from '@/services/workflow-service';
import { parseCustomFieldsFromJson } from '../../-utils/lead-bulk-import-utils';
import { getTerminology } from '@/components/common/layout-container/sidebar/utils';
import { OtherTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';

interface AudienceCampaignCardMenuOptionsProps {
    campaign: CampaignItem;
    onEdit?: (campaign: CampaignItem) => void;
}

export const AudienceCampaignCardMenuOptions = ({
    campaign,
    onEdit,
}: AudienceCampaignCardMenuOptionsProps) => {
    const { t } = useTranslation('audienceManagerAudienceCampaignCardMenuOptions');
    const isOptOut = campaign.campaign_type?.toUpperCase().includes('OPT_OUT');
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
    const [openApiDialog, setOpenApiDialog] = useState(false);
    const [openEmbedDialog, setOpenEmbedDialog] = useState(false);
    const [openQrDialog, setOpenQrDialog] = useState(false);
    const [openBulkImportDialog, setOpenBulkImportDialog] = useState(false);
    const [openSendMessageDialog, setOpenSendMessageDialog] = useState(false);
    const [openLinkedWorkflowsDialog, setOpenLinkedWorkflowsDialog] = useState(false);
    const [openConfigureWorkflowDialog, setOpenConfigureWorkflowDialog] = useState(false);
    const [openBookingSettingsDialog, setOpenBookingSettingsDialog] = useState(false);
    const { instituteDetails } = useInstituteDetailsStore();
    const bulkImportCustomFields = useMemo(
        () =>
            parseCustomFieldsFromJson(
                campaign.institute_custom_fields
                    ? JSON.stringify(campaign.institute_custom_fields)
                    : undefined
            ),
        [campaign.institute_custom_fields]
    );

    const instituteId = instituteDetails?.id || campaign.institute_id;
    const campaignId = campaign.campaign_id || campaign.id || campaign.audience_id;
    // Backend delete endpoint expects `audienceId`, which should be the campaign identifier.
    const audienceIdForDelete = campaignId;

    const deleteCampaignMutation = useMutation({
        mutationFn: async () => {
            if (!instituteId || !audienceIdForDelete) {
                throw new Error('Missing institute or campaign identifier to delete the campaign.');
            }
            return deleteAudienceCampaign(instituteId, audienceIdForDelete);
        },
        onSuccess: () => {
            queryClient.setQueriesData(
                { queryKey: ['campaignsList'] },
                (existingData: CampaignListResponse | undefined) => {
                    if (!existingData) return existingData;
                    const filteredContent = existingData.content?.filter(
                        (item) =>
                            (item.campaign_id || item.id || item.audience_id) !==
                            audienceIdForDelete
                    );
                    return {
                        ...existingData,
                        content: filteredContent,
                        totalElements: Math.max((existingData.totalElements || 1) - 1, 0),
                        numberOfElements: Math.max((existingData.numberOfElements || 1) - 1, 0),
                    };
                }
            );
            queryClient.invalidateQueries({ queryKey: ['campaignsList'] });
            toast.success(t('toast.deleteSuccess'));
            setOpenDeleteDialog(false);
        },
        onError: (error: unknown) => {
            const message = error instanceof Error ? error.message : t('toast.deleteError');
            toast.error(message);
        },
    });

    const handleDeleteCampaign = async () => {
        await deleteCampaignMutation.mutateAsync();
    };

    const handleEdit = () => {
        if (onEdit) {
            onEdit(campaign);
        } else {
            toast.info(t('toast.editComingSoon'));
        }
    };

    const handleAddResponse = () => {
        if (!campaignId) {
            toast.error(t('toast.campaignIdMissing'));
            return;
        }
        navigate({
            to: '/audience-manager/list/campaign-users/add' as any,
            search: {
                campaignId,
                campaignName: campaign.campaign_name,
                customFields: campaign.institute_custom_fields
                    ? JSON.stringify(campaign.institute_custom_fields)
                    : undefined,
            } as any,
        } as any);
    };

    // Workflows linked to this campaign — used to display the count on the
    // "View Linked Workflows" menu item. Shares the same query key as the
    // workflow list page, so React Query dedupes the network call when both
    // are open or already cached.
    const { data: allWorkflows = [] } = useQuery({
        ...getActiveWorkflowsQuery(instituteId ?? ''),
        // Soft-load — don't block menu render on this. Default staleTime in the
        // query is 5 min; refetch on dropdown open via React Query auto-revalidate.
        enabled: !!instituteId,
    });
    // Match logic intentionally mirrors LinkedWorkflowsDialog so the count
    // shown here is exactly what the dialog will display.
    const linkedCount = useMemo(() => {
        if (!campaignId) return 0;
        return allWorkflows.filter((w) => {
            const trigger = w.trigger;
            if (!trigger || !trigger.trigger_event_name) return false;
            // Keep in sync with AUDIENCE_TRIGGER_EVENTS in linked-workflows-dialog.tsx
            if (trigger.trigger_event_name !== 'AUDIENCE_LEAD_SUBMISSION') return false;
            return trigger.event_id === campaignId || trigger.event_id === null;
        }).length;
    }, [allWorkflows, campaignId]);

    const handleConfigureWorkflow = () => {
        if (!campaignId) {
            toast.error(t('toast.campaignIdMissing'));
            return;
        }
        // Inline quick-create dialog — handles the two common cases
        // (confirmation email + N-day follow-up) without taking the user out
        // to the full workflow builder. For more complex flows the admin can
        // still go through Communications → Workflows → Create.
        setOpenConfigureWorkflowDialog(true);
    };

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="size-8 p-0">
                        <MoreVertical className="size-4" />
                        <span className="sr-only">{t('menu.openMenu')}</span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleEdit}>
                        <Edit2 className="mr-2 size-4" />
                        {t('menu.edit')}
                    </DropdownMenuItem>
                    {!isOptOut && (
                        <DropdownMenuItem onClick={handleAddResponse}>
                            <UserPlus className="mr-2 size-4" />
                            {t('menu.addResponse')}
                        </DropdownMenuItem>
                    )}
                    {!isOptOut && (
                        <DropdownMenuItem onClick={() => setOpenBulkImportDialog(true)}>
                            <Upload className="mr-2 size-4" />
                            {t('menu.bulkImportCsv')}
                        </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => setOpenSendMessageDialog(true)}>
                        <MessageSquare className="mr-2 size-4" />
                        {t('menu.sendMessage')}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleConfigureWorkflow}>
                        <Zap className="mr-2 size-4" />
                        {t('menu.configureWorkflow')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setOpenLinkedWorkflowsDialog(true)}>
                        <WorkflowIcon className="mr-2 size-4" />
                        {t('menu.viewLinkedWorkflows')}
                        {linkedCount > 0 && (
                            <span className="ml-auto rounded-full bg-primary-100 text-primary-700 px-2 py-0.5 text-caption font-semibold">
                                {linkedCount}
                            </span>
                        )}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        onClick={() => {
                            if (!campaignId) {
                                toast.error(t('toast.campaignIdMissing'));
                                return;
                            }
                            setOpenBookingSettingsDialog(true);
                        }}
                    >
                        <CalendarCheck className="mr-2 size-4" />
                        {t('menu.bookingSettings')}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        onClick={() => {
                            if (!campaignId) {
                                toast.error(t('toast.campaignIdMissing'));
                                return;
                            }
                            setOpenQrDialog(true);
                        }}
                    >
                        <QrCode className="mr-2 size-4" />
                        {t('menu.shareQrCode')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setOpenApiDialog(true)}>
                        <Code className="mr-2 size-4" />
                        {t('menu.apiIntegration')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setOpenEmbedDialog(true)}>
                        <Code2 className="mr-2 size-4" />
                        {t('menu.getEmbedCode')}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        className="text-red-600 focus:text-red-600"
                        onClick={() => setOpenDeleteDialog(true)}
                    >
                        <Trash2 className="mr-2 size-4" />
                        {t('menu.delete')}
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <AlertDialog open={openDeleteDialog} onOpenChange={setOpenDeleteDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {t('deleteDialog.title', {
                                term: getTerminology(
                                    OtherTerms.AudienceList,
                                    SystemTerms.AudienceList
                                ),
                            })}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {t('deleteDialog.description', {
                                campaignName: campaign.campaign_name,
                            })}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleteCampaignMutation.isPending}>
                            {t('deleteDialog.cancel')}
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                handleDeleteCampaign();
                            }}
                            disabled={deleteCampaignMutation.isPending}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            {deleteCampaignMutation.isPending
                                ? t('deleteDialog.deleting')
                                : t('deleteDialog.confirm')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <ApiIntegrationDialog
                isOpen={openApiDialog}
                onClose={() => setOpenApiDialog(false)}
                campaign={campaign}
            />

            <EmbedCodeDialog
                isOpen={openEmbedDialog}
                onClose={() => setOpenEmbedDialog(false)}
                campaign={campaign}
            />

            <ShareQrDialog
                isOpen={openQrDialog}
                onClose={() => setOpenQrDialog(false)}
                campaign={campaign}
            />

            {campaignId && (
                <LeadBulkImportDialog
                    open={openBulkImportDialog}
                    onOpenChange={setOpenBulkImportDialog}
                    campaignId={campaignId}
                    campaignName={campaign.campaign_name || t('defaults.campaignName')}
                    instituteId={instituteId || ''}
                    customFields={bulkImportCustomFields}
                />
            )}

            {campaignId && (
                <SendMessageDialog
                    open={openSendMessageDialog}
                    onOpenChange={setOpenSendMessageDialog}
                    campaignId={campaignId}
                    campaignName={campaign.campaign_name || t('defaults.campaignName')}
                    instituteId={instituteId || ''}
                    customFields={bulkImportCustomFields}
                    leadCount={0}
                />
            )}

            {campaignId && instituteId && (
                <LinkedWorkflowsDialog
                    open={openLinkedWorkflowsDialog}
                    onOpenChange={setOpenLinkedWorkflowsDialog}
                    audienceId={campaignId}
                    audienceName={campaign.campaign_name || t('defaults.thisCampaign')}
                    instituteId={instituteId}
                />
            )}

            {campaignId && instituteId && (
                <BookingSettingsDialog
                    open={openBookingSettingsDialog}
                    onOpenChange={setOpenBookingSettingsDialog}
                    audienceId={campaignId}
                    audienceName={campaign.campaign_name || t('defaults.thisCampaign')}
                    instituteId={instituteId}
                />
            )}

            {campaignId && instituteId && (
                <ConfigureAudienceWorkflowDialog
                    open={openConfigureWorkflowDialog}
                    onOpenChange={setOpenConfigureWorkflowDialog}
                    audienceId={campaignId}
                    audienceName={campaign.campaign_name || t('defaults.thisCampaign')}
                    instituteId={instituteId}
                />
            )}
        </>
    );
};
