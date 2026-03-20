import { CheckCircle } from '@phosphor-icons/react';
import React from 'react';

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
                    className={`flex items-center justify-between px-3 py-1.5 lg:mx-6 lg:px-6 lg:py-3 ${
                        index <= currentStep || completedSteps[index - 1]
                            ? 'cursor-pointer'
                            : 'cursor-not-allowed'
                    } ${
                        currentStep === index
                            ? 'rounded-lg border-2 bg-white !text-primary-500'
                            : completedSteps[index]
                              ? 'bg-transparent text-black'
                              : `bg-transparent ${
                                    index > 0 && completedSteps[index - 1]
                                        ? 'text-black'
                                        : 'text-gray-300'
                                } `
                    } focus:outline-none`}
                >
                    <div className="flex items-center gap-2 lg:gap-6">
                        <span className="text-sm font-semibold lg:text-lg">{index + 1}</span>
                        <span className="text-xs font-thin lg:text-base">{step}</span>
                    </div>

                    {completedSteps[index] && (
                        <CheckCircle
                            size={20}
                            weight="fill"
                            className="!text-green-500 lg:size-6"
                        />
                    )}
                </div>
            ))}
        </>
    );
};
