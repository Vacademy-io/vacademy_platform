import { useState } from "react";
import TimelineReports from "./timelineReports";
import ProgressReports from "./progressReports";

export default function BatchReports() {
    const [learningData, setLearningData] = useState("TIMELINE");
    const renderLearningData = () => {
        switch (learningData) {
            case "TIMELINE":
                return <TimelineReports></TimelineReports>;
            case "PROGRESS":
                return <ProgressReports></ProgressReports>;

            default:
                return <></>;
        }
    };
    return (
        <div className="mt-9">
            <div className="w-fit rounded-sm border border-neutral-500 text-body">
                <button
                    className={`border-r border-neutral-500 px-3 py-[10px] ${
                        learningData === "TIMELINE"
                            ? "bg-primary-100 font-[600] text-neutral-600"
                            : ""
                    }`}
                    onClick={() => {
                        setLearningData("TIMELINE");
                    }}
                >
                    Learning Timeline
                </button>
                <button
                    className={`border-l border-neutral-500 px-3 py-[10px] ${
                        learningData === "PROGRESS"
                            ? "bg-primary-100 font-[600] text-neutral-600"
                            : ""
                    }`}
                    onClick={() => {
                        setLearningData("PROGRESS");
                    }}
                >
                    Learning Progress
                </button>
            </div>
            {renderLearningData()}
        </div>
    );
}
