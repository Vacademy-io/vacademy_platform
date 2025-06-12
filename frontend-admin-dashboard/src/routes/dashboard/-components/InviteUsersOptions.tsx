import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DotsThree, WarningCircle } from "phosphor-react";
import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { MyButton } from "@/components/design-system/button";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormProvider, useForm } from "react-hook-form";
import { FormControl, FormField, FormItem } from "@/components/ui/form";
import { MyInput } from "@/components/design-system/input";
import MultiSelectDropdown from "@/components/design-system/multiple-select-field";
import { RoleType } from "@/constants/dummy-data";
import { UserRolesDataEntry } from "@/types/dashboard/user-roles";
import {
    handleDeleteDisableDashboardUsers,
    handleResendUserInvitation,
    handleUpdateUserInvitation,
} from "../-services/dashboard-services";
import { useMutation } from "@tanstack/react-query";
import { getInstituteId } from "@/constants/helper";
import { toast } from "sonner";

export const inviteUsersSchema = z.object({
    name: z.string().min(1, "Full name is required"),
    email: z.string().min(1, "Email is required").email("Invalid email format"),
    roleType: z.array(z.string()).min(1, "At least one role type is required"),
});
type FormValues = z.infer<typeof inviteUsersSchema>;

interface EditComponentProps {
    student: UserRolesDataEntry;
    onClose: () => void;
    refetchData: () => void;
}

