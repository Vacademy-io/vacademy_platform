import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Check, DollarSign, GraduationCap, RotateCcw, X } from "lucide-react";
import { FormProvider, UseFormReturn } from "react-hook-form";
import { FormControl, FormField, FormItem } from "@/components/ui/form";
import PhoneInputField from "@/components/design-system/phone-input-field";
import SelectField from "@/components/design-system/select-field";
import { MyInput } from "@/components/design-system/input";
import { MyButton } from "@/components/design-system/button";
import { Calendar, CreditCard, Globe } from "phosphor-react";
import { getDefaultPlanFromPaymentsData } from "../-utils/helper";

// Course data interface
export interface FinalCourseData {
    aboutCourse: string;
    course: string;
    courseBanner: string;
    customHtml: string;
    description: string;
    includeInstituteLogo: boolean;
    includePaymentPlans: boolean;
    learningOutcome: string;
    restrictToSameBatch: boolean;
    showRelatedCourses: boolean;
    tags: string[];
    targetAudience: string;
}

// Form field value interface
export interface FormFieldValue {
    id: string;
    name: string;
    value: string;
    is_mandatory: boolean;
    type: string;
    comma_separated_options?: string[];
}

interface PaymentOption {
    features?: string[];
    title?: string;
    price?: string;
    value?: number;
    unit?: string;
}

// Form values interface
export interface FormValues {
    [key: string]: FormFieldValue;
}

// Invite data interface
export interface InviteData {
    id: string;
    institute_id: string;
    type: string;
    type_id: string;
    custom_field: {
        id: string;
        fieldKey: string;
        fieldName: string;
        fieldType: string;
        defaultValue: string;
        config: string;
        formOrder: number;
        isMandatory: boolean;
        isFilter: boolean;
        isSortable: boolean;
        createdAt: string;
        updatedAt: string;
        sessionId: string;
        liveSessionId: string | null;
        customFieldValue: string | null;
    };
}

// Registration step props interface
export interface RegistrationStepProps {
    /** Course data containing all course-related information */
    courseData: FinalCourseData;
    /** Invite data containing custom field configurations */
    inviteData: InviteData | null;
    /** Callback function called when form is submitted */
    onSubmit: (values: FormValues) => void;
    /** React Hook Form instance */
    form: UseFormReturn<FormValues>;
}

const currencySymbols: { [key: string]: string } = {
    USD: "$",
    EUR: "€",
    GBP: "£",
    INR: "₹",
    AUD: "A$",
    CAD: "C$",
};

export const getCurrencySymbol = (currencyCode: string) => {
    return currencySymbols[currencyCode] || currencyCode;
};

export const getPaymentPlanIcon = (type: string) => {
    switch (type) {
        case "subscription":
            return <Calendar className="size-5" />;
        case "upfront":
            return <DollarSign className="size-5" />;
        case "free":
            return <Globe className="size-5" />;
        default:
            return <CreditCard className="size-5" />;
    }
};

export const getAllUniqueFeatures = (
    paymentOptions: PaymentOption[]
): string[] => {
    const allFeatures = new Set<string>();
    paymentOptions?.forEach((option) => {
        option.features?.forEach((feature: string) => {
            allFeatures.add(feature);
        });
    });
    return Array.from(allFeatures);
};

