// // components/profile/EditProfileModal.tsx
// import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
// import { FormControl, FormField, FormItem } from '@/components/ui/form';
// import { zodResolver } from '@hookform/resolvers/zod';
// import { FormProvider, useForm } from 'react-hook-form';
// import { z } from 'zod';
// import { adminProfileSchema } from '../-utils/admin-profile-schema';
// import { OnboardingFrame } from '@/svgs';
// import { FileUploadComponent } from '@/components/design-system/file-upload';
// import { useEffect, useRef, useState } from 'react';
// import { getInstituteId } from '@/constants/helper';
// import { UploadFileInS3Public } from '@/routes/signup/-services/signup-services';
// import { PencilSimpleLine } from '@phosphor-icons/react';
// import { MyButton } from '@/components/design-system/button';
// import { MyInput } from '@/components/design-system/input';
// import PhoneInputField from '@/components/design-system/phone-input-field';
// import { Separator } from '@/components/ui/separator';
// import MultiSelectDropdown from '@/components/design-system/multiple-select-field';
// import { UserProfile } from '@/services/student-list-section/getAdminDetails';
// import useAdminLogoStore from '@/components/common/layout-container/sidebar/admin-logo-zustand';
// import { RoleType } from '@/constants/dummy-data';
// import { useMutation, useQueryClient } from '@tanstack/react-query';
// import { toast } from 'sonner';
// import { AxiosError } from 'axios';
// import { handleUpdateAdminDetails } from '../-services/dashboard-services';

// type FormValues = z.infer<typeof adminProfileSchema>;

// interface EditProfileModalProps {
//   adminDetails: UserProfile;
// }

// const EditProfileModal = ({ adminDetails }: EditProfileModalProps) => {
//   const instituteId = getInstituteId();
//   const fileInputRef = useRef<HTMLInputElement>(null);
//   const queryClient = useQueryClient();
//   const { adminLogo } = useAdminLogoStore();
//   const [open, setOpen] = useState(false);
//   const [isUploading, setIsUploading] = useState(false);
//   const [newRoles, setNewRoles] = useState<string[]>([]);
//   const oldRoles = useRef<string[]>([]);

//   const form = useForm<FormValues>({
//     resolver: zodResolver(adminProfileSchema),
//     defaultValues: {
//       profilePictureUrl: '',
//       profilePictureId: undefined,
//       name: '',
//       roleType: [],
//       email: '',
//       phone: '',
//     },
//     mode: 'onChange',
//   });

//   const handleFileSubmit = async (file: File) => {
//     try {
//       setIsUploading(true);
//       const fileId = await UploadFileInS3Public(file, setIsUploading, instituteId, 'STUDENTS');
//       const imageUrl = URL.createObjectURL(file);
//       form.setValue('profilePictureUrl', imageUrl);
//       form.setValue('profilePictureId', fileId);
//     } catch (error) {
//       console.error('Upload failed:', error);
//     } finally {
//       setIsUploading(false);
//     }
//   };

//   const updateMutation = useMutation({
//     mutationFn: ({ data }: { data: FormValues }) =>
//       handleUpdateAdminDetails(data, adminDetails.roles, oldRoles.current, newRoles),
//     onSuccess: () => {
//       toast.success('Profile updated successfully!', { className: 'success-toast' });
//       setOpen(false);
//       queryClient.invalidateQueries({ queryKey: ['GET_ADMIN_DETAILS'] });
//     },
//     onError: (error: unknown) => {
//       const message = error instanceof AxiosError ? error.message : 'Something went wrong!';
//       toast.error(message, { className: 'error-toast' });
//     },
//   });

//   const onSubmit = (values: FormValues) => {
//     updateMutation.mutate({ data: values });
//   };

//   useEffect(() => {
//     form.reset({
//       profilePictureUrl: adminLogo || '',
//       profilePictureId: adminDetails?.profile_pic_file_id,
//       name: adminDetails?.full_name || '',
//       roleType: adminDetails?.roles?.map((r) => r.role_name) || [],
//       email: adminDetails?.email || '',
//       phone: adminDetails?.mobile_number || '',
//     });
//     oldRoles.current = adminDetails?.roles?.map((r) => r.role_name) || [];
//   }, [adminDetails, adminLogo]);

