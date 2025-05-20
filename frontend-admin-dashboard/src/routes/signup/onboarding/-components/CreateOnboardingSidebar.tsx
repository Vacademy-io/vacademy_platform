import { CheckCircle } from "phosphor-react";
import React from "react";

export interface OrganizationOnboardingSidebarProps {
    steps: string[];
    currentStep: number;
    completedSteps: boolean[];
    onStepClick: (index: number) => void;
}

export const CreateOnboardingSidebar: React.FC<OrganizationOnboardingSidebarProps> = ({
    steps,
    currentStep,
    completedSteps,
    onStepClick,
}) => {
    return (
        <>
            {steps.map((step, index) => (
                <div
                    key={index}
                    onClick={() => onStepClick(index)}
                    className={`mx-6 flex items-center justify-between px-6 py-3 ${
                        index <= currentStep || completedSteps[index - 1]
                            ? "cursor-pointer"
                            : "cursor-not-allowed"
                    } ${
                        currentStep === index
                            ? "rounded-lg border-2 bg-white !text-primary-500"
                            : completedSteps[index]
                              ? "bg-transparent text-black"
                              : `bg-transparent ${
                                    index > 0 && completedSteps[index - 1]
                                        ? "text-black"
                                        : "text-gray-300"
                                } `
                    } focus:outline-none`}
                >
                    <div className="flex items-center gap-6">
                        <span className="text-lg font-semibold">{index + 1}</span>
                        <span className="font-thin">{step}</span>
                    </div>

                    {completedSteps[index] && (
                        <CheckCircle size={24} weight="fill" className="!text-green-500" />
                    )}
                </div>
            ))}
        </>
    );
};
