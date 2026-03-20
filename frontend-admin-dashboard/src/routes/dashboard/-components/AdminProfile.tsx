'use client';
import { MyButton } from '@/components/design-system/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { FormControl, FormField, FormItem } from '@/components/ui/form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FormProvider, useForm } from 'react-hook-form';
import { z } from 'zod';
import { adminProfileSchema } from '../-utils/admin-profile-schema';
import { OnboardingFrame } from '@/svgs';
import { FileUploadComponent } from '@/components/design-system/file-upload';
import { useEffect, useRef, useState } from 'react';
import { getInstituteId } from '@/constants/helper';
import { UploadFileInS3Public } from '@/routes/signup/-services/signup-services';
import { Upload, Trash2, Pencil } from 'lucide-react';
import { MyInput } from '@/components/design-system/input';
import PhoneInputField from '@/components/design-system/phone-input-field';
import { Separator } from '@/components/ui/separator';
import MultiSelectDropdown from '@/components/design-system/multiple-select-field';
import { UserProfile } from '@/services/student-list-section/getAdminDetails';
import useAdminLogoStore from '@/components/common/layout-container/sidebar/admin-logo-zustand';
import { RoleType } from '@/constants/dummy-data';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AxiosError } from 'axios';
import { handleUpdateAdminDetails } from '../-services/dashboard-services';
import { Menu, Transition } from '@headlessui/react';

