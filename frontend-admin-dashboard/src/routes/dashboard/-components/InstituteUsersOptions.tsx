import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DotsThree, WarningCircle } from "phosphor-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useEffect, useState } from "react";
import { MyButton } from "@/components/design-system/button";
import { z } from "zod";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import MultiSelectDropdown from "@/components/design-system/multiple-select-field";
import { RoleType } from "@/constants/dummy-data";
import { UserRolesDataEntry } from "@/types/dashboard/user-roles";
import { getInstituteId } from "@/constants/helper";
import { useMutation } from "@tanstack/react-query";
import {
    handleAddUserDashboardRoles,
    handleDeleteDisableDashboardUsers,
} from "../-services/dashboard-services";
import { toast } from "sonner";
export const inviteUsersSchema = z.object({
    roleType: z.array(z.string()).min(1, "At least one role type is required"),
});
type FormValues = z.infer<typeof inviteUsersSchema>;

interface ChangeRoleTypeComponentProps {
    student: UserRolesDataEntry;
    onClose: () => void;
    refetchData: () => void;
}

const ChangeRoleTypeComponent: React.FC<ChangeRoleTypeComponentProps> = ({
    student,
    onClose,
    refetchData,
}) => {
    const instituteId = getInstituteId();
    //need to previous already assigned roles
    const form = useForm<FormValues>({
        resolver: zodResolver(inviteUsersSchema),
        defaultValues: {
            roleType: [],
        },
        mode: "onChange",
    });
    const { getValues } = form;
    const isValid = getValues("roleType").length > 0 ? true : false;
    form.watch("roleType");

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
            toast.success("User roles has been changed successfully!", {
                className: "success-toast",
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
        <DialogContent className="flex w-[420px] flex-col p-0">
            <h1 className="rounded-md bg-primary-50 p-4 text-primary-500">Change Roles</h1>
            <FormProvider {...form}>
                <form className="flex flex-col items-start justify-center gap-4 px-4">
                    <MultiSelectDropdown
                        form={form}
                        label="Role Type"
                        name="roleType"
                        options={RoleType.map((option, index) => ({
                            value: option.name,
                            label: option.name,
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
                            Submit
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
            toast.success("User has been disabled successfully!", {
                className: "success-toast",
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
            status: "DISABLED",
            userId: student.id,
        });
    };
    return (
        <DialogContent className="flex flex-col p-0">
            <h1 className="rounded-md bg-primary-50 p-4 text-primary-500">Disable User</h1>
            <div className="flex flex-col gap-2 p-4">
                <div className="flex items-center text-danger-600">
                    <p>Attention</p>
                    <WarningCircle size={18} />
                </div>
                <h1>
                    Are you sure you want to disable{" "}
                    <span className="text-primary-500">{student.full_name}</span>?
                </h1>
                <div className="flex justify-end">
                    <MyButton
                        type="button"
                        scale="large"
                        buttonType="primary"
                        className="mt-4 font-medium"
                        onClick={handlDisableUser} // Close the dialog when clicked
                    >
                        Yes
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
            toast.success("User has been enabled successfully!", {
                className: "success-toast",
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
            status: "ACTIVE",
            userId: student.id,
        });
    };
    return (
        <DialogContent className="flex flex-col p-0">
            <h1 className="rounded-md bg-primary-50 p-4 text-primary-500">Disable User</h1>
            <div className="flex flex-col gap-2 p-4">
                <div className="flex items-center text-danger-600">
                    <p>Attention</p>
                    <WarningCircle size={18} />
                </div>
                <h1>
                    Are you sure you want to disable{" "}
                    <span className="text-primary-500">{student.full_name}</span>?
                </h1>
                <div className="flex justify-end">
                    <MyButton
                        type="button"
                        scale="large"
                        buttonType="primary"
                        className="mt-4 font-medium"
                        onClick={handlEnableUser} // Close the dialog when clicked
                    >
                        Yes
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

const DeleteUserComponent: React.FC<DeleteUserComponentProps> = ({
    student,
    onClose,
    refetchData,
}) => {
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
            toast.success("User has been deleted successfully!", {
                className: "success-toast",
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
            status: "DELETE",
            userId: student.id,
        });
    };
    return (
        <DialogContent className="flex flex-col p-0">
            <h1 className="rounded-md bg-primary-50 p-4 text-primary-500">Delete User</h1>
            <div className="flex flex-col gap-2 p-4">
                <div className="flex items-center text-danger-600">
                    <p>Attention</p>
                    <WarningCircle size={18} />
                </div>
                <h1>
                    Are you sure you want to delete{" "}
                    <span className="text-primary-500">{student.full_name}</span>?
                </h1>
                <div className="flex justify-end">
                    <MyButton
                        type="button"
                        scale="large"
                        buttonType="primary"
                        className="mt-4 font-medium"
                        onClick={handlDeleteUser} // Close the dialog when clicked
                    >
                        Yes
                    </MyButton>
                </div>
            </div>
        </DialogContent>
    );
};

const InstituteUsersOptions = ({
    user,
    refetchData,
}: {
    user: UserRolesDataEntry;
    refetchData: () => void;
}) => {
    const [openDialog, setOpenDialog] = useState(false);
    const [selectedOption, setSelectedOption] = useState<string | null>(null);

    const handleDropdownMenuClick = (value: string) => {
        setOpenDialog(true);
        setSelectedOption(value);
    };

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger>
                    <p className="cursor-pointer rounded-md border p-[2px]">
                        <DotsThree size={20} />
                    </p>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => handleDropdownMenuClick("Change Role Type")}>
                        Change Role Type
                    </DropdownMenuItem>
                    {user.status === "ACTIVE" && (
                        <DropdownMenuItem onClick={() => handleDropdownMenuClick("Disable user")}>
                            Disable user
                        </DropdownMenuItem>
                    )}
                    {user.status === "DISABLED" && (
                        <DropdownMenuItem onClick={() => handleDropdownMenuClick("Enable user")}>
                            Enable user
                        </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => handleDropdownMenuClick("Delete user")}>
                        Delete user
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
            <Dialog open={openDialog} onOpenChange={setOpenDialog}>
                {selectedOption === "Change Role Type" && (
                    <ChangeRoleTypeComponent
                        student={user}
                        onClose={() => setOpenDialog(false)}
                        refetchData={refetchData}
                    />
                )}
                {selectedOption === "Disable user" && (
                    <DisableUserComponent
                        student={user}
                        onClose={() => setOpenDialog(false)}
                        refetchData={refetchData}
                    />
                )}
                {selectedOption === "Enable user" && (
                    <EnableUserComponent
                        student={user}
                        onClose={() => setOpenDialog(false)}
                        refetchData={refetchData}
                    />
                )}
                {selectedOption === "Delete user" && (
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
