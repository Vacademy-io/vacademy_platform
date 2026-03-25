/* eslint-disable */
import { FormStepHeading } from '../form-components/form-step-heading';
import { Form, FormControl, FormField, FormItem } from '@/components/ui/form';
import { FormItemWrapper } from '../form-components/form-item-wrapper';
import { useForm } from 'react-hook-form';
import { MyInput } from '@/components/design-system/input';
import { MyDropdown } from '../dropdownForPackageItems';
import { zodResolver } from '@hookform/resolvers/zod';
import { useFormStore } from '@/stores/students/enroll-students-manually/enroll-manually-form-store';
import {
    StepTwoData,
    stepTwoSchema,
} from '@/schemas/student/student-list/schema-enroll-students-manually';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { useEffect, useRef, useState } from 'react';
import { DropdownItemType, DropdownValueType } from '../dropdownTypesForPackageItems';
import { StudentTable } from '@/types/student-table-types';
import { BatchForSessionType } from '@/schemas/student/student-list/institute-schema';
import { MyButton } from '@/components/design-system/button';
import { CourseFormData } from '@/components/common/study-library/add-course/add-course-form';
import { useAddCourse } from '@/services/study-library/course-operations/add-course';
import { toast } from 'sonner';
import { AddSessionDataType } from '@/routes/manage-institute/sessions/-components/session-operations/add-session/add-session-form';
import { useAddSession } from '@/services/study-library/session-management/addSession';
import { AddLevelData } from '@/routes/study-library/courses/course-details/-components/add-course-details-form';
import { useAddLevel } from '@/routes/study-library/courses/course-details/-services/add-level';
import { getTerminology } from '@/components/common/layout-container/sidebar/utils';
import { ContentTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';

export const StepTwoForm = ({
    initialValues,
    submitFn,
}: {
    initialValues?: StudentTable;
    submitFn: (fn: () => void) => void;
}) => {
    const { stepTwoData, setStepTwoData, nextStep } = useFormStore();
    const addLevelMutation = useAddLevel();

    const {
        instituteDetails,
        getCourseFromPackage,
        getSessionFromPackage,
        getLevelsFromPackage,
        getDetailsFromPackageSessionId,
        showForInstitutes,
    } = useInstituteDetailsStore();

    const [courseList, setCourseList] = useState<DropdownItemType[]>(getCourseFromPackage());
    const [sessionList, setSessionList] = useState<DropdownItemType[]>(getSessionFromPackage());
    const [levelList, setLevelList] = useState<DropdownItemType[]>(getLevelsFromPackage());
    const addCourseMutation = useAddCourse();
    const [initialBatch, setInitialBatch] = useState<BatchForSessionType | null>(null);
    const addSessionMutation = useAddSession();

    const genderList: DropdownValueType[] =
        instituteDetails?.genders.map((gender, index) => ({
            id: index.toString(),
            name: gender as string,
        })) || [];

    // Prepare default form values prioritizing saved stepTwoData, then initialValues, then empty defaults
    const prepareDefaultValues = (): StepTwoData => {
        if (stepTwoData && Object.keys(stepTwoData).length > 0) {
            return stepTwoData;
        }
        if (initialValues) {
            const details = getDetailsFromPackageSessionId({
                packageSessionId: initialValues.package_session_id,
            });
            if (details) {
                return {
                    fullName: initialValues?.full_name || '',
                    course: {
                        id: details?.package_dto?.id || '',
                        name: details?.package_dto?.package_name || '',
                    },
                    session: {
                        id: details?.session?.id || '',
                        name: details?.session?.session_name || '',
                    },
                    level: {
                        id: details?.level?.id || '',
                        name: details?.level?.level_name || '',
                    },
                    accessDays: initialValues?.session_expiry_days?.toString() || '',
                    enrollmentNumber: initialValues?.institute_enrollment_id || '',
                    gender: {
                        id: initialValues?.gender || '',
                        name: initialValues?.gender || '',
                    },
                    collegeName: initialValues?.linked_institute_name || '',
                };
            }
        }
        return {
            fullName: '',
            course: { id: '', name: '' },
            session: { id: '', name: '' },
            level: { id: '', name: '' },
            accessDays: '',
            enrollmentNumber: '',
            gender: { id: '', name: '' },
            collegeName: '',
        };
    };

    const form = useForm<StepTwoData>({
        resolver: zodResolver(stepTwoSchema),
        defaultValues: prepareDefaultValues(),
        mode: 'onChange',
    });

    // Update lists when instituteDetails changes
    // Removed resetting form here to avoid clearing user input on instituteDetails update
    useEffect(() => {
        setCourseList(getCourseFromPackage());
        setSessionList(getSessionFromPackage());
        setLevelList(getLevelsFromPackage());
    }, [instituteDetails]);

    // Keep initialBatch updated when initialValues changes
    useEffect(() => {
        if (initialValues) {
            const details = getDetailsFromPackageSessionId({
                packageSessionId: initialValues.package_session_id,
            });
            setInitialBatch(details);
        } else {
            setInitialBatch(null);
        }
    }, [initialValues]);

    // Initialize form values when initialValues change IF form is not already filled (avoid overwrite)
    useEffect(() => {
        if (initialValues) {
            const currentValues = form.getValues();
            // Check if form is "empty" before resetting to initialValues
            const isFormEmpty =
                !currentValues.fullName &&
                !currentValues.course?.id &&
                !currentValues.session?.id &&
                !currentValues.level?.id &&
                !currentValues.accessDays &&
                !currentValues.enrollmentNumber &&
                (!currentValues.gender || !currentValues.gender.id) &&
                !currentValues.collegeName;

            if (isFormEmpty) {
                const details = getDetailsFromPackageSessionId({
                    packageSessionId: initialValues.package_session_id,
                });
                if (details) {
                    form.reset({
                        fullName: initialValues?.full_name || '',
                        course: {
                            id: details?.package_dto?.id || '',
                            name: details?.package_dto?.package_name || '',
                        },
                        session: {
                            id: details?.session?.id || '',
                            name: details?.session?.session_name || '',
                        },
                        level: {
                            id: details?.level?.id || '',
                            name: details?.level?.level_name || '',
                        },
                        accessDays: initialValues?.session_expiry_days?.toString() || '',
                        enrollmentNumber: initialValues?.institute_enrollment_id || '',
                        gender: {
                            id: initialValues?.gender || '',
                            name: initialValues?.gender || '',
                        },
                        collegeName: initialValues?.linked_institute_name || '',
                    });
                }
            }
        }
    }, [initialValues]);

    // Track which field was most recently changed
    const lastChangedField = useRef<string | null>(null);

    const onSubmit = (values: StepTwoData) => {
        setStepTwoData(values);
        nextStep();
    };

    // Custom onChange handlers to track which field changed
    const handleCourseChange = (value: any) => {
        lastChangedField.current = 'course';
        form.setValue('course', value);
    };

    const handleSessionChange = (value: any) => {
        lastChangedField.current = 'session';
        form.setValue('session', value);
    };

    const handleLevelChange = (value: any) => {
        lastChangedField.current = 'level';
        form.setValue('level', value);
    };

    const courseValue = form.watch('course');
    const sessionValue = form.watch('session');
    const levelValue = form.watch('level');
    const { setValue } = form;

    useEffect(() => {
        if (lastChangedField.current === 'course' && courseValue?.id) {
            setSessionList(
                getSessionFromPackage({
                    courseId: courseValue?.id,
                })
            );

            setLevelList(
                getLevelsFromPackage({
                    courseId: courseValue?.id,
                })
            );

            const currentSession = form.getValues('session');
            const currentLevel = form.getValues('level');

            const validSessions = getSessionFromPackage({ courseId: courseValue?.id });
            const sessionIsValid = validSessions.some((s) => s?.id === currentSession?.id);
            if (!sessionIsValid && currentSession?.id) {
                form.setValue('session', { id: '', name: '' });
            }

            const validLevels = getLevelsFromPackage({ courseId: courseValue?.id });
            const levelIsValid = validLevels.some((l) => l?.id === currentLevel?.id);
            if (!levelIsValid && currentLevel?.id) {
                form.setValue('level', { id: '', name: '' });
            }
        }
        lastChangedField.current = null;
    }, [courseValue, getSessionFromPackage, getLevelsFromPackage]);

    useEffect(() => {
        if (lastChangedField.current === 'session' && sessionValue?.id) {
            setCourseList(
                getCourseFromPackage({
                    sessionId: sessionValue?.id,
                })
            );

            setLevelList(
                getLevelsFromPackage({
                    sessionId: sessionValue?.id,
                })
            );

            const currentCourse = form.getValues('course');
            const currentLevel = form.getValues('level');

            const validCourses = getCourseFromPackage({ sessionId: sessionValue?.id });
            const courseIsValid = validCourses.some((c) => c?.id === currentCourse?.id);
            if (!courseIsValid && currentCourse?.id) {
                form.setValue('course', { id: '', name: '' });
            }

            const validLevels = getLevelsFromPackage({ sessionId: sessionValue?.id });
            const levelIsValid = validLevels.some((l) => l?.id === currentLevel?.id);
            if (!levelIsValid && currentLevel?.id) {
                form.setValue('level', { id: '', name: '' });
            }
        }
        lastChangedField.current = null;
    }, [sessionValue, getCourseFromPackage, getLevelsFromPackage]);

    useEffect(() => {
        if (lastChangedField.current === 'level' && levelValue?.id) {
            setCourseList(
                getCourseFromPackage({
                    levelId: levelValue?.id,
                })
            );

            setSessionList(
                getSessionFromPackage({
                    levelId: levelValue?.id,
                })
            );

            const currentCourse = form.getValues('course');
            const currentSession = form.getValues('session');

            const validCourses = getCourseFromPackage({ levelId: levelValue?.id });
            const courseIsValid = validCourses.some((c) => c?.id === currentCourse?.id);
            if (!courseIsValid && currentCourse?.id) {
                form.setValue('course', { id: '', name: '' });
            }

            const validSessions = getSessionFromPackage({ levelId: levelValue?.id });
            const sessionIsValid = validSessions.some((s) => s?.id === currentSession?.id);
            if (!sessionIsValid && currentSession?.id) {
                form.setValue('session', { id: '', name: '' });
            }
        }
        lastChangedField.current = null;
    }, [levelValue, getCourseFromPackage, getSessionFromPackage]);

    useEffect(() => {
        if (sessionList.length === 1 && !sessionValue?.id) {
            handleSessionChange(sessionList[0]);
        }
        if (courseList.length === 1 && !courseValue?.id) {
            handleCourseChange(courseList[0]);
        }
        if (levelList.length === 1 && !levelValue?.id) {
            handleLevelChange(levelList[0]);
        }
    }, [sessionList, courseList, levelList]);

    const formRef = useRef<HTMLFormElement>(null);

    const requestFormSubmit = () => {
        if (formRef.current) {
            formRef.current.requestSubmit();
        }
    };

    const handleGenerateEnrollNum = () => {
        const enrollNum = Math.floor(100000 + Math.random() * 900000).toString();
        setValue('enrollmentNumber', enrollNum);
    };

    const handleAddCourse = ({ requestData }: { requestData: CourseFormData }) => {
        addCourseMutation.mutate(
            { requestData: requestData },
            {
                onSuccess: () => {
                    toast.success('Course created successfully');
                },
                onError: () => {
                    toast.error('Failed to create batch');
                },
            }
        );
    };

    const handleAddSession = (sessionData: AddSessionDataType) => {
        const processedData = structuredClone(sessionData);

        const transformedData = {
            ...processedData,
            levels: processedData.levels.map((level) => ({
                id: level.level_dto?.id,
                new_level: level.level_dto?.new_level === true,
                level_name: level.level_dto?.level_name,
                duration_in_days: level.level_dto?.duration_in_days,
                thumbnail_file_id: level.level_dto?.thumbnail_file_id,
                package_id: level.level_dto?.package_id,
            })),
        };

        addSessionMutation.mutate(
            { requestData: transformedData as unknown as AddSessionDataType },
            {
                onSuccess: () => {
                    toast.success(
                        ` ${getTerminology(
                            ContentTerms.Session,
                            SystemTerms.Session
                        )} added successfully`
                    );
                },
                onError: (error) => {
                    toast.error(
                        error.message ||
                            `Failed to add ${getTerminology(
                                ContentTerms.Session,
                                SystemTerms.Session
                            ).toLocaleLowerCase()}`
                    );
                },
            }
        );
    };

    const handleAddLevel = ({
        requestData,
        packageId,
        sessionId,
    }: {
        requestData: AddLevelData;
        packageId?: string;
        sessionId?: string;
        levelId?: string;
    }) => {
        addLevelMutation.mutate(
            { requestData: requestData, packageId: packageId || '', sessionId: sessionId || '' },
            {
                onSuccess: () => {
                    toast.success('Level added successfully');
                },
                onError: (error) => {
                    toast.error(error.message || 'Failed to add course');
                },
            }
        );
    };

    useEffect(() => {
        if (submitFn) {
            submitFn(requestFormSubmit);
        }
    }, [submitFn]);

    return (
        <div>
            <div className="flex flex-col justify-center px-6 text-neutral-600">
                <Form {...form}>
                    <form
                        ref={formRef}
                        onSubmit={form.handleSubmit(onSubmit)}
                        className="flex flex-col gap-6"
                    >
                        <FormItemWrapper<StepTwoData> control={form.control} name="fullName">
                            <FormStepHeading stepNumber={2} heading="General Details" />
                        </FormItemWrapper>

                        <div className="flex flex-col gap-8">
                            <FormField
                                control={form.control}
                                name="fullName"
                                render={({ field: { onChange, value, ...field } }) => (
                                    <FormItem>
                                        <FormControl>
                                            <MyInput
                                                inputType="text"
                                                label="Full Name"
                                                inputPlaceholder="Full name (First and Last)"
                                                input={value}
                                                onChangeFunction={onChange}
                                                error={form.formState.errors.fullName?.message}
                                                required={true}
                                                size="large"
                                                className="w-full"
                                                {...field}
                                            />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="course"
                                render={({ field: { value } }) => (
                                    <FormItem>
                                        <FormControl>
                                            <div className="flex flex-col gap-1">
                                                <div>
                                                    {getTerminology(
                                                        ContentTerms.Course,
                                                        SystemTerms.Course
                                                    )}
                                                    <span className="text-subtitle text-danger-600">
                                                        *
                                                    </span>
                                                </div>
                                                <MyDropdown
                                                    currentValue={value.name}
                                                    dropdownList={courseList}
                                                    handleChange={handleCourseChange}
                                                    placeholder={`Select ${getTerminology(
                                                        ContentTerms.Course,
                                                        SystemTerms.Course
                                                    )}`}
                                                    error={
                                                        form.formState.errors.course?.id?.message ||
                                                        form.formState.errors.course?.name?.message
                                                    }
                                                    required={true}
                                                    showAddCourseButton={true}
                                                    onAddCourse={handleAddCourse}
                                                />
                                            </div>
                                        </FormControl>
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="session"
                                render={({ field: { value } }) => (
                                    <FormItem className="w-full">
                                        <FormControl>
                                            <div className="flex flex-col gap-1">
                                                <div>
                                                    {getTerminology(
                                                        ContentTerms.Session,
                                                        SystemTerms.Session
                                                    )}{' '}
                                                    <span className="text-subtitle text-danger-600">
                                                        *
                                                    </span>
                                                </div>
                                                <MyDropdown
                                                    currentValue={value}
                                                    dropdownList={sessionList}
                                                    handleChange={handleSessionChange}
                                                    placeholder={`Select ${getTerminology(
                                                        ContentTerms.Session,
                                                        SystemTerms.Session
                                                    )}`}
                                                    error={
                                                        form.formState.errors.session?.id
                                                            ?.message ||
                                                        form.formState.errors.session?.name?.message
                                                    }
                                                    required={true}
                                                    showAddSessionButton={true}
                                                    onAddSession={handleAddSession}
                                                    disable={!courseValue?.id}
                                                />
                                            </div>
                                        </FormControl>
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="level"
                                render={({ field: { value } }) => (
                                    <FormItem className="w-full">
                                        <FormControl>
                                            <div className="flex flex-col gap-1">
                                                <div>
                                                    {getTerminology(
                                                        ContentTerms.Level,
                                                        SystemTerms.Level
                                                    )}{' '}
                                                    <span className="text-subtitle text-danger-600">
                                                        *
                                                    </span>
                                                </div>
                                                <MyDropdown
                                                    currentValue={value.name}
                                                    dropdownList={levelList}
                                                    handleChange={handleLevelChange}
                                                    placeholder={`Select ${getTerminology(
                                                        ContentTerms.Level,
                                                        SystemTerms.Level
                                                    )}`}
                                                    error={
                                                        form.formState.errors.level?.id?.message ||
                                                        form.formState.errors.level?.name?.message
                                                    }
                                                    required={true}
                                                    showAddLevelButton={true}
                                                    onAddLevel={handleAddLevel}
                                                    packageId={courseValue?.id ?? ''}
                                                    disableAddLevelButton={courseValue?.id === ''}
                                                    disable={!sessionValue?.id}
                                                />
                                            </div>
                                        </FormControl>
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="accessDays"
                                render={({ field: { onChange, value, ...field } }) => (
                                    <FormItem>
                                        <FormControl>
                                            <MyInput
                                                inputType="number"
                                                label="Enter access days"
                                                inputPlaceholder="Eg. 365"
                                                input={value}
                                                onChangeFunction={(e) => {
                                                    const numValue = Math.floor(
                                                        Number(e.target.value)
                                                    );
                                                    if (!isNaN(numValue)) {
                                                        onChange(String(numValue));
                                                    }
                                                }}
                                                error={form.formState.errors.accessDays?.message}
                                                required={true}
                                                size="large"
                                                className="w-full"
                                                {...field}
                                                step="1"
                                                min="1"
                                                onWheel={(e) => e.currentTarget.blur()}
                                            />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                            <div className="flex items-end justify-between gap-4">
                                <div className="w-full">
                                    <FormField
                                        control={form.control}
                                        name="enrollmentNumber"
                                        render={({ field: { onChange, value, ...field } }) => (
                                            <FormItem>
                                                <FormControl>
                                                    <MyInput
                                                        inputType="text"
                                                        label="Enrollment Number"
                                                        inputPlaceholder="123456"
                                                        input={value}
                                                        onChangeFunction={onChange}
                                                        error={
                                                            form.formState.errors.enrollmentNumber
                                                                ?.message
                                                        }
                                                        required={true}
                                                        size="large"
                                                        className="w-full"
                                                        {...field}
                                                        onWheel={(e) => e.currentTarget.blur()}
                                                    />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                </div>
                                <MyButton
                                    type="button"
                                    buttonType="secondary"
                                    scale="large"
                                    onClick={handleGenerateEnrollNum}
                                >
                                    Auto Generate
                                </MyButton>
                            </div>

                            <FormField
                                control={form.control}
                                name="gender"
                                render={({ field: { onChange, value } }) => (
                                    <FormItem className="w-full">
                                        <FormControl>
                                            <div className="flex flex-col gap-1">
                                                <div>
                                                    Gender{' '}
                                                    <span className="text-subtitle text-danger-600">
                                                        *
                                                    </span>
                                                </div>
                                                <MyDropdown
                                                    currentValue={value}
                                                    dropdownList={genderList}
                                                    handleChange={onChange}
                                                    placeholder="Select Gender"
                                                    error={form.formState.errors.gender?.message}
                                                    required={true}
                                                />
                                            </div>
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="collegeName"
                                render={({ field: { onChange, value, ...field } }) => (
                                    <FormItem>
                                        <FormControl>
                                            <MyInput
                                                inputType="text"
                                                label="College/School Name"
                                                inputPlaceholder="Enter Student's College/School Name"
                                                input={value}
                                                onChangeFunction={onChange}
                                                error={form.formState.errors.collegeName?.message}
                                                size="large"
                                                className="w-full"
                                                {...field}
                                            />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                        </div>
                    </form>
                </Form>
            </div>
        </div>
    );
};
