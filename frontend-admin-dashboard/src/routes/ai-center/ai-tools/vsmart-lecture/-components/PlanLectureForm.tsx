import { DashboardLoader } from "@/components/core/dashboard-loader";
import { MyButton } from "@/components/design-system/button";
import { MyInput } from "@/components/design-system/input";
import SelectField from "@/components/design-system/select-field";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { languageSupport, teachingMethod } from "@/constants/dummy-data";
import {
    PlanLectureAIFormSchema,
    planLectureFormSchema,
} from "@/routes/ai-center/-utils/plan-lecture-schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { FormProvider, useForm } from "react-hook-form";

type PlanLectureFormProps = {
    handleSubmitSuccess: (data: PlanLectureAIFormSchema) => void;
    keyContext: string | null;
    loader: boolean;
};

const PlanLectureForm = ({ handleSubmitSuccess, keyContext, loader }: PlanLectureFormProps) => {
    const [open, setOpen] = useState(false);
    const form = useForm<PlanLectureAIFormSchema>({
        resolver: zodResolver(planLectureFormSchema),
        defaultValues: {
            taskName: "",
            prompt: "",
            level: "",
            teachingMethod: "",
            language: "",
            lectureDuration: {
                hrs: "0",
                min: "0",
            },
            isQuestionGenerated: false,
            isAssignmentHomeworkGenerated: false,
        },
    });

    const onSubmit = (values: PlanLectureAIFormSchema) => {
        handleSubmitSuccess(values);
    };
    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger>
                <MyButton
                    type="button"
                    scale="medium"
                    buttonType="primary"
                    layoutVariant="default"
                    className="text-sm"
                >
                    Plan Lecture
                </MyButton>
            </DialogTrigger>
            <DialogContent className="flex size-[600px] flex-col overflow-auto p-0">
                <h1 className="rounded-t-lg bg-primary-50 p-4 font-semibold text-primary-500">
                    Plan Lecture
                </h1>
                <FormProvider {...form}>
                    <form className="flex flex-col gap-4 overflow-y-auto px-6 py-4">
                        <FormField
                            control={form.control}
                            name="taskName"
                            render={({ field }) => (
                                <FormItem>
                                    <FormControl>
                                        <MyInput
                                            input={field.value?.toString() || ""}
                                            onChangeFunction={(e) => field.onChange(e.target.value)}
                                            label="Task Name"
                                            required={true}
                                            inputType="text"
                                            inputPlaceholder="Enter your task name"
                                            className="w-full"
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="prompt"
                            render={({ field }) => (
                                <FormItem>
                                    <FormControl>
                                        <div className="flex flex-col gap-2">
                                            <FormLabel>
                                                Topics to be covered in lecture{" "}
                                                <span className="text-red-500">*</span>
                                            </FormLabel>
                                            <Textarea
                                                placeholder="For example, Generate a set of questions covering the key principles of photosynthesis, including the process, factors affecting it, and its importance in the ecosystem. Focus on conceptual understanding and application"
                                                className="h-[100px] w-full"
                                                value={field.value}
                                                onChange={(e) => field.onChange(e.target.value)}
                                            />
                                        </div>
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="level"
                            render={({ field }) => (
                                <FormItem>
                                    <FormControl className="w-full">
                                        <MyInput
                                            input={field.value}
                                            onChangeFunction={(e) => field.onChange(e.target.value)}
                                            inputType="text"
                                            inputPlaceholder="for example, 8th standard"
                                            className="w-full"
                                            required={true}
                                            label="Level"
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                        <SelectField
                            label="Method of teaching"
                            labelStyle="font-semibold"
                            name="teachingMethod"
                            options={teachingMethod.map((option, index) => ({
                                value: option,
                                label: option,
                                _id: index,
                            }))}
                            control={form.control}
                            required
                            className="w-full font-thin"
                        />
                        <SelectField
                            label="Lecture Language"
                            labelStyle="font-semibold"
                            name="language"
                            options={languageSupport.map((option, index) => ({
                                value: option,
                                label: option,
                                _id: index,
                            }))}
                            control={form.control}
                            required
                            className="w-full font-thin"
                        />
                        <div className="flex flex-col items-start gap-2 text-sm font-thin">
                            <h1 className="font-normal">
                                Lecture Duration{" "}
                                <span className="text-subtitle text-danger-600">*</span>
                            </h1>
                            <div className="flex items-center gap-4">
                                <FormField
                                    control={form.control}
                                    name={`lectureDuration.hrs`}
                                    render={({ field: { ...field } }) => (
                                        <FormItem>
                                            <FormControl>
                                                <MyInput
                                                    inputType="text"
                                                    inputPlaceholder="00"
                                                    input={field.value}
                                                    onKeyPress={(e) => {
                                                        const charCode = e.key;
                                                        if (!/[0-9]/.test(charCode)) {
                                                            e.preventDefault(); // Prevent non-numeric input
                                                        }
                                                    }}
                                                    onChangeFunction={(e) => {
                                                        const inputValue = e.target.value.replace(
                                                            /[^0-9]/g,
                                                            "",
                                                        ); // Remove non-numeric characters
                                                        field.onChange(inputValue); // Call onChange with the sanitized value
                                                    }}
                                                    size="large"
                                                    {...field}
                                                    className="w-11"
                                                />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                                <span>hrs</span>
                                <span>:</span>
                                <FormField
                                    control={form.control}
                                    name={`lectureDuration.min`}
                                    render={({ field: { ...field } }) => (
                                        <FormItem>
                                            <FormControl>
                                                <MyInput
                                                    inputType="text"
                                                    inputPlaceholder="00"
                                                    input={field.value}
                                                    onKeyPress={(e) => {
                                                        const charCode = e.key;
                                                        if (!/[0-9]/.test(charCode)) {
                                                            e.preventDefault(); // Prevent non-numeric input
                                                        }
                                                    }}
                                                    onChangeFunction={(e) => {
                                                        const inputValue = e.target.value.replace(
                                                            /[^0-9]/g,
                                                            "",
                                                        ); // Remove non-numeric characters
                                                        field.onChange(inputValue); // Call onChange with the sanitized value
                                                    }}
                                                    size="large"
                                                    {...field}
                                                    className="w-11"
                                                />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                                <span>minutes</span>
                            </div>
                        </div>
                        <FormField
                            control={form.control}
                            name={`isQuestionGenerated`}
                            render={({ field }) => (
                                <FormItem className="flex items-center justify-between">
                                    <FormLabel className="font-normal">
                                        Do you want to generate questions in the lecture?
                                        <span className="text-subtitle text-danger-600">*</span>
                                    </FormLabel>
                                    <FormControl>
                                        <Switch
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name={`isAssignmentHomeworkGenerated`}
                            render={({ field }) => (
                                <FormItem className="flex items-center justify-between">
                                    <FormLabel className="font-normal">
                                        Do you want to generate assignment/homework in the lecture?
                                        <span className="text-subtitle text-danger-600">*</span>
                                    </FormLabel>
                                    <FormControl>
                                        <Switch
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />

                        <div>
                            {loader && keyContext == "planLecture" ? (
                                <MyButton
                                    type="button"
                                    scale="medium"
                                    buttonType="primary"
                                    layoutVariant="default"
                                    className="w-full text-sm"
                                >
                                    <DashboardLoader size={20} color="#ffffff" />
                                </MyButton>
                            ) : (
                                <MyButton
                                    type="button"
                                    scale="medium"
                                    buttonType="primary"
                                    layoutVariant="default"
                                    className="text-sm"
                                    onClick={form.handleSubmit(onSubmit)}
                                    disable={
                                        loader && keyContext != "planLecture" && keyContext != ""
                                    }
                                >
                                    Submit
                                </MyButton>
                            )}
                        </div>
                    </form>
                </FormProvider>
            </DialogContent>
        </Dialog>
    );
};

export default PlanLectureForm;