const EditComponent: React.FC<EditComponentProps> = ({ student, onClose, refetchData }) => {
    const instituteId = getInstituteId();
    const form = useForm<FormValues>({
        resolver: zodResolver(inviteUsersSchema),
        defaultValues: {
            name: "",
            email: "",
            roleType: [],
        },
        mode: "onChange",
    });
    const { getValues } = form;
    const isValid =
        !!getValues("name") &&
        !!getValues("email") &&
        (getValues("roleType").length > 0 ? true : false);

    form.watch("roleType");

    const handleUpdateUserMutation = useMutation({
        mutationFn: ({
            instituteId,
            data,
            student,
        }: {
            instituteId: string | undefined;
            data: z.infer<typeof inviteUsersSchema>;
            student: UserRolesDataEntry;
        }) => handleUpdateUserInvitation(instituteId, data, student),
        onSuccess: () => {
            onClose();
            refetchData();
            toast.success("Invitation for this user has been updated successfully!", {
                className: "success-toast",
                duration: 2000,
            });
        },
        onError: (error: unknown) => {
            throw error;
        },
    });

    function onSubmit(values: FormValues) {
        handleUpdateUserMutation.mutate({
            instituteId,
            data: values,
            student,
        });
    }

    useEffect(() => {
        form.reset({
            name: student.full_name || "",
            email: student.email || "",
            roleType: student.roles.map((role) => role.role_name) || [],
        });
    }, []);

    return (
        <DialogContent className="flex w-[420px] flex-col p-0">
            <h1 className="rounded-md bg-primary-50 p-4 text-primary-500">Edit</h1>
            <FormProvider {...form}>
                <form className="flex flex-col items-start justify-center gap-4 px-4">
                    <FormField
                        control={form.control}
                        name="name"
                        render={({ field: { onChange, value, ...field } }) => (
                            <FormItem>
                                <FormControl>
                                    <MyInput
                                        inputType="text"
                                        inputPlaceholder="Full name (First and Last)"
                                        input={value}
                                        onChangeFunction={onChange}
                                        required={true}
                                        error={form.formState.errors.name?.message}
                                        size="large"
                                        label="Full Name"
                                        {...field}
                                        className="w-96"
                                    />
                                </FormControl>
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="email"
                        render={({ field: { onChange, value, ...field } }) => (
                            <FormItem>
                                <FormControl>
                                    <MyInput
                                        inputType="email"
                                        inputPlaceholder="Enter Email"
                                        input={value}
                                        onChangeFunction={onChange}
                                        required={true}
                                        error={form.formState.errors.email?.message}
                                        size="large"
                                        label="Email"
                                        {...field}
                                        className="w-96"
                                    />
                                </FormControl>
                            </FormItem>
                        )}
                    />
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
                            Edit User
                        </MyButton>
                    </div>
                </form>
            </FormProvider>
        </DialogContent>
    );
};

interface ResendInviteComponentProps {
    student: UserRolesDataEntry;
    onClose: () => void;
    refetchData: () => void;
}

const ResendInviteComponent: React.FC<ResendInviteComponentProps> = ({
    student,
    onClose,
    refetchData,
}) => {
    const handleResendUserMutation = useMutation({
        mutationFn: ({ userId }: { userId: string }) => handleResendUserInvitation(userId),
        onSuccess: () => {
            onClose();
            refetchData();
            toast.success("Invitation for this user has been resend successfully!", {
                className: "success-toast",
                duration: 2000,
            });
        },
        onError: (error: unknown) => {
            throw error;
        },
    });

    const handlResendUser = () => {
        handleResendUserMutation.mutate({
            userId: student.id,
        });
    };
    return (
        <DialogContent className="flex flex-col p-0">
            <h1 className="rounded-md bg-primary-50 p-4 text-primary-500">Resend Invite</h1>
            <div className="flex flex-col gap-2 p-4">
                <div className="flex items-center text-danger-600">
                    <p>Attention</p>
                    <WarningCircle size={18} />
                </div>
                <h1>
                    Are you sure you want to resend invite to{" "}
                    <span className="text-primary-500">{student.full_name}</span>?
                </h1>
                <div className="flex justify-end">
                    <MyButton
                        type="button"
                        scale="large"
                        buttonType="primary"
                        className="mt-4 font-medium"
                        onClick={handlResendUser} // Close the dialog when clicked
                    >
                        Yes
                    </MyButton>
                </div>
            </div>
        </DialogContent>
    );
};

interface CancelInviteComponentProps {
    student: UserRolesDataEntry;
    onClose: () => void;
    refetchData: () => void;
}

const CancelInviteComponent: React.FC<CancelInviteComponentProps> = ({
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
            toast.success("Invitation for this user has been cancelled successfully!", {
                className: "success-toast",
                duration: 2000,
            });
        },
        onError: (error: unknown) => {
            throw error;
        },
    });

    const handlCancelInviteUser = () => {
        handleDisableUserMutation.mutate({
            instituteId,
            status: "CANCEL",
            userId: student.id,
        });
    };
    return (
        <DialogContent className="flex flex-col p-0">
            <h1 className="rounded-md bg-primary-50 p-4 text-primary-500">Cancel Invite</h1>
            <div className="flex flex-col gap-2 p-4">
                <div className="flex items-center text-danger-600">
                    <p>Attention</p>
                    <WarningCircle size={18} />
                </div>
                <h1>
                    Are you sure you want to cancel invite for{" "}
                    <span className="text-primary-500">{student.full_name}</span>?
                </h1>
                <div className="flex justify-end">
                    <MyButton
                        type="button"
                        scale="large"
                        buttonType="primary"
                        className="mt-4 font-medium"
                        onClick={handlCancelInviteUser} // Close the dialog when clicked
                    >
                        Yes
                    </MyButton>
                </div>
            </div>
        </DialogContent>
    );
};

const InviteUsersOptions = ({
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
                    <DropdownMenuItem onClick={() => handleDropdownMenuClick("Edit")}>
                        Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleDropdownMenuClick("Resend Invite")}>
                        Resend Invite
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleDropdownMenuClick("Cancel Invite")}>
                        Cancel Invite
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
            <Dialog open={openDialog} onOpenChange={setOpenDialog}>
                {selectedOption === "Edit" && (
                    <EditComponent
                        student={user}
                        onClose={() => setOpenDialog(false)}
                        refetchData={refetchData}
                    />
                )}
                {selectedOption === "Resend Invite" && (
                    <ResendInviteComponent
                        student={user}
                        onClose={() => setOpenDialog(false)}
                        refetchData={refetchData}
                    />
                )}
                {selectedOption === "Cancel Invite" && (
                    <CancelInviteComponent
                        student={user}
                        onClose={() => setOpenDialog(false)}
                        refetchData={refetchData}
                    />
                )}
            </Dialog>
        </>
    );
};

export default InviteUsersOptions;
