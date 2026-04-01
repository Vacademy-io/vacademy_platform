import { MyButton } from '@/components/design-system/button';
import { MyInput } from '@/components/design-system/input';
import { Card, CardContent } from '@/components/ui/card';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Form, FormControl, FormField, FormItem } from '@/components/ui/form';
import {
    inviteUsersFormValues,
    inviteUsersSchema,
} from '@/routes/dashboard/-components/InviteUsersComponent';
import { handleInviteUsers } from '@/routes/dashboard/-services/dashboard-services';
import { useMutation } from '@tanstack/react-query';
import { getInstituteId } from '@/constants/helper';
import { toast } from 'sonner';
import { MultiSelectField } from '@/components/design-system/multi-select-field';
import { RoleTypeExceptStudent } from '@/constants/dummy-data';
import { useState } from 'react';
import { Search, UserPlus, Users } from 'lucide-react';

interface ExistingMember {
    id: string;
    name: string;
    email: string;
    profilePicId: string;
    roles?: string[];
}

interface InviteInstructorFormProps {
    onInviteSuccess: (
        id: string,
        name: string,
        email: string,
        profilePicId: string,
        roles?: string[]
    ) => void;
    onCancel: () => void;
    existingMembers?: ExistingMember[];
}

const InviteInstructorForm = ({ onInviteSuccess, onCancel, existingMembers = [] }: InviteInstructorFormProps) => {
    const instituteId = getInstituteId();
    const [isLoading, setIsLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'existing' | 'invite'>(
        existingMembers.length > 0 ? 'existing' : 'invite'
    );
    const [searchQuery, setSearchQuery] = useState('');

    const form = useForm<inviteUsersFormValues>({
        resolver: zodResolver(inviteUsersSchema),
        defaultValues: {
            name: '',
            email: '',
            roleType: [],
            batch_subject_mappings: [],
        },
        mode: 'onChange',
    });

    const onInvalid = (err: unknown) => {
        console.error(err);
    };

    const handleInviteUsersMutation = useMutation({
        mutationFn: ({
            instituteId,
            data,
        }: {
            instituteId: string | undefined;
            data: z.infer<typeof inviteUsersSchema>;
        }) => handleInviteUsers(instituteId, data),
        onSuccess: (res, { data }) => {
            setIsLoading(false);
            onInviteSuccess(
                res.id,
                data.name,
                data.email,
                res.profile_pic_file_id || '',
                res.roles
            );
            form.reset();
            toast.success('Instructor invited successfully');
        },
        onError: (error: unknown) => {
            setIsLoading(false);
            throw error;
        },
    });

    const handleSubmit = (values: inviteUsersFormValues) => {
        setIsLoading(true);
        handleInviteUsersMutation.mutate({
            instituteId,
            data: values,
        });
    };

    const handleSelectExisting = (member: ExistingMember) => {
        onInviteSuccess(member.id, member.name, member.email, member.profilePicId, member.roles);
        toast.success(`${member.name} added as instructor`);
    };

    const filteredMembers = searchQuery.trim()
        ? existingMembers.filter(
              (m) =>
                  m.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  m.email?.toLowerCase().includes(searchQuery.toLowerCase())
          )
        : existingMembers;

    return (
        <Card className="border-gray-200">
            <CardContent className="p-0">
                {/* Tab Switcher */}
                {existingMembers.length > 0 && (
                    <div className="flex border-b border-gray-200">
                        <button
                            type="button"
                            className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium transition-colors ${
                                activeTab === 'existing'
                                    ? 'border-primary-500 text-primary-500'
                                    : 'border-transparent text-neutral-500 hover:text-neutral-700'
                            }`}
                            onClick={() => setActiveTab('existing')}
                        >
                            <Users className="size-3.5" />
                            Existing Members
                        </button>
                        <button
                            type="button"
                            className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium transition-colors ${
                                activeTab === 'invite'
                                    ? 'border-primary-500 text-primary-500'
                                    : 'border-transparent text-neutral-500 hover:text-neutral-700'
                            }`}
                            onClick={() => setActiveTab('invite')}
                        >
                            <UserPlus className="size-3.5" />
                            Invite New
                        </button>
                    </div>
                )}

                {activeTab === 'existing' && existingMembers.length > 0 ? (
                    <div className="flex flex-col gap-2 p-3">
                        {/* Search */}
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-neutral-400" />
                            <input
                                type="text"
                                placeholder="Search by name or email..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full rounded-md border border-gray-200 py-2 pl-8 pr-3 text-sm outline-none transition-colors focus:border-primary-400"
                            />
                        </div>

                        {/* Member List */}
                        <div className="max-h-[180px] overflow-y-auto rounded-md border border-gray-200">
                            {filteredMembers.length === 0 ? (
                                <div className="py-4 text-center text-xs text-neutral-400">
                                    {searchQuery ? 'No matching members' : 'No members available'}
                                </div>
                            ) : (
                                filteredMembers.map((member) => (
                                    <button
                                        key={member.id}
                                        type="button"
                                        className="flex w-full items-center gap-2.5 border-b border-gray-100 px-3 py-2 text-left transition-colors last:border-b-0 hover:bg-gray-50"
                                        onClick={() => handleSelectExisting(member)}
                                    >
                                        <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-medium text-primary-700">
                                            {member.name?.charAt(0)?.toUpperCase() || '?'}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-medium text-gray-800">
                                                {member.name}
                                            </p>
                                            <p className="truncate text-xs text-gray-500">
                                                {member.email}
                                                {member.roles && member.roles.length > 0 && (
                                                    <span> — {member.roles.join(', ')}</span>
                                                )}
                                            </p>
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>

                        <div className="flex justify-end">
                            <MyButton
                                type="button"
                                buttonType="secondary"
                                scale="small"
                                layoutVariant="default"
                                onClick={onCancel}
                            >
                                Cancel
                            </MyButton>
                        </div>
                    </div>
                ) : (
                    <Form {...form}>
                        <form className="grid gap-3 p-3">
                            <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormControl>
                                            <MyInput
                                                inputType="text"
                                                inputPlaceholder="Full name (First and Last)"
                                                input={field.value}
                                                onChangeFunction={field.onChange}
                                                required={true}
                                                error={form.formState.errors.name?.message}
                                                size="large"
                                                label="Full Name"
                                                className="h-8 w-full border-gray-300"
                                            />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="email"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormControl>
                                            <MyInput
                                                inputType="email"
                                                inputPlaceholder="Enter Email"
                                                input={field.value}
                                                onChangeFunction={field.onChange}
                                                required={true}
                                                error={form.formState.errors.email?.message}
                                                size="large"
                                                label="Email"
                                                className="h-8 w-full border-gray-300"
                                            />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                            <MultiSelectField
                                form={form}
                                label="Role Type"
                                name="roleType"
                                options={RoleTypeExceptStudent}
                                control={form.control}
                                className="w-full"
                            />
                            <div className="mt-3 flex gap-4">
                                <MyButton
                                    type="button"
                                    buttonType="primary"
                                    scale="medium"
                                    layoutVariant="default"
                                    onClick={form.handleSubmit(handleSubmit, onInvalid)}
                                    disable={
                                        isLoading ||
                                        !form.watch('name') ||
                                        !form.watch('email') ||
                                        (form.watch('roleType')?.length ?? 0) == 0
                                    }
                                >
                                    {isLoading ? (
                                        <span className="flex items-center justify-center gap-2">
                                            <svg
                                                className="size-5 animate-spin text-white"
                                                xmlns="http://www.w3.org/2000/svg"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                            >
                                                <circle
                                                    className="opacity-25"
                                                    cx="12"
                                                    cy="12"
                                                    r="10"
                                                    stroke="currentColor"
                                                    strokeWidth="4"
                                                ></circle>
                                                <path
                                                    className="opacity-75"
                                                    fill="currentColor"
                                                    d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                                                ></path>
                                            </svg>
                                            Adding...
                                        </span>
                                    ) : (
                                        'Add Instructor'
                                    )}
                                </MyButton>
                                <MyButton
                                    type="button"
                                    buttonType="secondary"
                                    scale="medium"
                                    layoutVariant="default"
                                    onClick={onCancel}
                                >
                                    Cancel
                                </MyButton>
                            </div>
                        </form>
                    </Form>
                )}
            </CardContent>
        </Card>
    );
};

export default InviteInstructorForm;
