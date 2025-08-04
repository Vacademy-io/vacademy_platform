import { Route } from "@/routes/learner-invitation-response";
import { useSuspenseQuery } from "@tanstack/react-query";
import { handleGetEnrollInviteData } from "./-services/enroll-invite-services";
import { DashboardLoader } from "@/components/core/dashboard-loader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
    Award,
    Target,
    Info,
    GraduationCap,
    BookOpen,
    RotateCcw,
} from "lucide-react";
import { useEffect, useState } from "react";
import { convertInviteCustomFields, safeJsonParse } from "./-utils/helper";
import { useInstituteQuery } from "@/services/signup-api";
import { useInstituteDetailsStore } from "@/stores/study-library/useInstituteDetails";
import { getDynamicSchema } from "@/routes/register/-utils/helper";
import z from "zod";
import { AssessmentCustomFieldOpenRegistration } from "@/types/assessment-open-registration";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormProvider, useForm } from "react-hook-form";
import { FormControl, FormField, FormItem } from "@/components/ui/form";
import PhoneInputField from "@/components/design-system/phone-input-field";
import SelectField from "@/components/design-system/select-field";
import { MyInput } from "@/components/design-system/input";
import { MyButton } from "@/components/design-system/button";

interface FinalCourseData {
    aboutCourse: string;
    course: string;
    courseBanner: string;
    customHtml: string;
    description: string;
    includeInstituteLogo: boolean;
    learningOutcome: string;
    restrictToSameBatch: boolean;
    showRelatedCourses: boolean;
    tags: string[];
    targetAudience: string;
}

