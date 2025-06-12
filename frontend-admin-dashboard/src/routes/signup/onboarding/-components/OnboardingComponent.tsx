import { Separator } from '@/components/ui/separator';
import { VacademyAssessLogo, VacademyLMSLogo } from '@/svgs';
import { useState } from 'react';
import { CreateOnboardingSidebar } from './CreateOnboardingSidebar';
import { OnboardingSteps } from './OnboardingSteps';
import { Route } from '..';

export function OnboardingComponent() {
    const searchParams = Route.useSearch();
    const steps = ['Organization Setup', 'Organization Theme', 'Add Your Details'];
    const [currentStep, setCurrentStep] = useState(0);
    const [completedSteps, setCompletedSteps] = useState([false, false]);

    const completeCurrentStep = () => {
        setCompletedSteps((prev) => {
            const updated = [...prev];
            updated[currentStep] = true;
            return updated;
        });
        if (currentStep < steps.length - 1) {
            setCurrentStep((prev) => prev + 1);
        }
    };

    const goToStep = (index: number) => {
        if (index <= currentStep || completedSteps[index - 1]) {
            setCurrentStep(index);
        }
    };
    return (
        <div className="flex h-screen w-full">
            <div className="flex w-1/2 flex-col items-center justify-center bg-primary-50">
                <div>
                    <div className="flex items-center">
                        {searchParams.assess && <VacademyAssessLogo />}
                        {searchParams.lms && <VacademyLMSLogo />}
                    </div>
                    <p>Fast-track your access in 3 steps—explore the tool now!</p>
                    <Separator className="my-6" />
                    <CreateOnboardingSidebar
                        steps={steps}
                        currentStep={currentStep}
                        completedSteps={completedSteps}
                        onStepClick={goToStep}
                    />
                </div>
            </div>
            <div className="flex w-1/2 items-center justify-center">
                <OnboardingSteps
                    currentStep={currentStep}
                    handleCompleteCurrentStep={completeCurrentStep}
                    completedSteps={completedSteps}
                />
            </div>
        </div>
    );
}
