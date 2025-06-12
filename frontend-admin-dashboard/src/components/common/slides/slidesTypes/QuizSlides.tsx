import { useEffect } from "react";
import { useForm } from "react-hook-form";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { MainViewQuillEditor } from "@/components/quill/MainViewQuillEditor";
import { formatStructure } from "@/routes/assessment/question-papers/-utils/helper";
import { SlideType } from "../constant/slideType";
import { useSlideStore } from "@/stores/Slides/useSlideStore";

export const QuizeSlide = ({
  formdata,
  questionType,
  className,
  currentSlideId
}: {
  formdata: any;
  questionType: SlideType;
  className?: string;
  currentSlideId: string;
}) => {
  const { updateQuizeSlide } = useSlideStore();

  const form = useForm({
    defaultValues: formdata,
  });

  const { control, getValues, setValue, watch } = form;
  const options = getValues("singleChoiceOptions") ?? [];
  const optionsType = "";
  const answersType = "Answers:";

  const formValues = form.getValues();
  const questionName = watch("questionName");
const singleChoiceOptions = watch("singleChoiceOptions");
const feedbackAnswer = watch("feedbackAnswer");

useEffect(() => {
  updateQuizeSlide(currentSlideId, formValues);
}, [questionName, singleChoiceOptions, feedbackAnswer, currentSlideId,]);
  const handleOptionChange = (optionIndex: number) => {
    const isCurrentlySelected = getValues(
      `singleChoiceOptions.${optionIndex}.isSelected`
    );

    const updatedOptions = options.map((option: any, index: number) => ({
      ...option,
      isSelected: index === optionIndex ? !isCurrentlySelected : false,
    }));

    setValue("singleChoiceOptions", updatedOptions, { 
      shouldDirty: true, 
      shouldValidate: true 
    });
  };

  return (
    <Form {...form}>
      <form className={`bg-white p-8 ${className}`}>
        {/* Question */}
        <div className="flex w-full flex-col !flex-nowrap items-start gap-1 mt-4">
          <span>Question</span>
          <FormField
            control={control}
            name="questionName"
            render={({ field }) => (
              <FormItem className="w-full">
                <FormControl>
                  <MainViewQuillEditor
                    value={field.value}
                    onChange={field.onChange}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {questionType === SlideType.Quiz && (
          <>
            {/* Options */}
            <span className="mt-6">{answersType}</span>
            <div className="flex w-full grow flex-wrap gap-8 mt-2">
              {options.map((opt: any, idx: number) => (
                <div
                  key={idx}
                  className={`flex w-2/5 items-center justify-between gap-4 rounded-md bg-neutral-100 p-4 ${
                    opt?.isSelected
                      ? "border border-primary-300 bg-primary-50"
                      : ""
                  }`}
                >
                  <div className="flex w-full items-center gap-4">
                    <div className="flex size-10 items-center justify-center rounded-full bg-white px-3">
                      <span className="!p-0 text-sm">
                        {optionsType
                          ? formatStructure(optionsType, String.fromCharCode(97 + idx))
                          : `(${String.fromCharCode(97 + idx)}.)`}
                      </span>
                    </div>
                    <FormField
                      control={control}
                      name={`singleChoiceOptions.${idx}.name`}
                      render={({ field }) => (
                        <FormItem className="w-full">
                          <FormControl>
                            <MainViewQuillEditor
                              value={field.value}
                              onChange={field.onChange}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="flex size-10 items-center justify-center rounded-full bg-white px-4">
                    <FormField
                      control={control}
                      name={`singleChoiceOptions.${idx}.isSelected`}
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={() => handleOptionChange(idx)}
                              className={`mt-1 size-5 rounded-xl border-2 shadow-none ${
                                field.value
                                  ? "border-none bg-green-500 text-white"
                                  : ""
                              }`}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {questionType === SlideType.Feedback && (
          <div className="mt-6 w-full">
            <FormField
              control={control}
              name="feedbackAnswer"
              render={({ field }) => (
                <FormItem className="w-full">
                  <FormControl>
                    <MainViewQuillEditor
                      value={field.value}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )}
      </form>
    </Form>
  );
};