import { Route } from "@/routes/learner-invitation-response";
import { useSuspenseQuery } from "@tanstack/react-query";
import { handleGetEnrollInviteData } from "./-services/enroll-invite-services";
import { DashboardLoader } from "@/components/core/dashboard-loader";
import { GraduationCap } from "lucide-react";
import { useEffect, useState } from "react";
import {
    convertInviteCustomFields,
    convertPlansToPaymentOptions,
    safeJsonParse,
} from "./-utils/helper";
import { useInstituteQuery } from "@/services/signup-api";
import { useInstituteDetailsStore } from "@/stores/study-library/useInstituteDetails";
import { getDynamicSchema } from "@/routes/register/-utils/helper";
import z from "zod";
import { AssessmentCustomFieldOpenRegistration } from "@/types/assessment-open-registration";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { MyButton } from "@/components/design-system/button";

// Import step components
import {
    RegistrationStep,
    PaymentSelectionStep,
    ReviewStep,
    PaymentInfoStep,
    SuccessStep,
    CourseInfoCard,
    NavigationButtons,
    FinalCourseData,
    PaymentOption,
    PaymentInfo,
    EnrollmentData,
} from "./-components";

const EnrollByInvite = () => {
    const [currentStep, setCurrentStep] = useState(0); // 0: Registration, 1: Payment Selection, 2: Review, 3: Payment Details, 4: Success
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

    const [enrollmentData, setEnrollmentData] = useState<EnrollmentData>({
        registrationData: {},
        selectedPayment: null,
        paymentInfo: {
            cardholderName: "",
            cardNumber: "",
            expiryDate: "",
            cvv: "",
        },
    });

    const { instituteId, inviteCode } = Route.useSearch();
    const { isLoading: isInstituteLoading } = useSuspenseQuery(
        useInstituteQuery({ instituteId })
    );

    const { getDetailsFromPackageSessionId } = useInstituteDetailsStore();

    const { data: inviteData, isLoading } = useSuspenseQuery(
        handleGetEnrollInviteData({ instituteId, inviteCode })
    );

    // Mock payment options - replace with actual data from API
    const paymentOptions: PaymentOption[] = convertPlansToPaymentOptions(
        inviteData?.package_session_to_payment_options[0]
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
        setEnrollmentData((prev) => ({
            ...prev,
            registrationData: values,
        }));
        setCurrentStep(1);
    }

    const handlePaymentSelection = (payment: PaymentOption) => {
        setEnrollmentData((prev) => ({
            ...prev,
            selectedPayment: payment,
        }));
    };

    const handlePaymentInfoChange = (
        field: keyof PaymentInfo,
        value: string
    ) => {
        setEnrollmentData((prev) => ({
            ...prev,
            paymentInfo: {
                ...prev.paymentInfo,
                [field]: value,
            },
        }));
    };

    const handleEmailChange = (email: string) => {
        setEnrollmentData((prev) => ({
            ...prev,
            registrationData: {
                ...prev.registrationData,
                email: {
                    ...prev.registrationData.email,
                    value: email,
                },
            },
        }));
    };

    const handleNext = () => {
        if (currentStep < 4) {
            setCurrentStep(currentStep + 1);
        }
    };

    const handlePrevious = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        }
    };

    const handleSubmitEnrollment = () => {
        // Here you would typically submit the enrollment data to your API
        console.log("Submitting enrollment:", enrollmentData);
        setCurrentStep(4);
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

    const renderCurrentStep = () => {
        switch (currentStep) {
            case 0:
                return (
                    <RegistrationStep
                        courseData={courseData}
                        inviteData={inviteData}
                        onSubmit={onSubmit}
                        form={form}
                    />
                );
            case 1:
                return (
                    <PaymentSelectionStep
                        paymentOptions={paymentOptions}
                        selectedPayment={enrollmentData.selectedPayment}
                        onPaymentSelect={handlePaymentSelection}
                    />
                );
            case 2:
                return (
                    <ReviewStep
                        courseData={courseData}
                        selectedPayment={enrollmentData.selectedPayment}
                        registrationData={enrollmentData.registrationData}
                        onEmailChange={handleEmailChange}
                    />
                );
            case 3:
                return (
                    <PaymentInfoStep
                        courseData={courseData}
                        selectedPayment={enrollmentData.selectedPayment}
                        paymentInfo={enrollmentData.paymentInfo}
                        onPaymentInfoChange={handlePaymentInfoChange}
                    />
                );
            case 4:
                return <SuccessStep />;
            default:
                return (
                    <RegistrationStep
                        courseData={courseData}
                        inviteData={inviteData}
                        onSubmit={onSubmit}
                        form={form}
                    />
                );
        }
    };

    return (
        <div
            className={`w-full h-auto bg-gradient-to-br from-slate-50 to-blue-50 py-8 px-4 sm:px-6 lg:px-8 pb-24`}
        >
            <div className="max-w-[80%] mx-auto space-y-8">
                {/* Course Information Card - Only show in registration step */}
                {currentStep === 0 && (
                    <CourseInfoCard
                        courseData={courseData}
                        levelName={
                            getDetailsFromPackageSessionId({
                                packageSessionId:
                                    inviteData
                                        .package_session_to_payment_options[0]
                                        .package_session_id,
                            })?.level.level_name || "-"
                        }
                    />
                )}

                {/* Current Step Content */}
                {renderCurrentStep()}

                {/* Navigation Buttons - Only show for steps 1-3 */}
                {currentStep > 0 && currentStep < 4 && (
                    <NavigationButtons
                        currentStep={currentStep}
                        selectedPayment={enrollmentData.selectedPayment}
                        paymentInfo={enrollmentData.paymentInfo}
                        onPrevious={handlePrevious}
                        onNext={handleNext}
                        onSubmitEnrollment={handleSubmitEnrollment}
                    />
                )}
            </div>

            {/* Fixed bottom container with border - Only show in registration step */}
            {currentStep === 0 && (
                <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
                    <div className="max-w-[80%] mx-auto px-4 sm:px-6 lg:px-8 py-4 md:flex md:justify-center">
                        <MyButton
                            type="button"
                            buttonType="secondary"
                            scale="large"
                            layoutVariant="default"
                            onClick={() => {
                                const registrationCard =
                                    document.getElementById(
                                        "registration-card"
                                    );
                                if (registrationCard) {
                                    registrationCard.scrollIntoView({
                                        behavior: "smooth",
                                        block: "start",
                                    });
                                }
                            }}
                            className="w-full md:w-fit text-white font-semibold rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl"
                        >
                            <GraduationCap className="w-5 h-5 mr-2" />
                            Enroll Now
                        </MyButton>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EnrollByInvite;
