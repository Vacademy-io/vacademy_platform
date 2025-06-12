import { Helmet } from "react-helmet";
import { QuestionPapersHeading } from "./QuestionPapersHeading";
import { QuestionPapersTabs } from "./QuestionPapersTabs";
import { useEffect, useState } from "react";
import { useNavHeadingStore } from "@/stores/layout-container/useNavHeadingStore";

export function QuestionPapersComponent() {
    const { setNavHeading } = useNavHeadingStore();
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

    useEffect(() => {
        setNavHeading(<h1 className="text-lg">Question Papers</h1>);
    }, []);

    return (
        <>
            <Helmet>
                <title>Question Papers</title>
                <meta
                    name="description"
                    content="This page shows show all the added question papers and also you can add question papers here too."
                />
            </Helmet>
            <div className="flex flex-col gap-4">
                <QuestionPapersHeading
                    currentQuestionIndex={currentQuestionIndex}
                    setCurrentQuestionIndex={setCurrentQuestionIndex}
                />
                <QuestionPapersTabs
                    isAssessment={false}
                    currentQuestionIndex={currentQuestionIndex}
                    setCurrentQuestionIndex={setCurrentQuestionIndex}
                />
            </div>
        </>
    );
}
