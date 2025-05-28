import { FormProvider, useForm } from "react-hook-form";
import { uploadQuestionPaperFormSchema } from "../-utils/upload-question-paper-form-schema";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { QuestionPaperTemplate } from "./QuestionPaperTemplate";
import { Dispatch, SetStateAction, useEffect } from "react";
import { getLevelNameById, getSubjectNameById } from "../-utils/helper";
import { useInstituteDetailsStore } from "@/stores/students/students-list/useInstituteDetailsStore";

export const ViewQuestionPaper = ({
    questionPaperId,
    title,
    subject,
    level,
    refetchData,
    isAssessment,
    currentQuestionIndex,
    setCurrentQuestionIndex,
}: {
    questionPaperId: string | undefined;
    title: string | undefined;
    subject: string | null;
    level: string | null;
    refetchData?: () => void;
    isAssessment?: boolean;
    currentQuestionIndex: number;
    setCurrentQuestionIndex: Dispatch<SetStateAction<number>>;
}) => {
    const { instituteDetails } = useInstituteDetailsStore();
    const form = useForm<z.infer<typeof uploadQuestionPaperFormSchema>>({
        resolver: zodResolver(uploadQuestionPaperFormSchema),
        mode: "onChange",
        defaultValues: {
            questionPaperId: questionPaperId,
            isFavourite: false,
            title: title,
            createdOn: new Date(),
            yearClass: (instituteDetails && getLevelNameById(instituteDetails.levels, level)) || "",
            subject:
                (instituteDetails && getSubjectNameById(instituteDetails?.subjects, subject)) || "",
            questionsType: "",
            optionsType: "",
            answersType: "",
            explanationsType: "",
            fileUpload: null as unknown as File,
            questions: [],
        },
    });

    function onSubmit(values: z.infer<typeof uploadQuestionPaperFormSchema>) {
        console.log(values);
    }

    const onInvalid = (err: unknown) => {
        console.error(err);
    };

    useEffect(() => {
        setCurrentQuestionIndex(0);
    }, []);
    return (
        <FormProvider {...form}>
            <form onSubmit={form.handleSubmit(onSubmit, onInvalid)}>
                <QuestionPaperTemplate
                    form={form}
                    questionPaperId={questionPaperId}
                    isViewMode={true}
                    refetchData={refetchData}
                    buttonText={isAssessment ? "View" : "View Question Paper"}
                    isAssessment={isAssessment}
                    currentQuestionIndex={currentQuestionIndex}
                    setCurrentQuestionIndex={setCurrentQuestionIndex}
                />
            </form>
        </FormProvider>
    );
};

export default ViewQuestionPaper;