// Define form values type
const AdminProfile = ({ adminDetails }: { adminDetails: UserProfile }) => {
    const instituteId = getInstituteId();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [open, setOpen] = useState(false);
    const queryClient = useQueryClient();
    const [newRoles, setNewRoles] = useState<string[]>([]);
    const oldRoles = useRef<string[]>([]);
    const [removeImage, setRemoveImage] = useState(false);

    const form = useForm<z.infer<typeof adminProfileSchema>>({
        resolver: zodResolver(adminProfileSchema),
        defaultValues: {
            profilePictureUrl: '',
            profilePictureId: undefined, // ✅ not null
            name: '',
            roleType: [], // ✅ correct
            email: '',
            phone: '',
        },
        mode: 'onChange',
    });

    const { handleSubmit } = form;
    const [isUploading, setIsUploading] = useState(false);

    const handleSubmitEditDataMutation = useMutation({
        mutationFn: ({ data }: { data: any }) => {
            if (removeImage) {
                data.profilePictureId = null;
                data.profilePictureUrl = '';
            }
            return handleUpdateAdminDetails(data, adminDetails.roles, oldRoles.current, newRoles);
        },
        onSuccess: () => {
            toast.success('Your details have been updated successfully!', {
                className: 'success-toast',
                duration: 2000,
            });
            setOpen(false);
            queryClient.invalidateQueries({ queryKey: ['GET_ADMIN_DETAILS'] });
        },
        onError: (error: unknown) => {
            if (error instanceof AxiosError) {
                toast.error(error.message, { className: 'error-toast', duration: 2000 });
            } else {
                console.error('Unexpected error:', error);
            }
        },
    });

    const onSubmit = (values: any) => {
        handleSubmitEditDataMutation.mutate({ data: values });
    };

    const handleFileSubmit = async (file: File) => {
        try {
            setIsUploading(true);
            const fileId = await UploadFileInS3Public(
                file,
                setIsUploading,
                instituteId,
                'STUDENTS'
            );
            const imageUrl = URL.createObjectURL(file);
            form.setValue('profilePictureUrl', imageUrl);
            form.setValue('profilePictureId', fileId);
            setRemoveImage(false);
        } catch (error) {
            console.error('Upload failed:', error);
        } finally {
            setIsUploading(false);
        }
    };

    const { adminLogo } = useAdminLogoStore();

    useEffect(() => {
        form.reset({
            profilePictureUrl: adminLogo || '',
            profilePictureId: adminDetails?.profile_pic_file_id ?? null,
            name: adminDetails?.full_name || '',
            roleType: adminDetails.roles.map((role) => role.role_name) || [],
            email: adminDetails?.email,
            phone: adminDetails?.mobile_number || '',
        });
        oldRoles.current = adminDetails.roles.map((role) => role.role_name);
        setRemoveImage(false);
    }, [adminDetails, adminLogo]);

    useEffect(() => {
        const subscription = form.watch(() => {
            setNewRoles([...form.getValues('roleType')]);
        });
        return () => subscription.unsubscribe();
    }, [form.watch]);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger>
                <MyButton
                    type="submit"
                    scale="large"
                    buttonType="secondary"
                    layoutVariant="default"
                    className="text-sm"
                >
                    Edit Profile
                </MyButton>
            </DialogTrigger>

            <DialogContent className="flex h-4/5 w-1/3 flex-col p-0">
                <h1 className="rounded-t-lg bg-primary-50 p-4 font-semibold text-primary-500">
                    Edit Profile
                </h1>

                <div className="flex h-full flex-1 flex-col">
                    <FormProvider {...form}>
                        <form onSubmit={handleSubmit(onSubmit)} className="flex h-[86%] flex-col">
                            <div className="flex-1 overflow-y-auto p-4">
                                <div className="flex flex-col items-center justify-center gap-8">
                                    <div className="relative">
                                        {form.watch('profilePictureUrl') ? (
                                            <img
                                                src={form.watch('profilePictureUrl')}
                                                alt="logo"
                                                className="size-52 rounded-full object-cover"
                                            />
                                        ) : (
                                            <div className="rounded-full object-cover">
                                                <OnboardingFrame className="mt-4" />
                                            </div>
                                        )}

                                        <div className="absolute bottom-3 right-3 z-10">
                                            <Menu
                                                as="div"
                                                className="relative inline-block text-left"
                                            >
                                                <Menu.Button className="rounded-full bg-white p-1 shadow hover:bg-neutral-100">
                                                    <Pencil className="size-5 text-neutral-700" />
                                                </Menu.Button>
                                                <Transition>
                                                    <Menu.Items className="absolute bottom-10 right-0 z-20 w-40 origin-bottom-right rounded-md bg-white shadow-lg ring-1 ring-black/5">
                                                        <div className="p-1">
                                                            <Menu.Item>
                                                                {({ active }) => (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() =>
                                                                            fileInputRef.current?.click()
                                                                        }
                                                                        className={`${
                                                                            active
                                                                                ? 'bg-neutral-100'
                                                                                : ''
                                                                        } group flex w-full items-center gap-2 rounded-md p-2 text-sm`}
                                                                    >
                                                                        <Upload className="size-4" />{' '}
                                                                        Upload New
                                                                    </button>
                                                                )}
                                                            </Menu.Item>
                                                            <Menu.Item>
                                                                {({ active }) => (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            form.setValue(
                                                                                'profilePictureUrl',
                                                                                ''
                                                                            );
                                                                            form.setValue(
                                                                                'profilePictureId',
                                                                                undefined
                                                                            );
                                                                            setRemoveImage(true);
                                                                        }}
                                                                        className={`${
                                                                            active
                                                                                ? 'bg-neutral-100'
                                                                                : ''
                                                                        } group flex w-full items-center gap-2 rounded-md p-2 text-sm text-red-600`}
                                                                    >
                                                                        <Trash2 className="size-4" />{' '}
                                                                        Remove Image
                                                                    </button>
                                                                )}
                                                            </Menu.Item>
                                                        </div>
                                                    </Menu.Items>
                                                </Transition>
                                            </Menu>
                                        </div>

                                        <FileUploadComponent
                                            fileInputRef={fileInputRef}
                                            onFileSubmit={handleFileSubmit}
                                            control={form.control}
                                            name="profilePictureId"
                                            acceptedFileTypes="image/*"
                                        />
                                    </div>

                                    <div className="flex w-full flex-col gap-4">
                                        <FormField
                                            control={form.control}
                                            name="name"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormControl>
                                                        <MyInput
                                                            {...field}
                                                            inputType="text"
                                                            inputPlaceholder="Full Name (First and Last)"
                                                            input={field.value}
                                                            onChangeFunction={field.onChange}
                                                            required
                                                            error={
                                                                form.formState.errors.name?.message
                                                            }
                                                            size="large"
                                                            label="Profile Name"
                                                            className="w-full"
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
                                            className="flex w-full flex-col"
                                            required
                                        />

                                        <Separator />
                                        <h1 className="text-lg font-semibold">
                                            Contact Information
                                        </h1>

                                        <FormField
                                            control={form.control}
                                            name="email"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormControl>
                                                        <MyInput
                                                            {...field}
                                                            inputType="text"
                                                            inputPlaceholder="you@email.com"
                                                            input={field.value}
                                                            onChangeFunction={field.onChange}
                                                            error={
                                                                form.formState.errors.email?.message
                                                            }
                                                            size="large"
                                                            label="Email"
                                                            className="w-full"
                                                        />
                                                    </FormControl>
                                                </FormItem>
                                            )}
                                        />

                                        <FormField
                                            control={form.control}
                                            name="phone"
                                            render={() => (
                                                <FormItem>
                                                    <FormControl>
                                                        <PhoneInputField
                                                            label="Mobile Number"
                                                            placeholder="123 456 7890"
                                                            name="phone"
                                                            control={form.control}
                                                            labelStyle="text-base font-normal"
                                                            country="in"
                                                            required={false}
                                                        />
                                                    </FormControl>
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-center bg-white p-4 pb-0">
                                <MyButton
                                    type="submit"
                                    scale="large"
                                    buttonType="secondary"
                                    layoutVariant="default"
                                    disable={Object.keys(form.formState.errors).length > 0}
                                >
                                    Save Changes
                                </MyButton>
                            </div>
                        </form>
                    </FormProvider>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default AdminProfile;
