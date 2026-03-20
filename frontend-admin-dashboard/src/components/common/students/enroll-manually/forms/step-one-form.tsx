import { FormStepHeading } from '../form-components/form-step-heading';
import { Form } from '@/components/ui/form';
import { FormItemWrapper } from '../form-components/form-item-wrapper';
import { useForm } from 'react-hook-form';
import { useFormStore } from '@/stores/students/enroll-students-manually/enroll-manually-form-store';
import {
    StepOneData,
    stepOneSchema,
} from '@/schemas/student/student-list/schema-enroll-students-manually';
import { zodResolver } from '@hookform/resolvers/zod';
import EnrollFormUploadImage from '@/assets/svgs/enroll-form-upload-image.svg';
import { useState, useRef, useEffect, Fragment } from 'react';
import { useFileUpload } from '@/hooks/use-file-upload';
import { FileUploadComponent } from '@/components/design-system/file-upload';
import { MyButton } from '@/components/design-system/button';
import { getTokenDecodedData, getTokenFromCookie } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';
import { StudentTable } from '@/types/student-table-types';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { Menu, Transition } from '@headlessui/react';
import { Pencil, Upload, Trash2 } from 'lucide-react';
import { getTerminology } from '@/components/common/layout-container/sidebar/utils';
import { RoleTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';

export const StepOneForm = ({
    initialValues,
    handleNextButtonDisable,
    submitFn,
}: {
    initialValues?: StudentTable;
    handleNextButtonDisable: (value: boolean) => void;
    submitFn: (fn: () => void) => void;
}) => {
    const accessToken = getTokenFromCookie(TokenKey.accessToken);
    const data = getTokenDecodedData(accessToken);
    const INSTITUTE_ID = data && Object.keys(data.authorities)[0];
    const [isUploading, setIsUploading] = useState(false);
    const { uploadFile, getPublicUrl, isUploading: isUploadingFile } = useFileUpload();
    const { stepOneData, setStepOneData, nextStep } = useFormStore();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const form = useForm<StepOneData>({
        resolver: zodResolver(stepOneSchema),
        defaultValues: {
            profilePicture: initialValues?.face_file_id || '',
        },
    });

    const formRef = useRef<HTMLFormElement>(null);
    const requestFormSubmit = () => {
        if (formRef.current) {
            formRef.current.requestSubmit();
        }
    };

    useEffect(() => {
        if (submitFn) {
            submitFn(requestFormSubmit);
        }
    }, [submitFn]);

    useEffect(() => {
        if (!stepOneData) {
            setStepOneData({
                profilePicture: '',
                profilePictureUrl: '',
            });
        }
    }, []);

    useEffect(() => {
        if (!initialValues?.face_file_id) return;
        const fileId = initialValues.face_file_id;

        const prefillProfilePicture = async () => {
            const publicUrl = await getPublicUrl(fileId);
            setStepOneData({
                profilePicture: fileId,
                profilePictureUrl: publicUrl,
            });

            form.reset({
                profilePicture: fileId,
            });
        };

        prefillProfilePicture();
    }, [initialValues]);

    useEffect(() => {
        const isUploaded =
            typeof stepOneData?.profilePictureUrl === 'string' &&
            stepOneData.profilePictureUrl.trim() !== '';
        handleNextButtonDisable(!isUploaded);
    }, [stepOneData?.profilePictureUrl]);

    const handleFileSubmit = async (file: File) => {
        try {
            setIsUploading(true);
            const fileId = await uploadFile({
                file,
                setIsUploading,
                userId: 'your-user-id',
                source: INSTITUTE_ID,
                sourceId: 'STUDENTS',
            });

            if (fileId) {
                const publicUrl = await getPublicUrl(fileId);
                setStepOneData({
                    profilePicture: fileId,
                    profilePictureUrl: publicUrl,
                });
                form.reset({
                    profilePicture: fileId,
                });
            }
        } catch (error) {
            console.error('Upload failed:', error);
        } finally {
            setIsUploading(false);
        }
    };

    const handleRemoveImage = () => {
        setStepOneData({
            profilePicture: '',
            profilePictureUrl: '',
        });
        form.reset({ profilePicture: '' });
    };

    const onSubmit = (values: StepOneData) => {
        setStepOneData({
            profilePicture: values.profilePicture ?? '',
            profilePictureUrl: stepOneData?.profilePictureUrl ?? '',
        });
        nextStep();
    };

    return (
        <div className="flex flex-col justify-center px-6 text-neutral-600">
            <Form {...form}>
                <form
                    ref={formRef}
                    onSubmit={form.handleSubmit(onSubmit)}
                    className="flex flex-col items-center gap-5"
                >
                    <FormItemWrapper<StepOneData> control={form.control} name="profilePicture">
                        <FormStepHeading
                            stepNumber={1}
                            heading={`Add ${getTerminology(
                                RoleTerms.Learner,
                                SystemTerms.Learner
                            )} Profile Picture`}
                        />
                    </FormItemWrapper>

                    <FormItemWrapper<StepOneData>
                        control={form.control}
                        name="profilePicture"
                        className="flex flex-col items-center justify-between gap-2"
                    >
                        <div className="flex flex-col">
                            {isUploading ? (
                                <div className="flex size-[300px] items-center justify-center rounded-full bg-neutral-100">
                                    <DashboardLoader />
                                </div>
                            ) : stepOneData?.profilePictureUrl ? (
                                <div className="group relative size-[300px]">
                                    <img
                                        src={stepOneData.profilePictureUrl}
                                        alt="Profile"
                                        className="size-[300px] rounded-full object-cover"
                                    />
                                    {/* ✅ Edit icon at bottom-right */}
                                    <div className="absolute bottom-3 right-3 z-10">
                                        <Menu as="div" className="relative inline-block text-left">
                                            <Menu.Button className="rounded-full bg-white p-1 shadow hover:bg-neutral-100">
                                                <Pencil className="size-4 text-neutral-700" />
                                            </Menu.Button>
                                            <Transition
                                                as={Fragment}
                                                enter="transition ease-out duration-100"
                                                enterFrom="transform opacity-0 scale-95"
                                                enterTo="transform opacity-100 scale-100"
                                                leave="transition ease-in duration-75"
                                                leaveFrom="transform opacity-100 scale-100"
                                                leaveTo="transform opacity-0 scale-95"
                                            >
                                                {/* ✅ Opens upward */}
                                                <Menu.Items className="absolute bottom-10 right-0 z-20 w-44 origin-bottom-right divide-y divide-gray-100 rounded-md bg-white shadow-lg ring-1 ring-black/5 focus:outline-none">
                                                    <div className="p-1">
                                                        <Menu.Item>
                                                            {({ active }) => (
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        fileInputRef.current?.click()
                                                                    }
                                                                    className={`${active
                                                                            ? 'bg-neutral-100'
                                                                            : ''
                                                                        } group flex w-full items-center gap-2 rounded-md p-2 text-sm`}
                                                                >
                                                                    <Upload className="size-4" />
                                                                    Upload New
                                                                </button>
                                                            )}
                                                        </Menu.Item>
                                                        <Menu.Item>
                                                            {({ active }) => (
                                                                <button
                                                                    type="button"
                                                                    onClick={handleRemoveImage}
                                                                    className={`${active
                                                                            ? 'bg-neutral-100'
                                                                            : ''
                                                                        } group flex w-full items-center gap-2 rounded-md p-2 text-sm text-red-600`}
                                                                >
                                                                    <Trash2 className="size-4" />
                                                                    Remove Image
                                                                </button>
                                                            )}
                                                        </Menu.Item>
                                                    </div>
                                                </Menu.Items>
                                            </Transition>
                                        </Menu>
                                    </div>
                                </div>
                            ) : (
                                <div className="relative items-center justify-center rounded-full">
                                    <div className="flex size-[320px] items-center justify-center rounded-full bg-neutral-100 object-cover">
                                        <EnrollFormUploadImage />
                                    </div>
                                </div>
                            )}

                            {!isUploading && (
                                <>
                                    <FileUploadComponent
                                        fileInputRef={fileInputRef}
                                        onFileSubmit={handleFileSubmit}
                                        control={form.control}
                                        name="profilePicture"
                                        acceptedFileTypes="image/*"
                                    />
                                    {!stepOneData?.profilePictureUrl && (
                                        <div className="">
                                            <MyButton
                                                onClick={() => fileInputRef.current?.click()}
                                                disabled={isUploading || isUploadingFile}
                                                buttonType="secondary"
                                                layoutVariant="default"
                                                scale="large"
                                                type="button"
                                            >
                                                Upload Image
                                            </MyButton>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </FormItemWrapper>
                </form>
            </Form>
        </div>
    );
};