const RegistrationStep = ({
    courseData,
    inviteData,
    onSubmit,
    form,
}: RegistrationStepProps) => {
    const planInfo =
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        inviteData?.package_session_to_payment_options?.[0]?.payment_option;
    const selectedPlan = getDefaultPlanFromPaymentsData(planInfo);
    const allFeatures = selectedPlan?.paymentOption
        ? getAllUniqueFeatures(selectedPlan.paymentOption)
        : [];

    return (
        <>
            {/* Show selected plan in a card */}
            {(selectedPlan?.type?.toLowerCase() === "subscription" ||
                selectedPlan?.type?.toLowerCase() === "upfront" ||
                selectedPlan?.type?.toLowerCase() === "one_time") &&
                courseData.includePaymentPlans && (
                    <Card className="mb-4 flex flex-col gap-0">
                        <div className="flex flex-col items-start gap-3 p-4">
                            <div className="flex items-center gap-3">
                                {getPaymentPlanIcon(selectedPlan?.type || "")}
                                <div className="flex flex-1 flex-col font-semibold">
                                    <span>{selectedPlan?.name}</span>
                                </div>
                            </div>
                            {(selectedPlan?.type.toLowerCase() === "one_time" ||
                                selectedPlan?.type.toLowerCase() ===
                                    "upfront") && (
                                <div className="flex flex-col gap-4">
                                    {selectedPlan?.paymentOption && (
                                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                                            {selectedPlan?.paymentOption?.map(
                                                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                                                // @ts-expect-error
                                                (payment, idx) => {
                                                    return (
                                                        <Card
                                                            key={idx}
                                                            className="w-full border border-gray-200 p-4 transition-colors hover:border-gray-300"
                                                        >
                                                            <div className="flex flex-col gap-3">
                                                                {/* Title */}
                                                                <h4 className="text-base font-bold text-gray-900">
                                                                    {
                                                                        payment.title
                                                                    }
                                                                </h4>

                                                                {/* Price with time period inline */}
                                                                <div className="text-xl font-bold text-primary-500">
                                                                    {getCurrencySymbol(
                                                                        selectedPlan?.currency ||
                                                                            ""
                                                                    )}
                                                                    {
                                                                        payment.price
                                                                    }
                                                                    &nbsp;
                                                                    {payment.value &&
                                                                        payment.unit && (
                                                                            <span className="text-sm font-normal text-gray-500">
                                                                                /
                                                                                {
                                                                                    payment.value
                                                                                }{" "}
                                                                                {
                                                                                    payment.unit
                                                                                }
                                                                            </span>
                                                                        )}
                                                                </div>

                                                                {/* Features */}
                                                                {allFeatures.length >
                                                                    0 && (
                                                                    <div className="space-y-2">
                                                                        {allFeatures.map(
                                                                            (
                                                                                feature,
                                                                                featureIdx
                                                                            ) => {
                                                                                const isIncluded =
                                                                                    payment.features?.includes(
                                                                                        feature
                                                                                    );
                                                                                return (
                                                                                    <div
                                                                                        key={
                                                                                            featureIdx
                                                                                        }
                                                                                        className="flex items-center gap-1.5 text-sm"
                                                                                    >
                                                                                        {isIncluded ? (
                                                                                            <Check className="size-3 shrink-0 text-emerald-500" />
                                                                                        ) : (
                                                                                            <X className="size-3 shrink-0 text-gray-400" />
                                                                                        )}
                                                                                        <span
                                                                                            className={`${
                                                                                                isIncluded
                                                                                                    ? "text-gray-700"
                                                                                                    : "text-gray-400 line-through"
                                                                                            } leading-tight`}
                                                                                        >
                                                                                            {
                                                                                                feature
                                                                                            }
                                                                                        </span>
                                                                                    </div>
                                                                                );
                                                                            }
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </Card>
                                                    );
                                                }
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                            {selectedPlan?.type.toLowerCase() ===
                                "subscription" && (
                                <div className="flex w-fit flex-wrap gap-4">
                                    {selectedPlan?.paymentOption?.map(
                                        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                                        // @ts-expect-error
                                        (payment, idx) => {
                                            return (
                                                <Card
                                                    key={idx}
                                                    className="w-full border border-gray-200 p-8 py-6 transition-colors hover:border-gray-300"
                                                >
                                                    <div className="flex flex-col gap-3">
                                                        {/* Title */}
                                                        <h4 className="text-xl font-bold text-gray-900">
                                                            {payment.title}
                                                        </h4>

                                                        {/* Price with time period inline */}
                                                        <div className="text-xl font-bold text-primary-500">
                                                            {getCurrencySymbol(
                                                                selectedPlan?.currency ||
                                                                    ""
                                                            )}
                                                            {payment.price}
                                                            &nbsp;
                                                            {payment.value &&
                                                                payment.unit && (
                                                                    <span className="text-sm font-normal text-gray-500">
                                                                        /
                                                                        {
                                                                            payment.value
                                                                        }{" "}
                                                                        {
                                                                            payment.unit
                                                                        }
                                                                    </span>
                                                                )}
                                                        </div>

                                                        {/* Features */}
                                                        {allFeatures.length >
                                                            0 && (
                                                            <div className="space-y-2">
                                                                {allFeatures.map(
                                                                    (
                                                                        feature,
                                                                        featureIdx
                                                                    ) => {
                                                                        const isIncluded =
                                                                            payment.features?.includes(
                                                                                feature
                                                                            );
                                                                        return (
                                                                            <div
                                                                                key={
                                                                                    featureIdx
                                                                                }
                                                                                className="flex items-center gap-1.5 text-sm"
                                                                            >
                                                                                {isIncluded ? (
                                                                                    <Check className="size-3 shrink-0 text-emerald-500" />
                                                                                ) : (
                                                                                    <X className="size-3 shrink-0 text-gray-400" />
                                                                                )}
                                                                                <span
                                                                                    className={`${
                                                                                        isIncluded
                                                                                            ? "text-gray-700"
                                                                                            : "text-gray-400 line-through"
                                                                                    } leading-tight`}
                                                                                >
                                                                                    {
                                                                                        feature
                                                                                    }
                                                                                </span>
                                                                            </div>
                                                                        );
                                                                    }
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </Card>
                                            );
                                        }
                                    )}
                                </div>
                            )}
                        </div>
                    </Card>
                )}
            <Card
                id="registration-card"
                className="overflow-hidden shadow-xl border-0 bg-white/80 backdrop-blur-sm w-full"
            >
                <CardContent className="p-6 sm:p-8">
                    <div className="flex items-start gap-2 sm:gap-3 mb-6">
                        <div className="p-1.5 sm:p-2 bg-blue-100 rounded-lg flex-shrink-0">
                            <GraduationCap className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                        </div>
                        <div>
                            <h2 className="text-lg sm:text-xl md:text-2xl font-semibold text-gray-900 leading-tight">
                                Registration Details
                            </h2>
                            <p className="text-gray-600 text-sm mt-1">
                                Fill in your details to enroll in the course
                            </p>
                        </div>
                    </div>

                    <Separator className="mb-6" />

                    <div className="flex justify-center items-center w-full">
                        <div className="flex justify-center items-start w-full flex-col bg-white rounded-xl py-0 mb-4">
                            <FormProvider {...form}>
                                <form className="w-full flex flex-col gap-6 mt-4 max-h-full overflow-auto">
                                    {Object.entries(form.getValues()).map(
                                        ([key, value]: [
                                            string,
                                            FormFieldValue,
                                        ]) =>
                                            key === "phone_number" ? (
                                                <FormField
                                                    key={key}
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
                                                (err) => console.error(err)
                                            )}
                                            disable={Object.entries(
                                                form.getValues()
                                            ).some(
                                                ([, value]: [
                                                    string,
                                                    FormFieldValue,
                                                ]) =>
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
            {courseData?.customHtml && (
                <Card
                    id="registration-card"
                    className="overflow-hidden shadow-xl border-0 bg-white/80 backdrop-blur-sm w-full"
                >
                    <CardContent className="p-6 sm:p-8">
                        <div className="flex items-start gap-2 sm:gap-3 mb-6">
                            <div
                                className="w-full h-full"
                                dangerouslySetInnerHTML={{
                                    __html: courseData?.customHtml || "",
                                }}
                            />
                        </div>
                    </CardContent>
                </Card>
            )}
        </>
    );
};

export default RegistrationStep;
