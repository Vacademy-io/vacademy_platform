import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { GraduationCap, RotateCcw } from "lucide-react";
import { FormProvider, UseFormReturn } from "react-hook-form";
import { FormControl, FormField, FormItem } from "@/components/ui/form";
import PhoneInputField from "@/components/design-system/phone-input-field";
import SelectField from "@/components/design-system/select-field";
import { MyInput } from "@/components/design-system/input";
import { MyButton } from "@/components/design-system/button";

// Course data interface
export interface FinalCourseData {
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

// Form field value interface
export interface FormFieldValue {
    id: string;
    name: string;
    value: string;
    is_mandatory: boolean;
    type: string;
    comma_separated_options?: string[];
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

const RegistrationStep = ({
    courseData,
    onSubmit,
    form,
}: RegistrationStepProps) => {
    return (
        <>
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
                        <div className="flex justify-center items-start w-full flex-col bg-white rounded-xl p-4 py-0 mx-4 mb-4">
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
