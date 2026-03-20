import React from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { QuestionTypeProps } from '../types';
import { MCQS, MCQM, Numerical, TrueFalse, LongAnswer, SingleWord, CMCQS, CMCQM } from '@/svgs';
import { QuestionType as QuestionTypeList } from '@/constants/dummy-data';

interface QuestionTypeSelectorProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onSelectQuestionType: (type: string) => void;
}

const QuestionTypeSelector: React.FC<QuestionTypeSelectorProps> = ({
    isOpen,
    onOpenChange,
    onSelectQuestionType,
}) => {
    const QuestionType = ({ icon, text, type = QuestionTypeList.MCQS }: QuestionTypeProps) => (
        <div
            className="flex w-full cursor-pointer flex-row items-center gap-4 rounded-md border px-4 py-3"
            onClick={() => {
                onSelectQuestionType(type);
                onOpenChange(false);
            }}
        >
            {icon}
            <div className="text-body">{text}</div>
        </div>
    );

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="size-[500px] p-0">
                <h1 className="rounded-t-lg bg-primary-50 p-4 font-semibold text-primary-500">
                    Add Question
                </h1>
                <div className="overflow-auto p-4">
                    <div className="flex flex-col gap-4">
                        <div className="text-subtitle font-semibold">Quick Access</div>
                        <QuestionType
                            icon={<MCQS />}
                            text="MCQ (Single correct)"
                            type={QuestionTypeList.MCQS}
                            handleAddQuestion={onSelectQuestionType}
                        />
                        <QuestionType
                            icon={<MCQM />}
                            text="MCQ (Multiple correct)"
                            type={QuestionTypeList.MCQM}
                            handleAddQuestion={onSelectQuestionType}
                        />
                        <QuestionType
                            icon={<Numerical />}
                            text="Numerical"
                            type={QuestionTypeList.NUMERIC}
                            handleAddQuestion={onSelectQuestionType}
                        />
                        <QuestionType
                            icon={<TrueFalse />}
                            text="True False"
                            type={QuestionTypeList.TRUE_FALSE}
                            handleAddQuestion={onSelectQuestionType}
                        />
                    </div>

                    <Separator className="my-6" />

                    <div className="flex flex-col gap-4">
                        <div className="text-subtitle font-semibold">Writing Skills</div>
                        <QuestionType
                            icon={<LongAnswer />}
                            text="Long Answer"
                            type={QuestionTypeList.LONG_ANSWER}
                            handleAddQuestion={onSelectQuestionType}
                        />
                        <QuestionType
                            icon={<SingleWord />}
                            text="Single Word"
                            type={QuestionTypeList.ONE_WORD}
                            handleAddQuestion={onSelectQuestionType}
                        />
                    </div>

                    <Separator className="my-6" />

                    <div className="flex flex-col gap-4">
                        <div className="text-subtitle font-semibold">Reading Skills</div>
                        <QuestionType
                            icon={<CMCQS />}
                            text="Comprehension MCQ (Single correct)"
                            type={QuestionTypeList.CMCQS}
                            handleAddQuestion={onSelectQuestionType}
                        />
                        <QuestionType
                            icon={<CMCQM />}
                            text="Comprehension MCQ (Multiple correct)"
                            type={QuestionTypeList.CMCQM}
                            handleAddQuestion={onSelectQuestionType}
                        />
                        <QuestionType
                            icon={<Numerical />}
                            text="Comprehension Numeric"
                            type={QuestionTypeList.CNUMERIC}
                            handleAddQuestion={onSelectQuestionType}
                        />
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default QuestionTypeSelector;
