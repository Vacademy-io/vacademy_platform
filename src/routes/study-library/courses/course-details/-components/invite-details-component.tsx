import { getActiveRoleDisplaySettingsKey } from '@/lib/auth/instituteUtils';
import { getInstituteId } from '@/constants/helper';
import { hasFacultyAssignedPermission } from '@/lib/auth/facultyAccessUtils';
import { MyButton } from '@/components/design-system/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { InviteLink } from '@/routes/manage-students/-components/InviteLink';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useNavigate, useRouter } from '@tanstack/react-router';
import { ArrowRight, Copy, Check, Link as LinkIcon, Plus, Users } from '@phosphor-icons/react';
import { handleFetchInviteLinks, handleMakeInviteLinkDefault } from '../-services/get-invite-links';
import { MyPagination } from '@/components/design-system/pagination';
import { usePaginationState } from '@/hooks/pagination';
import type { InviteLinkDataInterface } from '@/schemas/study-library/invite-links-schema';
import { Badge } from '@/components/ui/badge';
import { AxiosError } from 'axios';
import { toast } from 'sonner';
import { UseFormReturn } from 'react-hook-form';
import { CourseDetailsFormValues } from './course-details-schema';
import { useState } from 'react';
import GenerateInviteLinkDialog from '@/routes/manage-students/invite/-components/create-invite/GenerateInviteLinkDialog';
import { getTokenDecodedData, getTokenFromCookie } from '@/lib/auth/sessionUtility';
import { TokenKey, Authority } from '@/constants/auth/tokens';
import {
    ADMIN_DISPLAY_SETTINGS_KEY,
    TEACHER_DISPLAY_SETTINGS_KEY, CUSTOM_ROLE_DISPLAY_SETTINGS_KEY,
    type DisplaySettingsData,
} from '@/types/display-settings';
import { getDisplaySettingsFromCache } from '@/services/display-settings';