const EnrollByInvite = () => {
    const [courseData, setCourseData] = useState<FinalCourseData>({
        aboutCourse: "",
        course: "",
        courseBanner: "",
        customHtml: "",
        description: "",
        includeInstituteLogo: false,
        learningOutcome: "",
        restrictToSameBatch: false,
        showRelatedCourses: false,
        tags: [],
        targetAudience: "",
    });
    const { instituteId, inviteCode } = Route.useSearch();
    const { isLoading: isInstituteLoading } = useSuspenseQuery(
        useInstituteQuery({ instituteId })
    );

    const { getDetailsFromPackageSessionId } = useInstituteDetailsStore();

    const { data: inviteData, isLoading } = useSuspenseQuery(
        handleGetEnrollInviteData({ instituteId, inviteCode })
    );

    const zodSchema = getDynamicSchema(
        convertInviteCustomFields(inviteData?.institute_custom_fields || []) ||
            []
    );

    type FormValues = z.infer<typeof zodSchema>;

    const form = useForm<FormValues>({
        resolver: zodResolver(zodSchema),
        defaultValues: (
            convertInviteCustomFields(
                inviteData?.institute_custom_fields || []
            ) || []
        )
            .sort(
                (
                    a: AssessmentCustomFieldOpenRegistration,
                    b: AssessmentCustomFieldOpenRegistration
                ) => a.field_order - b.field_order
            )
            .reduce(
                (
                    defaults: Record<
                        string,
                        {
                            name: string;
                            value: string;
                            is_mandatory: boolean;
                            type: string;
                            comma_separated_options?: string[];
                        }
                    >,
                    field: AssessmentCustomFieldOpenRegistration
                ) => {
                    if (field.field_type === "dropdown") {
                        const optionsArray = field.comma_separated_options
                            ? field.comma_separated_options
                                  .split(",")
                                  .map((opt) => opt.trim())
                            : [];

                        defaults[field.field_key] = {
                            name: field.field_name,
                            value: optionsArray[0] || "",
                            is_mandatory: field.is_mandatory || false,
                            comma_separated_options: optionsArray,
                            type: field.field_type,
                        };
                    } else {
                        defaults[field.field_key] = {
                            name: field.field_name,
                            value: "",
                            is_mandatory: field.is_mandatory || false,
                            type: field.field_type,
                        };
                    }
                    return defaults;
                },
                {} as Record<
                    string,
                    {
                        name: string;
                        value: string;
                        is_mandatory: boolean;
                        type: string;
                        comma_separated_options?: string[];
                    }
                >
            ),
        mode: "onChange",
    });

    form.watch();

    function onSubmit(values: FormValues) {
        console.log(values);
    }

    const onInvalid = (err: unknown) => {
        console.error(err);
    };

    useEffect(() => {
        const loadCourseData = async () => {
            try {
                const transformedData = await safeJsonParse(
                    inviteData?.web_page_meta_data_json,
                    {}
                );
                setCourseData({
                    aboutCourse: transformedData.aboutCourse,
                    course: transformedData.course,
                    courseBanner: transformedData.courseBannerBlob,
                    customHtml: transformedData.customHtml,
                    description: transformedData.description,
                    includeInstituteLogo: transformedData.includeInstituteLogo,
                    learningOutcome: transformedData.learningOutcome,
                    restrictToSameBatch: transformedData.restrictToSameBatch,
                    showRelatedCourses: transformedData.transformedData,
                    tags: transformedData?.tags ?? [],
                    targetAudience: transformedData?.targetAudience ?? "",
                });
            } catch (error) {
                console.error("Error transforming course data:", error);
            }
        };

        loadCourseData();
    }, [inviteData]);

    if (isLoading || isInstituteLoading) return <DashboardLoader />;

    return (
        <div className="w-full h-full bg-gradient-to-br from-slate-50 to-blue-50 py-8 px-4 sm:px-6 lg:px-8 pb-24">
            <div className="max-w-[80%] mx-auto space-y-8">
                {/* Course Information Card */}
                <Card className="overflow-hidden shadow-xl border-0 bg-white/80 backdrop-blur-sm w-full">
                    {/* Banner Image */}
                    <div className="p-8 rounded-lg !pb-0">
                        {courseData.courseBanner ? (
                            <div className="rounded-xl relative h-32 sm:h-56 lg:h-72 w-full overflow-hidden">
                                <img
                                    src={courseData.courseBanner}
                                    alt="Course Banner"
                                    className="w-full h-full object-contain"
                                />
                            </div>
                        ) : (
                            <div className="rounded-xl relative h-32 sm:h-56 lg:h-72 w-full overflow-hidden bg-primary-500"></div>
                        )}
                    </div>
                    <CardContent className="p-6 sm:p-8">
                        {/* Course Name */}
                        <div className="flex items-start gap-2 sm:gap-3 mb-4">
                            <BookOpen className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 flex-shrink-0 mt-0.5" />
                            <h2 className="text-lg sm:text-xl md:text-2xl font-semibold text-gray-900 leading-tight">
                                {courseData.course}
                            </h2>
                        </div>
                        {/* Tags Row */}
                        {courseData?.tags?.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-6">
                                {courseData?.tags?.map(
                                    (tag: string, index: number) => (
                                        <Badge
                                            key={index}
                                            variant="secondary"
                                            className="px-3 py-1 text-sm font-medium bg-blue-100 text-blue-800 hover:bg-blue-200 transition-colors"
                                        >
                                            {tag}
                                        </Badge>
                                    )
                                )}
                            </div>
                        )}

                        {/* Course Description */}
                        <p
                            className="text-gray-700 text-base sm:text-lg leading-relaxed mb-6"
                            dangerouslySetInnerHTML={{
                                __html: courseData.description || "",
                            }}
                        />

                        {/* Level Badge */}
                        <div className="flex items-start gap-2 mb-8">
                            <Award className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                            <Badge
                                variant="outline"
                                className="px-3 py-1 text-sm font-medium border-amber-200 text-amber-700"
                            >
                                Level:&nbsp;
                                {getDetailsFromPackageSessionId({
                                    packageSessionId:
                                        inviteData
                                            .package_session_to_payment_options[0]
                                            .package_session_id,
                                })?.level.level_name || "-"}
                            </Badge>
                        </div>

                        <Separator className="my-8" />

                        {/* What Learners Will Gain Section */}
                        {courseData?.learningOutcome && (
                            <div className="mb-8">
                                <div className="flex items-start gap-2 sm:gap-3 mb-4">
                                    <Target className="w-5 h-5 sm:w-6 sm:h-6 text-green-600 flex-shrink-0 mt-0.5" />
                                    <h2 className="text-lg sm:text-xl md:text-2xl font-semibold text-gray-900 leading-tight">
                                        What Learners Will Gain
                                    </h2>
                                </div>
                                <div className="grid gap-3">
                                    <p
                                        className="text-gray-700 text-sm sm:text-base"
                                        dangerouslySetInnerHTML={{
                                            __html:
                                                courseData?.learningOutcome ||
                                                "",
                                        }}
                                    />
                                </div>
                            </div>
                        )}

                        <Separator className="my-8" />

                        {/* About the Course Section */}
                        {courseData?.aboutCourse && (
                            <div className="mb-8">
                                <div className="flex items-start gap-2 sm:gap-3 mb-4">
                                    <Info className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 flex-shrink-0 mt-0.5" />
                                    <h2 className="text-lg sm:text-xl md:text-2xl font-semibold text-gray-900 leading-tight">
                                        About the Course
                                    </h2>
                                </div>
                                <p
                                    className="text-gray-700 text-sm sm:text-base leading-relaxed"
                                    dangerouslySetInnerHTML={{
                                        __html: courseData?.aboutCourse || "",
                                    }}
                                />
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Registration Card */}
                <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm w-full">
                    <CardContent className="p-6 sm:p-8">
                        {/* Header */}
                        <div className="flex items-start gap-2 sm:gap-3 mb-6">
                            <div className="p-1.5 sm:p-2 bg-blue-100 rounded-lg flex-shrink-0">
                                <GraduationCap className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                            </div>
                            <div>
                                <h2 className="text-lg sm:text-xl md:text-2xl font-semibold text-gray-900 leading-tight">
                                    Join This Course
                                </h2>
                                <p className="text-gray-600 text-sm mt-1">
                                    Fill in your details to enroll in the course
                                </p>
                            </div>
                        </div>

                        <Separator className="mb-6" />

                        {/* Registration Form */}
                        <div className="flex justify-center items-center w-full">
                            <div className="flex justify-center items-start w-full flex-col bg-white rounded-xl p-4 py-0  mx-4 mb-4">
                                <FormProvider {...form}>
                                    <form className="w-full flex flex-col gap-6 mt-4 max-h-full overflow-auto">
                                        {Object.entries(form.getValues()).map(
                                            ([key, value]) =>
                                                key === "phone_number" ? (
                                                    <FormField
                                                        control={form.control}
                                                        name={`${key}.value`}
                                                        render={() => (
                                                            <FormItem>
                                                                <FormControl>
                                                                    <PhoneInputField
                                                                        label="Phone Number"
                                                                        placeholder="123 456 7890"
                                                                        name={`${key}.value`}
                                                                        control={
                                                                            form.control
                                                                        }
                                                                        country="in"
                                                                        required
                                                                    />
                                                                </FormControl>
                                                            </FormItem>
                                                        )}
                                                    />
                                                ) : (
                                                    <FormField
                                                        key={key}
                                                        control={form.control}
                                                        name={`${key}.value`}
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormControl>
                                                                    {value.type ===
                                                                    "dropdown" ? (
                                                                        <SelectField
                                                                            label={
                                                                                value.name
                                                                            }
                                                                            name={`${key}.value`}
                                                                            options={
                                                                                value.comma_separated_options?.map(
                                                                                    (
                                                                                        option: string,
                                                                                        index: number
                                                                                    ) => ({
                                                                                        value: option,
                                                                                        label: option,
                                                                                        _id: index,
                                                                                    })
                                                                                ) ||
                                                                                []
                                                                            }
                                                                            control={
                                                                                form.control
                                                                            }
                                                                            required={
                                                                                value.is_mandatory
                                                                            }
                                                                            className="!w-full"
                                                                        />
                                                                    ) : (
                                                                        <MyInput
                                                                            inputType="text"
                                                                            inputPlaceholder={
                                                                                value.name
                                                                            }
                                                                            input={
                                                                                field.value
                                                                            }
                                                                            onChangeFunction={
                                                                                field.onChange
                                                                            }
                                                                            required={
                                                                                value.is_mandatory
                                                                            }
                                                                            size="large"
                                                                            label={
                                                                                value.name
                                                                            }
                                                                            className="!max-w-full !w-full"
                                                                        />
                                                                    )}
                                                                </FormControl>
                                                            </FormItem>
                                                        )}
                                                    />
                                                )
                                        )}
                                        <div className="flex items-center justify-center flex-col gap-4">
                                            <MyButton
                                                type="button"
                                                buttonType="primary"
                                                scale="large"
                                                layoutVariant="default"
                                                onClick={form.handleSubmit(
                                                    onSubmit,
                                                    onInvalid
                                                )}
                                                disable={Object.entries(
                                                    form.getValues()
                                                ).some(
                                                    ([, value]) =>
                                                        value.is_mandatory &&
                                                        !value.value
                                                )}
                                                className="w-full md:w-fit bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl"
                                            >
                                                <GraduationCap className="w-5 h-5 mr-2" />
                                                Register
                                            </MyButton>
                                            <button
                                                type="button"
                                                className="flex items-center gap-2 text-gray-500 hover:text-gray-700 text-sm mb-2 cursor-pointer transition-colors duration-200"
                                                onClick={() => form.reset()}
                                            >
                                                <RotateCcw className="w-4 h-4" />
                                                Reset Form
                                            </button>
                                        </div>
                                    </form>
                                </FormProvider>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Fixed bottom container with border */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
                <div className="max-w-[80%] mx-auto px-4 sm:px-6 lg:px-8 py-4 md:flex md:justify-center">
                    <MyButton
                        type="button"
                        buttonType="secondary"
                        scale="large"
                        layoutVariant="default"
                        className="w-full md:w-fit text-white font-semibold rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl"
                    >
                        <GraduationCap className="w-5 h-5 mr-2" />
                        Enroll Now
                    </MyButton>
                </div>
            </div>
        </div>
    );
};

export default EnrollByInvite;
