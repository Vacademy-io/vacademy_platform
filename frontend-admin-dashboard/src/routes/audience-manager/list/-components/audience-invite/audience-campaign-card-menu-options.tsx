import { Button } from '@/components/ui/button';
import { MoreVertical, Edit2, Trash2, Code, Code2, UserPlus } from 'lucide-react';
import { useState } from 'react';
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

interface AudienceCampaignCardMenuOptionsProps {
    campaign: CampaignItem;
    onEdit?: (campaign: CampaignItem) => void;
}

export const AudienceCampaignCardMenuOptions = ({
    campaign,
    onEdit,
}: AudienceCampaignCardMenuOptionsProps) => {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
    const [openApiDialog, setOpenApiDialog] = useState(false);
    const [openEmbedDialog, setOpenEmbedDialog] = useState(false);
    const { instituteDetails } = useInstituteDetailsStore();

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
                    <DropdownMenuItem onClick={handleAddResponse}>
                        <UserPlus className="mr-2 size-4" />
                        Add Response
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
                        <AlertDialogTitle>Delete Campaign</AlertDialogTitle>
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
        </>
    );
};