const InviteDetailsComponent = ({ form }: { form: UseFormReturn<CourseDetailsFormValues> }) => {
    const sessionsData = form.getValues('courseData.sessions');
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const { getPackageSessionId, getDetailsFromPackageSessionId } = useInstituteDetailsStore();
    const router = useRouter();
    const { courseId } = router.state.location.search;

    const selectedCourse = {
        id: courseId || '',
        name: form.getValues('courseData.packageName') || '',
    };

    // Read display settings to check viewShortInviteLinks toggle
    const accessToken = getTokenFromCookie(TokenKey.accessToken);
    const tokenData = getTokenDecodedData(accessToken);
    const isAdmin =
        tokenData?.authorities &&
        Object.values(tokenData.authorities).some(
            (auth: Authority) => Array.isArray(auth?.roles) && auth.roles.includes('ADMIN')
        );
    const hasFaculty = hasFacultyAssignedPermission(getInstituteId());
    const roleKey = getActiveRoleDisplaySettingsKey();
    const roleDisplay: DisplaySettingsData | null = getDisplaySettingsFromCache(roleKey);
    const showShortInviteLinks = roleDisplay?.coursePage?.viewShortInviteLinks !== false;

    const [copiedShortUrl, setCopiedShortUrl] = useState<string | null>(null);
    const handleCopyShortUrl = (url: string) => {
        navigator.clipboard
            .writeText(url)
            .then(() => {
                setCopiedShortUrl(url);
                setTimeout(() => setCopiedShortUrl(null), 2000);
            })
            .catch(() => toast.error('Copy failed'));
    };

    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [addDialogData, setAddDialogData] = useState<{
        packageSessionId: string;
        defaultInviteLinkId: string;
        isEditInviteLink: boolean;
    } | null>(null);

    // Generate array of packageSessionIds for each level in each session
    const packageSessionIds: string[] = sessionsData
        .flatMap((session) =>
            session.levelDetails.map(
                (level) =>
                    getPackageSessionId({
                        courseId: courseId || '',
                        levelId: level.id,
                        sessionId: session.sessionDetails.id,
                    }) || ''
            )
        )
        .filter(Boolean);

    const { page, pageSize, handlePageChange } = usePaginationState({
        initialPage: 0,
        initialPageSize: 10,
    });

    // Only call the API if there are packageSessionIds
    const shouldFetch = packageSessionIds.length > 0;
    const { data: inviteLinks } = useSuspenseQuery(
        shouldFetch
            ? handleFetchInviteLinks(packageSessionIds, page, pageSize)
            : {
                  queryKey: ['empty-invite-links'],
                  queryFn: () => ({ content: [], totalPages: 1 }),
              }
    );

    const shouldScroll = inviteLinks.content.length > 3;

    // --- Group invite links by package_session_id ---
    // Step 1: Flatten inviteLinks.content so each entry is {inviteLink, packageSessionId}
    const flattenedInviteLinks = (
        inviteLinks && inviteLinks.content ? inviteLinks.content : []
    ).flatMap((inviteLink: InviteLinkDataInterface) =>
        (inviteLink.package_session_ids || []).map((packageSessionId: string) => ({
            ...inviteLink,
            packageSessionId,
        }))
    );
    // Step 2: Group by packageSessionId
    type FlattenedInviteLink = InviteLinkDataInterface & { packageSessionId: string };
    const groupedByPackageSessionId: Record<string, FlattenedInviteLink[]> = {};
    flattenedInviteLinks.forEach((item: FlattenedInviteLink) => {
        if (!groupedByPackageSessionId[item.packageSessionId]) {
            groupedByPackageSessionId[item.packageSessionId] = [];
        }
        groupedByPackageSessionId[item.packageSessionId]?.push(item);
    });
    const groupedEntries: [string, FlattenedInviteLink[]][] =
        Object.entries(groupedByPackageSessionId);

    const handleMakeDefaultMutation = useMutation({
        mutationFn: async ({
            packageSessionId,
            inviteLinkId,
        }: {
            packageSessionId: string;
            inviteLinkId: string;
        }) => {
            return handleMakeInviteLinkDefault(packageSessionId, inviteLinkId);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['GET_INVITE_LINKS'] });
        },
        onError: (error: unknown) => {
            if (error instanceof AxiosError) {
                toast.error(error?.response?.data?.ex || 'Failed to submit rating', {
                    className: 'error-toast',
                    duration: 2000,
                });
            } else {
                toast.error('An unexpected error occurred', {
                    className: 'error-toast',
                    duration: 2000,
                });
                console.error('Unexpected error:', error);
            }
        },
    });

    // Handler for making an invite link default
    const handleMakeDefault = (packageSessionId: string, inviteLinkId: string) => {
        handleMakeDefaultMutation.mutate({ packageSessionId, inviteLinkId });
    };

    // Handler for viewing an invite link (to be implemented)
    const handleViewInviteLink = (inviteLinkId: string, packageSessionId: string) => {
        // TODO: Implement view functionality
        setAddDialogData({
            packageSessionId,
            defaultInviteLinkId: inviteLinkId,
            isEditInviteLink: true,
        });
        setIsAddDialogOpen(true);
    };

    // Handler for adding a new invite link to a package session
    const handleAddInviteLink = (packageSessionId: string, defaultInviteLinkId: string) => {
        setAddDialogData({ packageSessionId, defaultInviteLinkId, isEditInviteLink: false });
        setIsAddDialogOpen(true);
    };

    return (
        <>
            <Dialog>
                <DialogTrigger>
                    <MyButton
                        type="button"
                        scale="small"
                        buttonType="secondary"
                        className="mt-4 flex items-center gap-1"
                    >
                        <Plus size={16} />
                        Invite Links
                    </MyButton>
                </DialogTrigger>
                <DialogContent className="!w-[80vw] max-w-[80vw] p-0">
                    <DialogHeader className="rounded-t-lg bg-primary-50 p-4">
                        <DialogTitle className="font-normal text-primary-500">
                            📨
                            <span className="ml-2">Invite Links</span>
                        </DialogTitle>
                    </DialogHeader>
                    <div
                        className={`space-y-4 p-4 ${shouldScroll ? 'overflow-y-auto' : ''}`}
                        style={shouldScroll ? { maxHeight: '60vh' } : {}}
                    >
                        {shouldFetch && groupedEntries.length > 0 ? (
                            groupedEntries.map(
                                (
                                    [packageSessionId, inviteLinksArr]: [
                                        string,
                                        FlattenedInviteLink[],
                                    ],
                                    groupIndex: number
                                ) => (
                                    <div
                                        className="animate-fadeIn group flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4 transition-all duration-200 hover:border-primary-200 hover:shadow-md"
                                        key={packageSessionId}
                                        style={{ animationDelay: `${groupIndex * 0.1}s` }}
                                    >
                                        {/* Enhanced header with course info */}
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2 font-semibold">
                                                <div className="rounded-md bg-primary-100 p-1">
                                                    <Users size={18} />
                                                </div>
                                                <span>
                                                    {form.getValues('courseData.packageName')}{' '}
                                                    {getDetailsFromPackageSessionId({
                                                        packageSessionId,
                                                    })?.session.session_name || '-'}{' '}
                                                    {getDetailsFromPackageSessionId({
                                                        packageSessionId,
                                                    })?.level.level_name || '-'}
                                                </span>
                                            </div>
                                            <MyButton
                                                type="button"
                                                scale="small"
                                                buttonType="secondary"
                                                onClick={() => {
                                                    const defaultInviteLink = inviteLinksArr.find(
                                                        (invite) => invite.tag === 'DEFAULT'
                                                    );
                                                    handleAddInviteLink(
                                                        packageSessionId,
                                                        defaultInviteLink?.id || ''
                                                    );
                                                }}
                                            >
                                                Add
                                            </MyButton>
                                        </div>

                                        {/* Invite links section for this package session */}
                                        <div className="border-t border-neutral-100 pt-2">
                                            <div className="mb-2 text-xs font-medium text-neutral-600">
                                                Invite Links:
                                            </div>
                                            <div className="flex flex-col gap-2">
                                                {inviteLinksArr.map(
                                                    (
                                                        inviteLink: FlattenedInviteLink,
                                                        idx: number
                                                    ) => {
                                                        return (
                                                            <div
                                                                key={inviteLink.id + idx}
                                                                className="mb-2 rounded-md border bg-neutral-50 p-3"
                                                            >
                                                                <div className="mb-2 flex items-center gap-2">
                                                                    <div className="text-sm font-medium text-neutral-700">
                                                                        {inviteLink.name}
                                                                    </div>
                                                                    <MyButton
                                                                        type="button"
                                                                        scale="small"
                                                                        buttonType="secondary"
                                                                        onClick={() =>
                                                                            handleViewInviteLink(
                                                                                inviteLink.id,
                                                                                packageSessionId
                                                                            )
                                                                        }
                                                                    >
                                                                        View
                                                                    </MyButton>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <InviteLink
                                                                        inviteCode={
                                                                            inviteLink.invite_code
                                                                        }
                                                                    />
                                                                    {inviteLink.tag ===
                                                                    'DEFAULT' ? (
                                                                        <Badge
                                                                            variant="default"
                                                                            className="ml-1 border border-gray-500 bg-green-200 text-gray-600 shadow-none"
                                                                        >
                                                                            DEFAULT
                                                                        </Badge>
                                                                    ) : (
                                                                        <MyButton
                                                                            type="button"
                                                                            scale="small"
                                                                            buttonType="secondary"
                                                                            onClick={() =>
                                                                                handleMakeDefault(
                                                                                    packageSessionId,
                                                                                    inviteLink.id
                                                                                )
                                                                            }
                                                                            className="ml-1"
                                                                        >
                                                                            Make Default
                                                                        </MyButton>
                                                                    )}
                                                                </div>
                                                                {showShortInviteLinks &&
                                                                    inviteLink.short_url && (
                                                                        <div className="mt-2 flex items-center gap-3">
                                                                            <a
                                                                                href={
                                                                                    inviteLink.short_url
                                                                                }
                                                                                target="_blank"
                                                                                rel="noopener noreferrer"
                                                                                className="text-body text-neutral-600 underline hover:text-primary-500"
                                                                            >
                                                                                {inviteLink.short_url.replace(
                                                                                    /^https?:\/\//,
                                                                                    ''
                                                                                )}
                                                                            </a>
                                                                            <div className="flex items-center gap-2">
                                                                                <MyButton
                                                                                    buttonType="secondary"
                                                                                    scale="medium"
                                                                                    layoutVariant="icon"
                                                                                    type="button"
                                                                                    onClick={() =>
                                                                                        handleCopyShortUrl(
                                                                                            inviteLink.short_url!
                                                                                        )
                                                                                    }
                                                                                >
                                                                                    <Copy />
                                                                                </MyButton>
                                                                                {copiedShortUrl ===
                                                                                    inviteLink.short_url && (
                                                                                        <div className="text-primary-500">
                                                                                            <Check />
                                                                                        </div>
                                                                                    )}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                            </div>
                                                        );
                                                    }
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )
                            )
                        ) : (
                            <div className="py-8 text-center text-neutral-500">
                                No invite links available.
                            </div>
                        )}
                        {shouldFetch && (inviteLinks?.content?.length ?? 0) > 0 && (
                            <MyPagination
                                currentPage={page}
                                totalPages={inviteLinks?.totalPages ?? 1}
                                onPageChange={handlePageChange}
                            />
                        )}
                    </div>
                    <Separator />
                    <div className="p-4 pt-0">
                        <MyButton
                            type="button"
                            scale="small"
                            buttonType="secondary"
                            className="mt-4 flex items-center gap-1"
                            onClick={() => {
                                navigate({ to: '/manage-students/invite' });
                            }}
                        >
                            <ArrowRight size={18} />
                            Invite Page
                        </MyButton>
                    </div>
                </DialogContent>
            </Dialog>
            <GenerateInviteLinkDialog
                selectedCourse={selectedCourse}
                selectedBatches={[
                    {
                        sessionId:
                            getDetailsFromPackageSessionId({
                                packageSessionId: addDialogData?.packageSessionId || '',
                            })?.session.id || '',
                        levelId:
                            getDetailsFromPackageSessionId({
                                packageSessionId: addDialogData?.packageSessionId || '',
                            })?.level.id || '',
                        sessionName:
                            getDetailsFromPackageSessionId({
                                packageSessionId: addDialogData?.packageSessionId || '',
                            })?.session.session_name || '',
                        levelName:
                            getDetailsFromPackageSessionId({
                                packageSessionId: addDialogData?.packageSessionId || '',
                            })?.level.level_name || '',
                        courseId: courseId || '',
                        courseName: form.getValues('courseData.packageName') || '',
                    },
                ]}
                showSummaryDialog={isAddDialogOpen}
                setShowSummaryDialog={setIsAddDialogOpen}
                inviteLinkId={addDialogData?.defaultInviteLinkId}
                singlePackageSessionId={true}
                isEditInviteLink={addDialogData?.isEditInviteLink}
            />
        </>
    );
};

export default InviteDetailsComponent;
