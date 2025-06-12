import {
    MCQS,
    MCQM,
    Numerical,
    TrueFalse,
    // Match,
    LongAnswer,
    SingleWord,
    CMCQS,
    CMCQM,
    // CompTrueFalse,
    // CompLongAnswer,
    // CompSingleWord,
} from "@/svgs";
import {
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { QuestionPaperUpload } from "./QuestionPaperUpload";
import { X } from "phosphor-react";
import useDialogStore from "../-global-states/question-paper-dialogue-close";
import { useState } from "react";
import { QuestionType as QuestionTypeList } from "@/constants/dummy-data";
import {
    QuestionTypeProps,
    QuestionPaperHeadingInterface,
} from "@/types/assessments/question-type-types";

export function QuestionTypeSelection({
    currentQuestionIndex,
    setCurrentQuestionIndex,
    isDirectAdd = true,
    handleSelect,
}: QuestionPaperHeadingInterface) {
    const { setIsManualQuestionPaperDialogOpen } = useDialogStore();
    const [questionType, setQuestionType] = useState<QuestionTypeList>(QuestionTypeList.MCQS);
    console.log(questionType);
    const QuestionType: React.FC<QuestionTypeProps> = ({
        icon,
        text,
        type = QuestionTypeList.MCQS,
    }) => {
        return (
            <div
                className="w-full"
                onClick={() => {
                    if (isDirectAdd) {
                        setQuestionType(type);
                    } else if (handleSelect) {
                        handleSelect(type);
                    }
                }}
            >
                {isDirectAdd ? (
                    <AlertDialogTrigger className="w-full">
                        <div className="flex w-full cursor-pointer flex-row items-center gap-4 rounded-md border px-4 py-3">
                            {icon}
                            <div className="text-body">{text}</div>
                        </div>
                    </AlertDialogTrigger>
                ) : (
                    <div className="flex w-full cursor-pointer flex-row items-center gap-4 rounded-md border px-4 py-3">
                        {icon}
                        <div className="text-body">{text}</div>
                    </div>
                )}
            </div>
        );
    };
    return (
        <div className="flex flex-col gap-6 p-6">
            <>
                <div className="flex flex-col gap-4">
                    <div className="text-subtitle font-semibold">Quick Access</div>
                    <QuestionType
                        icon={<MCQS />}
                        text="Multiple Choice Questions (Single correct)"
                        type={QuestionTypeList.MCQS}
                    ></QuestionType>
                    <QuestionType
                        icon={<MCQM />}
                        text="Multiple Choice Questions (Multiple correct)"
                        type={QuestionTypeList.MCQM}
                    ></QuestionType>
                    <QuestionType
                        icon={<Numerical />}
                        text="Numerical"
                        type={QuestionTypeList.NUMERIC}
                    ></QuestionType>
                    <QuestionType
                        type={QuestionTypeList.TRUE_FALSE}
                        icon={<TrueFalse />}
                        text="True False"
                    ></QuestionType>
                </div>
                <div className="border"></div>
                <div className="flex flex-col gap-4">
                    <div className="text-subtitle font-semibold">Option Based</div>
                    <QuestionType
                        icon={<MCQS />}
                        text="Multiple Choice Questions (Single correct)"
                        type={QuestionTypeList.MCQS}
                    ></QuestionType>
                    <QuestionType
                        icon={<MCQM />}
                        text="Multiple Choice Questions (Multiple correct)"
                        type={QuestionTypeList.MCQM}
                    ></QuestionType>
                    {/* <QuestionType icon={<TrueFalse />} text="True False"></QuestionType> */}
                    {/* <QuestionType icon={<Match />} text="Match the Collunm"></QuestionType> */}
                </div>
                <div className="border"></div>
                <div className="flex flex-col gap-4">
                    <div className="text-subtitle font-semibold">Math Based</div>
                    <QuestionType icon={<Numerical />} text="Numerical"></QuestionType>
                </div>
                <div className="border"></div>
                <div className="flex flex-col gap-4">
                    <div className="text-subtitle font-semibold">Writing Skills</div>
                    <QuestionType
                        icon={<LongAnswer />}
                        type={QuestionTypeList.LONG_ANSWER}
                        text="Long Answer"
                    ></QuestionType>
                    <QuestionType
                        icon={<SingleWord />}
                        type={QuestionTypeList.ONE_WORD}
                        text="Single Word"
                    ></QuestionType>
                </div>
                <div className="border"></div>
                <div className="flex flex-col gap-4">
                    <div className="text-subtitle font-semibold">Reading Skills</div>
                    <QuestionType
                        icon={<CMCQS />}
                        text="Comprehension Multiple Choice Questions (Single correct)"
                        type={QuestionTypeList.CMCQS}
                    ></QuestionType>
                    <QuestionType
                        icon={<CMCQM />}
                        text="Comprehension Multiple Choice Questions (Multiple correct)"
                        type={QuestionTypeList.CMCQM}
                    ></QuestionType>
                    <QuestionType
                        icon={<CMCQM />}
                        text="Comprehension Numeric"
                        type={QuestionTypeList.CNUMERIC}
                    ></QuestionType>
                    {/* <QuestionType
                        icon={<CompTrueFalse />}
                        text="Comprehension True False"
                    ></QuestionType>
                    <QuestionType
                        icon={<CompLongAnswer />}
                        text="Comprehension Long Answer"
                    ></QuestionType>
                    <QuestionType
                        icon={<CompSingleWord />}
                        text="Comprehension Single Word"
                    ></QuestionType> */}
                </div>
            </>
            {isDirectAdd && (
                <AlertDialogContent className="p-0">
                    <div className="flex items-center justify-between rounded-md bg-primary-50">
                        <h1 className="rounded-sm p-4 font-bold text-primary-500">
                            Create Question Paper Manually
                        </h1>
                        <AlertDialogCancel
                            onClick={() => setIsManualQuestionPaperDialogOpen(false)}
                            className="border-none bg-primary-50 shadow-none hover:bg-primary-50"
                        >
                            <X className="text-neutral-600" />
                        </AlertDialogCancel>
                    </div>
                    <QuestionPaperUpload
                        isManualCreated={true}
                        currentQuestionIndex={currentQuestionIndex}
                        setCurrentQuestionIndex={setCurrentQuestionIndex}
                    />
                </AlertDialogContent>
            )}
        </div>
    );
}
