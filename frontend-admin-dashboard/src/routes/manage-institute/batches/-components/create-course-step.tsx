// CreateCourseStep.tsx
import { RadioGroupItem, RadioGroup } from '@/components/ui/radio-group';
import { useEffect, useState } from 'react';
import { BatchItemSelect } from './batch-item-select';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { AddCourseButton } from '@/components/common/study-library/add-course/add-course-button';
import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { ContentTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';
import { getTerminology } from '@/components/common/layout-container/sidebar/utils';

export const CreateCourseStep = () => {
    const { t } = useTranslation('manageInstituteCreateCourseStep');
    const { getCourseFromPackage, instituteDetails } = useInstituteDetailsStore();
    const [courseList, setCourseList] = useState(getCourseFromPackage());
    const form = useFormContext();

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
                            {t('selectionLabel', {
                                course: getTerminology(ContentTerms.Course, SystemTerms.Course),
                            })}
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
                                        {t('selectExisting', {
                                            course: getTerminology(
                                                ContentTerms.Course,
                                                SystemTerms.Course
                                            ).toLocaleLowerCase(),
                                        })}
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
                                        {t('createNew', {
                                            course: getTerminology(
                                                ContentTerms.Course,
                                                SystemTerms.Course
                                            ).toLocaleLowerCase(),
                                        })}
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
                    rules={{ required: t('validation.selectCourse') }}
                    render={({ field }) => (
                        <FormItem className="flex flex-col gap-1.5">
                            <FormLabel className="text-neutral-700">
                                {getTerminology(ContentTerms.Course, SystemTerms.Course)}{' '}
                                <span className="text-danger-500">*</span>
                            </FormLabel>
                            <FormControl>
                                <BatchItemSelect
                                    items={courseList}
                                    value={field.value}
                                    onChange={field.onChange}
                                    placeholder={t('selectPlaceholder', {
                                        course: getTerminology(
                                            ContentTerms.Course,
                                            SystemTerms.Course
                                        ).toLocaleLowerCase(),
                                    })}
                                    searchPlaceholder={t('searchPlaceholder', {
                                        course: getTerminology(
                                            ContentTerms.Course,
                                            SystemTerms.Course
                                        ).toLocaleLowerCase(),
                                    })}
                                    emptyMessage={t('emptyCourses')}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            )}

            {form.watch('courseCreationType') === 'new' && (
                <div className="mt-2">
                    {/* AddCourseButton takes only open/onOpenChange — the onSubmit and
                        courseButton props passed here were silently dropped, and the
                        @ts-expect-error above them hid that. It renders its own trigger
                        and runs the full course wizard, which is what we want anyway. */}
                    <AddCourseButton />
                </div>
            )}
        </div>
    );
};
