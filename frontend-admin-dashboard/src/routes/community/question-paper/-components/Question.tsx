import { MyButton } from "@/components/design-system/button";
import { Question as QusetionDto } from "@/types/community/filters/questionDto";
import { processHtmlString } from "../-service/utils";

interface QuestionProps {
    idx: number;
    questionData: QusetionDto;
}
export function Question({ idx, questionData }: QuestionProps) {
    return (
        <div className="flex flex-1 flex-col bg-sidebar-background p-6">
            <div className="flex flex-row items-center justify-between">
                <div className="flex flex-col gap-1">
                    <div className="text-subtitle">Question {idx + 1}</div>
                    <div className="flex flex-row items-center gap-1">
                        {processHtmlString(questionData.text.content).map((item, index) =>
                            item.type === "text" ? (
                                <span key={index}>{item.content}</span>
                            ) : (
                                <img
                                    key={index}
                                    src={item.content}
                                    alt={`Question image ${index + 1}`}
                                    className=""
                                />
                            ),
                        )}
                    </div>
                    {/* <div>{showAnswer ? questionData.options[questionData.] : ""}</div> */}
                </div>
                <div className="flex flex-row items-center gap-4">
                    <MyButton buttonType="secondary" scale="small">
                        2 mark
                    </MyButton>
                    <div className="text-body text-primary-400">min</div>
                    <div className="size-4 border text-body"></div>
                </div>
            </div>
        </div>
    );
}
