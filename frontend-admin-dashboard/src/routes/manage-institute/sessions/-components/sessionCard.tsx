import { Package, SessionData } from '@/types/study-library/session-types';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DotsThree } from 'phosphor-react';
import { Button } from '@/components/ui/button';
import { DeleteSessionDialog } from './deleteSessionDialog';
import { MyButton } from '@/components/design-system/button';
import { AddSessionDialog } from './session-operations/add-session/add-session-dialog';
import { useRef, useState } from 'react';
import { AddSessionDataType } from './session-operations/add-session/add-session-form';
import { useEditSession } from '@/services/study-library/session-management/editSession';
import { toast } from 'sonner';

interface SessionCardProps {
    data: SessionData;
}

export function SessionCard({ data }: SessionCardProps) {
    const [disableAddButton, setDisableAddButton] = useState(true);
    const editSessionMutation = useEditSession();

    const [isAddSessionDiaogOpen, setIsAddSessionDiaogOpen] = useState(false);
    const handleOpenAddSessionDialog = () => {
        setIsAddSessionDiaogOpen(!isAddSessionDiaogOpen);
    };

    const handleEditSession = (sessionData: AddSessionDataType) => {
        // Get all the selected package_session_ids from the form
        const allPackageSessionIds: string[] = [];
        data.packages.forEach((pkg) => {
            pkg.level.forEach((level) => {
                allPackageSessionIds.push(level.package_session_id);
            });
        });

        const visiblePackageSessionIds = sessionData.levels.map((level) => {
            return level.package_session_id;
        });

        const hiddenPackageSessionIds = allPackageSessionIds.filter((pksId) => {
            return !visiblePackageSessionIds.includes(pksId);
        });

        const commaSeparatedVisiblePackageSessionIds = visiblePackageSessionIds.join(',');
        const commaSeparatedHiddenPackageSessionIds = hiddenPackageSessionIds.join(',');

        const requestData = {
            comma_separated_hidden_package_session_ids: commaSeparatedHiddenPackageSessionIds,
            session_name: sessionData.session_name,
            start_date: sessionData.start_date,
            status: sessionData.status,
            comma_separated_visible_package_session_ids: commaSeparatedVisiblePackageSessionIds,
        };

        editSessionMutation.mutate(
            { requestData: requestData, sessionId: sessionData.id || '' },
            {
                onSuccess: () => {
                    toast.success('Session edited successfully');
                    setIsAddSessionDiaogOpen(false);
                },
                onError: (error) => {
                    toast.error(error.message || 'Failed to edit session');
                },
            }
        );
    };

    const formSubmitRef = useRef(() => {});

    const submitButton = (
        <div className="flex items-center justify-end">
            <MyButton
                type="submit"
                buttonType="primary"
                layoutVariant="default"
                scale="large"
                className="w-[140px]"
                disable={disableAddButton}
                onClick={() => formSubmitRef.current()}
            >
                Save Changes
            </MyButton>
        </div>
    );

    const submitFn = (fn: () => void) => {
        formSubmitRef.current = fn;
    };

    const containsActiveLevels = (pkg: Package) => {
        let containsActiveLevels = false;
        pkg.level.forEach((level) => {
            if (level.package_session_status == 'ACTIVE') containsActiveLevels = true;
        });
        return containsActiveLevels;
    };

    return (
        <div className="flex flex-col gap-4 rounded-2xl border p-6">
            <div className="flex flex-row items-end justify-between">
                <div>
                    <div className="text-lg font-[600]">{data?.session?.session_name}</div>
                    <div className="text-sm text-neutral-500">Start Date</div>
                </div>
                <DropdownMenu>
                    <DropdownMenuTrigger>
                        <Button variant="outline" className="h-6 bg-transparent p-1 shadow-none">
                            <DotsThree size={20} />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                        <AddSessionDialog
                            isAddSessionDiaogOpen={isAddSessionDiaogOpen}
                            handleOpenAddSessionDialog={handleOpenAddSessionDialog}
                            handleSubmit={handleEditSession}
                            trigger={
                                <MyButton buttonType="text" className="text-neutral-600">
                                    Edit Session
                                </MyButton>
                            }
                            initialValues={data}
                            submitButton={submitButton}
                            setDisableAddButton={setDisableAddButton}
                            submitFn={submitFn}
                        />
                        <DropdownMenuItem
                            className="cursor-pointer hover:bg-white"
                            onSelect={(e) => e.preventDefault()}
                        >
                            <DeleteSessionDialog
                                triggerButton={
                                    <MyButton buttonType="text" className="text-neutral-600">
                                        Delete Session
                                    </MyButton>
                                }
                                session={data}
                            />
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
            <div className="border-t"></div>
            <div className="grid grid-cols-4 gap-4">
                {data?.packages.map((item, idx) =>
                    containsActiveLevels(item) ? (
                        <div key={idx}>
                            <div className="text-base">{item?.package_dto.package_name}</div>
                            <div>
                                {item.level.map(
                                    (level, idx) =>
                                        level.package_session_status == 'ACTIVE' && (
                                            <div
                                                key={idx}
                                                className="flex flex-row items-center gap-1"
                                            >
                                                <div className="size-2 rounded-full bg-neutral-300"></div>
                                                <div className="text-sm">
                                                    {level.level_dto.level_name}
                                                </div>
                                            </div>
                                        )
                                )}
                            </div>
                        </div>
                    ) : null
                )}
            </div>
        </div>
    );
}
