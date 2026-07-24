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
} from '@phosphor-icons/react';
import { useMemo, useState } from 'react';
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
    const isOptOut = campaign.campaign_type?.toUpperCase().includes('OPT_OUT');
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
    const [openApiDialog, setOpenApiDialog] = useState(false);
    const [openEmbedDialog, setOpenEmbedDialog] = useState(false);
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
            toast.success('Campaign deleted successfully');
            setOpenDeleteDialog(false);
        },
        onError: (error: unknown) => {
            const message =
                error instanceof Error ? error.message : 'Failed to delete the campaign';
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
            toast.info('Edit campaign functionality coming soon');
        }
    };

    const handleAddResponse = () => {
        if (!campaignId) {
            toast.error('Campaign ID is missing');
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
            const t = w.trigger;
            if (!t || !t.trigger_event_name) return false;
            // Keep in sync with AUDIENCE_TRIGGER_EVENTS in linked-workflows-dialog.tsx
            if (t.trigger_event_name !== 'AUDIENCE_LEAD_SUBMISSION') return false;
            return t.event_id === campaignId || t.event_id === null;
        }).length;
    }, [allWorkflows, campaignId]);

    const handleConfigureWorkflow = () => {
        if (!campaignId) {
            toast.error('Campaign ID is missing');
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
                        <span className="sr-only">Open menu</span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleEdit}>
                        <Edit2 className="mr-2 size-4" />
                        Edit
                    </DropdownMenuItem>
                    {!isOptOut && (
                        <DropdownMenuItem onClick={handleAddResponse}>
                            <UserPlus className="mr-2 size-4" />
                            Add Response
                        </DropdownMenuItem>
                    )}
                    {!isOptOut && (
                        <DropdownMenuItem onClick={() => setOpenBulkImportDialog(true)}>
                            <Upload className="mr-2 size-4" />
                            Bulk Import CSV
                        </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => setOpenSendMessageDialog(true)}>
                        <MessageSquare className="mr-2 size-4" />
                        Send Message
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleConfigureWorkflow}>
                        <Zap className="mr-2 size-4" />
                        Configure Workflow
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setOpenLinkedWorkflowsDialog(true)}>
                        <WorkflowIcon className="mr-2 size-4" />
                        View Linked Workflows
                        {linkedCount > 0 && (
                            <span className="ml-auto rounded-full bg-primary-100 text-primary-700 px-2 py-0.5 text-caption font-semibold">
                                {linkedCount}
                            </span>
                        )}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        onClick={() => {
                            if (!campaignId) {
                                toast.error('Campaign ID is missing');
                                return;
                            }
                            setOpenBookingSettingsDialog(true);
                        }}
                    >
                        <CalendarCheck className="mr-2 size-4" />
                        Booking Settings
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setOpenApiDialog(true)}>
                        <Code className="mr-2 size-4" />
                        API Integration
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setOpenEmbedDialog(true)}>
                        <Code2 className="mr-2 size-4" />
                        Get Embed Code
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        className="text-red-600 focus:text-red-600"
                        onClick={() => setOpenDeleteDialog(true)}
                    >
                        <Trash2 className="mr-2 size-4" />
                        Delete
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <AlertDialog open={openDeleteDialog} onOpenChange={setOpenDeleteDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{`Delete ${getTerminology(OtherTerms.AudienceList, SystemTerms.AudienceList)}`}</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete the campaign &quot;
                            {campaign.campaign_name}&quot;? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleteCampaignMutation.isPending}>
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                handleDeleteCampaign();
                            }}
                            disabled={deleteCampaignMutation.isPending}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            {deleteCampaignMutation.isPending ? 'Deleting...' : 'Delete'}
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

            {campaignId && (
                <LeadBulkImportDialog
                    open={openBulkImportDialog}
                    onOpenChange={setOpenBulkImportDialog}
                    campaignId={campaignId}
                    campaignName={campaign.campaign_name || 'Campaign'}
                    instituteId={instituteId || ''}
                    customFields={bulkImportCustomFields}
                />
            )}

            {campaignId && (
                <SendMessageDialog
                    open={openSendMessageDialog}
                    onOpenChange={setOpenSendMessageDialog}
                    campaignId={campaignId}
                    campaignName={campaign.campaign_name || 'Campaign'}
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
                    audienceName={campaign.campaign_name || 'this campaign'}
                    instituteId={instituteId}
                />
            )}

            {campaignId && instituteId && (
                <BookingSettingsDialog
                    open={openBookingSettingsDialog}
                    onOpenChange={setOpenBookingSettingsDialog}
                    audienceId={campaignId}
                    audienceName={campaign.campaign_name || 'this campaign'}
                    instituteId={instituteId}
                />
            )}

            {campaignId && instituteId && (
                <ConfigureAudienceWorkflowDialog
                    open={openConfigureWorkflowDialog}
                    onOpenChange={setOpenConfigureWorkflowDialog}
                    audienceId={campaignId}
                    audienceName={campaign.campaign_name || 'this campaign'}
                    instituteId={instituteId}
                />
            )}
        </>
    );
};
