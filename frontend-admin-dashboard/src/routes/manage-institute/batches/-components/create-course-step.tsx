// CreateCourseStep.tsx
import { RadioGroupItem, RadioGroup } from '@/components/ui/radio-group';
import { useEffect, useState } from 'react';
import { MyDropdown } from '@/components/common/students/enroll-manually/dropdownForPackageItems';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { Plus } from '@phosphor-icons/react';
import { AddCourseButton } from '@/components/common/study-library/add-course/add-course-button';
import { MyButton } from '@/components/design-system/button';
import { useFormContext } from 'react-hook-form';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useAddCourse } from '@/services/study-library/course-operations/add-course';
import { CourseFormData } from '@/components/common/study-library/add-course/add-course-form';
import { toast } from 'sonner';
import { ContentTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';
import { getTerminology } from '@/components/common/layout-container/sidebar/utils';

interface CreateCourseStepProps {
    handleOpenManageBatchDialog: (open: boolean) => void;
}

export const CreateCourseStep = ({ handleOpenManageBatchDialog }: CreateCourseStepProps) => {
    const { getCourseFromPackage, instituteDetails } = useInstituteDetailsStore();
    const [courseList, setCourseList] = useState(getCourseFromPackage());
    const form = useFormContext();
    const addCourseMutation = useAddCourse();

    const handleAddCourse = ({ requestData }: { requestData: CourseFormData }) => {
        addCourseMutation.mutate(
            { requestData: requestData },
            {
                onSuccess: () => {
                    toast.success('Batch created successfully');
                    handleOpenManageBatchDialog(false);
                },
                onError: () => {
                    toast.error('Failed to create batch');
                },
            }
        );
    };

    useEffect(() => {
        setCourseList(getCourseFromPackage());
    }, [instituteDetails]);

    useEffect(() => {
        if (courseList.length === 0) {
            form.setValue('courseCreationType', 'new');
        }
    }, [courseList.length, form]);

    return (
        <div className="flex flex-col gap-6">
            <FormField
                control={form.control}
                name="courseCreationType"
                render={({ field }) => (
                    <FormItem className="space-y-3">
                        <FormLabel className="text-base font-medium text-neutral-700">
                            {getTerminology(ContentTerms.Course, SystemTerms.Course)} Selection
                        </FormLabel>
                        <FormControl>
                            <RadioGroup
                                className="flex gap-6 pt-1"
                                onValueChange={(value) => {
                                    field.onChange(value);
                                    form.setValue('selectedCourse', null); // Reset dependent field
                                }}
                                value={field.value}
                            >
                                <FormItem className="flex items-center space-x-2 space-y-0">
                                    <FormControl>
                                        <RadioGroupItem
                                            value="existing"
                                            id="existing-course"
                                            disabled={courseList.length === 0}
                                        />
                                    </FormControl>
                                    <FormLabel
                                        htmlFor="existing-course"
                                        className={`cursor-pointer font-normal ${courseList.length === 0 ? 'text-neutral-400' : 'text-neutral-600'}`}
                                    >
                                        Select existing{' '}
                                        {getTerminology(
                                            ContentTerms.Course,
                                            SystemTerms.Course
                                        ).toLocaleLowerCase()}
                                    </FormLabel>
                                </FormItem>
                                <FormItem className="flex items-center space-x-2 space-y-0">
                                    <FormControl>
                                        <RadioGroupItem value="new" id="new-course" />
                                    </FormControl>
                                    <FormLabel
                                        htmlFor="new-course"
                                        className="cursor-pointer font-normal text-neutral-600"
                                    >
                                        Create new{' '}
                                        {getTerminology(
                                            ContentTerms.Course,
                                            SystemTerms.Course
                                        ).toLocaleLowerCase()}
                                    </FormLabel>
                                </FormItem>
                            </RadioGroup>
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />

            {form.watch('courseCreationType') === 'existing' && (
                <FormField
                    control={form.control}
                    name="selectedCourse"
                    rules={{ required: 'Please select a course' }}
                    render={({ field }) => (
                        <FormItem className="flex flex-col gap-1.5">
                            <FormLabel className="text-neutral-700">
                                {getTerminology(ContentTerms.Course, SystemTerms.Course)}{' '}
                                <span className="text-danger-500">*</span>
                            </FormLabel>
                            <FormControl>
                                <MyDropdown
                                    currentValue={field.value}
                                    dropdownList={courseList}
                                    handleChange={field.onChange}
                                    placeholder={`Select a ${getTerminology(
                                        ContentTerms.Course,
                                        SystemTerms.Course
                                    ).toLocaleLowerCase()}`}
                                    disable={courseList.length === 0}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            )}

            {form.watch('courseCreationType') === 'new' && (
                <div className="mt-2">
                    <AddCourseButton
                        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                        // @ts-expect-error
                        onSubmit={handleAddCourse}
                        courseButton={
                            <MyButton
                                type="button"
                                buttonType="text"
                                layoutVariant="default"
                                scale="medium"
                                className="hover:text-primary-600 flex items-center p-0 font-normal text-neutral-600 hover:bg-transparent active:bg-transparent"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                }}
                            >
                                <Plus size={18} className="mr-1" /> Add New Course
                            </MyButton>
                        }
                    />
                </div>
            )}
        </div>
    );
};
