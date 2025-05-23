import { useEffect } from "react";
import { UseFormReturn } from "react-hook-form";
import { useAdaptiveMarkingStore } from "./sectionData";
import { z } from "zod";
import sectionDetailsSchema from "../-utils/section-details-sechma";

export const useAdaptiveMarkingSync = (
    form: UseFormReturn<z.infer<typeof sectionDetailsSchema>>,
    sectionIndex: number,
) => {
    const { setSectionQuestions, getSectionQuestions } = useAdaptiveMarkingStore();
    const { watch, setValue } = form;

    // Sync form to store
    useEffect(() => {
        const subscription = watch((value) => {
            const questions = value.section?.[sectionIndex]?.adaptive_marking_for_each_question;
            if (questions) {
                // @ts-expect-error :Type 'undefined' is not assignable to type 'QuestionMarking'
                setSectionQuestions(sectionIndex, questions);
            }
        });

        return () => subscription.unsubscribe();
    }, [watch, sectionIndex, setSectionQuestions]);

    // Sync store to form
    useEffect(() => {
        const questions = getSectionQuestions(sectionIndex);
        if (questions.length > 0) {
            setValue(`section.${sectionIndex}.adaptive_marking_for_each_question`, questions);
        }
    }, [sectionIndex, getSectionQuestions, setValue]);
};