//   useEffect(() => {
//     const sub = form.watch(() => {
//       setNewRoles([...form.getValues('roleType')]);
//     });
//     return () => sub.unsubscribe();
//   }, [form]);

//   return (
//     <Dialog open={open} onOpenChange={setOpen}>
//       <DialogTrigger>
//         <MyButton type="button" buttonType="secondary" scale="large">
//           Edit Profile
//         </MyButton>
//       </DialogTrigger>

//       <DialogContent className="flex h-4/5 w-1/3 flex-col p-0">
//         <h1 className="rounded-t-lg bg-primary-50 p-4 font-semibold text-primary-500">
//           Edit Profile
//         </h1>
//         <div className="flex h-full flex-1 flex-col">
//           <FormProvider {...form}>
//             <form onSubmit={form.handleSubmit(onSubmit)} className="flex h-full flex-col">
//               <div className="flex-1 overflow-y-auto p-4">
//                 <div className="flex flex-col items-center justify-center gap-8">
//                   <div className="relative">
//                     {form.getValues('profilePictureUrl') ? (
//                       <img
//                         src={form.getValues('profilePictureUrl')}
//                         alt="Profile"
//                         className="size-52 rounded-full"
//                       />
//                     ) : (
//                       <OnboardingFrame className="mt-4" />
//                     )}
//                     <FileUploadComponent
//                       fileInputRef={fileInputRef}
//                       onFileSubmit={handleFileSubmit}
//                       control={form.control}
//                       name="profilePictureId"
//                       acceptedFileTypes="image/*"
//                     />
//                     <MyButton
//                       type="button"
//                       onClick={() => fileInputRef.current?.click()}
//                       disabled={isUploading}
//                       buttonType="secondary"
//                       layoutVariant="icon"
//                       scale="small"
//                       className="absolute bottom-0 right-0 bg-white"
//                     >
//                       <PencilSimpleLine />
//                     </MyButton>
//                   </div>

//                   <div className="flex w-full flex-col gap-4">
//                     <FormField
//                       control={form.control}
//                       name="name"
//                       render={({ field }) => (
//                         <FormItem>
//                           <FormControl>
//                             <MyInput
//                               inputType="text"
//                               inputPlaceholder="Full Name"
//                               input={field.value}
//                               onChangeFunction={field.onChange}
//                               label="Profile Name"
//                               required
//                               error={form.formState.errors.name?.message}
//                               size="large"
//                               className="w-full"
//                             />
//                           </FormControl>
//                         </FormItem>
//                       )}
//                     />

//                     <MultiSelectDropdown
//                       form={form}
//                       label="Role Type"
//                       name="roleType"
//                       options={RoleType.map((role, idx) => ({
//                         value: role.name,
//                         label: role.name,
//                         _id: idx,
//                       }))}
//                       control={form.control}
//                       required
//                     />

//                     <Separator />
//                     <h1 className="text-lg font-semibold">Contact Information</h1>

//                     <FormField
//                       control={form.control}
//                       name="email"
//                       render={({ field }) => (
//                         <FormItem>
//                           <FormControl>
//                             <MyInput
//                               inputType="text"
//                               inputPlaceholder="you@email.com"
//                               input={field.value}
//                               onChangeFunction={field.onChange}
//                               label="Email"
//                               error={form.formState.errors.email?.message}
//                               size="large"
//                               className="w-full"
//                             />
//                           </FormControl>
//                         </FormItem>
//                       )}
//                     />

//                     <FormField
//                       control={form.control}
//                       name="phone"
//                       render={() => (
//                         <FormItem>
//                           <FormControl>
//                             <PhoneInputField
//                               label="Mobile Number"
//                               placeholder="1234567890"
//                               name="phone"
//                               control={form.control}
//                               labelStyle="text-base font-normal"
//                               country="in"
//                               required={false}
//                             />
//                           </FormControl>
//                         </FormItem>
//                       )}
//                     />
//                   </div>
//                 </div>
//               </div>

//               <div className="flex justify-center bg-white p-4 pb-0">
//                 <MyButton
//                   type="submit"
//                   scale="large"
//                   buttonType="secondary"
//                   layoutVariant="default"
//                   disable={!form.formState.isValid}
//                 >
//                   Save Changes
//                 </MyButton>
//               </div>
//             </form>
//           </FormProvider>
//         </div>
//       </DialogContent>
//     </Dialog>
//   );
// };

// export default EditProfileModal;
