import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DotsThree, WarningCircle } from '@phosphor-icons/react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useEffect, useState } from 'react';
import { MyButton } from '@/components/design-system/button';
import { z } from 'zod';
import { FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import MultiSelectDropdown from '@/components/design-system/multiple-select-field';
import { RoleType } from '@/constants/dummy-data';
import { UserRolesDataEntry } from '@/types/dashboard/user-roles';
import { getInstituteId } from '@/constants/helper';
import { useMutation } from '@tanstack/react-query';
import {
    handleAddUserDashboardRoles,
    handleDeleteDisableDashboardUsers,
} from '../-services/dashboard-services';
import { toast } from 'sonner';
import { mapRoleToCustomName } from '@/utils/roleUtils';
import AssignSubOrgsDialog from '@/routes/manage-institute/teams/-components/assign-sub-orgs-dialog';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

export const buildInviteUsersSchema = (t: TFunction) =>
    z.object({
        roleType: z
            .array(z.string())
            .min(1, t('changeRoleType.validation.roleRequired')),
    });
type FormValues = z.infer<ReturnType<typeof buildInviteUsersSchema>>;

interface ChangeRoleTypeComponentProps {
    student: UserRolesDataEntry;
    onClose: () => void;
    refetchData: () => void;
    availableRoles?: { id: string; name: string }[];
}

const ChangeRoleTypeComponent: React.FC<ChangeRoleTypeComponentProps> = ({
    student,
    onClose,
    refetchData,
    availableRoles,
}) => {
    const { t } = useTranslation('dashboardInstituteUsersOptions');
    const roleOptions = availableRoles || RoleType;
    const instituteId = getInstituteId();
    //need to previous already assigned roles
    const form = useForm<FormValues>({
        resolver: zodResolver(buildInviteUsersSchema(t)),
        defaultValues: {
            roleType: [],
        },
        mode: 'onChange',
    });
    const { getValues } = form;
    const isValid = getValues('roleType').length > 0 ? true : false;
    form.watch('roleType');

    const getDashboardUsersData = useMutation({
        mutationFn: ({
            roles,
            userId,
            instituteId,
        }: {
            roles: string[];
            userId: string;
            instituteId: string | undefined;
        }) => handleAddUserDashboardRoles(roles, userId, instituteId),
        onSuccess: () => {
            onClose();
            refetchData();
            toast.success(t('changeRoleType.toast.success'), {
                className: 'success-toast',
                duration: 2000,
            });
        },
        onError: (error: unknown) => {
            throw error;
        },
    });

    function onSubmit(values: FormValues) {
        getDashboardUsersData.mutate({
            roles: values.roleType,
            userId: student.id,
            instituteId,
        });
    }

    useEffect(() => {
        form.reset({
            roleType: student.roles.map((role) => role.role_name) || [],
        });
    }, []);

    return (
        <DialogContent className="flex w-96 flex-col p-0">
            <h1 className="rounded-md bg-primary-50 p-4 text-primary-500">
                {t('changeRoleType.title')}
            </h1>
            <FormProvider {...form}>
                <form className="flex flex-col items-start justify-center gap-4 px-4">
                    <MultiSelectDropdown
                        form={form}
                        label={t('changeRoleType.roleTypeLabel')}
                        name="roleType"
                        options={roleOptions.map((option, index) => ({
                            value: option.name,
                            label: mapRoleToCustomName(option.name),
                            _id: index,
                        }))}
                        control={form.control}
                        className="w-96"
                        required
                    />
                    <div className="flex w-96 items-center justify-center text-center">
                        <MyButton
                            type="button"
                            scale="large"
                            buttonType="primary"
                            layoutVariant="default"
                            className="mb-6"
                            disable={!isValid}
                            onClick={form.handleSubmit(onSubmit)}
                        >
                            {t('changeRoleType.submit')}
                        </MyButton>
                    </div>
                </form>
            </FormProvider>
        </DialogContent>
    );
};

interface DisableUserComponentProps {
    student: UserRolesDataEntry;
    onClose: () => void;
    refetchData: () => void;
}

const DisableUserComponent: React.FC<DisableUserComponentProps> = ({
    student,
    onClose,
    refetchData,
}) => {
    const { t } = useTranslation('dashboardInstituteUsersOptions');
    const instituteId = getInstituteId();
    const handleDisableUserMutation = useMutation({
        mutationFn: ({
            instituteId,
            status,
            userId,
        }: {
            instituteId: string | undefined;
            status: string;
            userId: string;
        }) => handleDeleteDisableDashboardUsers(instituteId, status, userId),
        onSuccess: () => {
            onClose();
            refetchData();
            toast.success(t('disableUser.toast.success'), {
                className: 'success-toast',
                duration: 2000,
            });
        },
        onError: (error: unknown) => {
            throw error;
        },
    });

    const handlDisableUser = () => {
        handleDisableUserMutation.mutate({
            instituteId,
            status: 'DISABLED',
            userId: student.id,
        });
    };
    return (
        <DialogContent className="flex flex-col p-0">
            <h1 className="rounded-md bg-primary-50 p-4 text-primary-500">
                {t('disableUser.title')}
            </h1>
            <div className="flex flex-col gap-2 p-4">
                <div className="flex items-center text-danger-600">
                    <p>{t('disableUser.attention')}</p>
                    <WarningCircle size={18} />
                </div>
                <h1>
                    {t('disableUser.confirmPrefix')}{' '}
                    <span className="text-primary-500">{student.full_name}</span>
                    {t('disableUser.confirmSuffix')}
                </h1>
                <div className="flex justify-end">
                    <MyButton
                        type="button"
                        scale="large"
                        buttonType="primary"
                        className="mt-4 font-medium"
                        onClick={handlDisableUser} // Close the dialog when clicked
                    >
                        {t('disableUser.confirmButton')}
                    </MyButton>
                </div>
            </div>
        </DialogContent>
    );
};

interface EnableUserComponentProps {
    student: UserRolesDataEntry;
    onClose: () => void;
    refetchData: () => void;
}

const EnableUserComponent: React.FC<EnableUserComponentProps> = ({
    student,
    onClose,
    refetchData,
}) => {
    const { t } = useTranslation('dashboardInstituteUsersOptions');
    const instituteId = getInstituteId();
    const handleEnableUserMutation = useMutation({
        mutationFn: ({
            instituteId,
            status,
            userId,
        }: {
            instituteId: string | undefined;
            status: string;
            userId: string;
        }) => handleDeleteDisableDashboardUsers(instituteId, status, userId),
        onSuccess: () => {
            onClose();
            refetchData();
            toast.success(t('enableUser.toast.success'), {
                className: 'success-toast',
                duration: 2000,
            });
        },
        onError: (error: unknown) => {
            throw error;
        },
    });

    const handlEnableUser = () => {
        handleEnableUserMutation.mutate({
            instituteId,
            status: 'ACTIVE',
            userId: student.id,
        });
    };
    return (
        <DialogContent className="flex flex-col p-0">
            <h1 className="rounded-md bg-primary-50 p-4 text-primary-500">
                {t('enableUser.title')}
            </h1>
            <div className="flex flex-col gap-2 p-4">
                <div className="flex items-center text-danger-600">
                    <p>{t('enableUser.attention')}</p>
                    <WarningCircle size={18} />
                </div>
                <h1>
                    {t('enableUser.confirmPrefix')}{' '}
                    <span className="text-primary-500">{student.full_name}</span>
                    {t('enableUser.confirmSuffix')}
                </h1>
                <div className="flex justify-end">
                    <MyButton
                        type="button"
                        scale="large"
                        buttonType="primary"
                        className="mt-4 font-medium"
                        onClick={handlEnableUser} // Close the dialog when clicked
                    >
                        {t('enableUser.confirmButton')}
                    </MyButton>
                </div>
            </div>
        </DialogContent>
    );
};

interface DeleteUserComponentProps {
    student: UserRolesDataEntry;
    onClose: () => void;
    refetchData: () => void;
}

// Internal action codes for the options menu — used for dispatch/comparison
// only, never rendered directly (the visible labels are translated separately).
type MenuAction = 'changeRoleType' | 'disableUser' | 'enableUser' | 'assignSubOrgs' | 'deleteUser';

const DeleteUserComponent: React.FC<DeleteUserComponentProps> = ({
    student,
    onClose,
    refetchData,
}) => {
    const { t } = useTranslation('dashboardInstituteUsersOptions');
    const instituteId = getInstituteId();
    const handleDeleteUserMutation = useMutation({
        mutationFn: ({
            instituteId,
            status,
            userId,
        }: {
            instituteId: string | undefined;
            status: string;
            userId: string;
        }) => handleDeleteDisableDashboardUsers(instituteId, status, userId),
        onSuccess: () => {
            onClose();
            refetchData();
            toast.success(t('deleteUser.toast.success'), {
                className: 'success-toast',
                duration: 2000,
            });
        },
        onError: (error: unknown) => {
            throw error;
        },
    });

    const handlDeleteUser = () => {
        handleDeleteUserMutation.mutate({
            instituteId,
            status: 'DELETE',
            userId: student.id,
        });
    };
    return (
        <DialogContent className="flex flex-col p-0">
            <h1 className="rounded-md bg-primary-50 p-4 text-primary-500">
                {t('deleteUser.title')}
            </h1>
            <div className="flex flex-col gap-2 p-4">
                <div className="flex items-center text-danger-600">
                    <p>{t('deleteUser.attention')}</p>
                    <WarningCircle size={18} />
                </div>
                <h1>
                    {t('deleteUser.confirmPrefix')}{' '}
                    <span className="text-primary-500">{student.full_name}</span>
                    {t('deleteUser.confirmSuffix')}
                </h1>
                <div className="flex justify-end">
                    <MyButton
                        type="button"
                        scale="large"
                        buttonType="primary"
                        className="mt-4 font-medium"
                        onClick={handlDeleteUser} // Close the dialog when clicked
                    >
                        {t('deleteUser.confirmButton')}
                    </MyButton>
                </div>
            </div>
        </DialogContent>
    );
};

const InstituteUsersOptions = ({
    user,
    refetchData,
    availableRoles,
    subOrgAssign,
}: {
    user: UserRolesDataEntry;
    refetchData: () => void;
    availableRoles?: { id: string; name: string }[];
    /**
     * Opt-in channel-partner assignment. Absent on the dashboard and vimotion team
     * surfaces, which share this menu but have no partner context — passing it only
     * from the institute Teams list keeps those untouched.
     */
    subOrgAssign?: { label: string; currentSubOrgIds: string[] };
}) => {
    const { t } = useTranslation('dashboardInstituteUsersOptions');
    const [openDialog, setOpenDialog] = useState(false);
    // Internal action codes used for dispatch/comparison only — never rendered.
    // Kept separate from the translated menu labels shown below so switching
    // locale can never break which dialog opens.
    const [selectedOption, setSelectedOption] = useState<MenuAction | null>(null);

    const handleDropdownMenuClick = (value: MenuAction) => {
        setOpenDialog(true);
        setSelectedOption(value);
    };

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger>
                    <p className="cursor-pointer rounded-md border p-0.5">
                        <DotsThree size={20} />
                    </p>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    <DropdownMenuItem
                        onClick={() => handleDropdownMenuClick('changeRoleType')}
                    >
                        {t('menu.changeRoleType')}
                    </DropdownMenuItem>
                    {user.roles.some((role) => role.status === 'ACTIVE') && (
                        <DropdownMenuItem
                            onClick={() => handleDropdownMenuClick('disableUser')}
                        >
                            {t('menu.disableUser')}
                        </DropdownMenuItem>
                    )}
                    {!user.roles.some((role) => role.status === 'ACTIVE') && (
                        <DropdownMenuItem
                            onClick={() => handleDropdownMenuClick('enableUser')}
                        >
                            {t('menu.enableUser')}
                        </DropdownMenuItem>
                    )}
                    {subOrgAssign && (
                        <DropdownMenuItem
                            onClick={() => handleDropdownMenuClick('assignSubOrgs')}
                        >
                            {subOrgAssign.label}
                        </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => handleDropdownMenuClick('deleteUser')}>
                        {t('menu.deleteUser')}
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
            <Dialog open={openDialog} onOpenChange={setOpenDialog}>
                {selectedOption === 'changeRoleType' && (
                    <ChangeRoleTypeComponent
                        student={user}
                        onClose={() => setOpenDialog(false)}
                        refetchData={refetchData}
                        availableRoles={availableRoles}
                    />
                )}
                {selectedOption === 'disableUser' && (
                    <DisableUserComponent
                        student={user}
                        onClose={() => setOpenDialog(false)}
                        refetchData={refetchData}
                    />
                )}
                {selectedOption === 'enableUser' && (
                    <EnableUserComponent
                        student={user}
                        onClose={() => setOpenDialog(false)}
                        refetchData={refetchData}
                    />
                )}
                {selectedOption === 'assignSubOrgs' && subOrgAssign && (
                    <AssignSubOrgsDialog
                        userId={user.id}
                        userName={user.full_name}
                        currentSubOrgIds={subOrgAssign.currentSubOrgIds}
                        onClose={() => setOpenDialog(false)}
                        refetchData={refetchData}
                    />
                )}
                {selectedOption === 'deleteUser' && (
                    <DeleteUserComponent
                        student={user}
                        onClose={() => setOpenDialog(false)}
                        refetchData={refetchData}
                    />
                )}
            </Dialog>
        </>
    );
};

export default InstituteUsersOptions;
