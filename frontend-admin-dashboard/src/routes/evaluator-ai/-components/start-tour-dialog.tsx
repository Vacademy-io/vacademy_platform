import { useState } from "react";
import { MyButton } from "@/components/design-system/button";
import { MyDialog } from "@/components/design-system/dialog";
import { ArrowRight } from "phosphor-react";
import useLocalStorage from "../-hooks/useLocalStorage";
import { EvaluationAIKey } from "../-constants/intro-keys";

const StartTourDialog = ({ onStartTour }: { onStartTour: () => void }) => {
    const [firstVisit, setFirstVisit] = useLocalStorage<boolean>(
        EvaluationAIKey.dashboard,
        false,
    ) as [boolean, (val: boolean) => void];
    const [isOpen, setIsOpen] = useState(!firstVisit);
    return (
        <MyDialog heading="New Here?" open={isOpen} onOpenChange={setIsOpen}>
            <div className="flex flex-col gap-y-4 p-3 text-base">
                Hi there! Welcome aboard — would you like a quick tour to help you get started?
                <div className="flex justify-end gap-x-2">
                    <MyButton
                        buttonType="secondary"
                        onClick={() => {
                            setFirstVisit(true);
                            setIsOpen(false);
                        }}
                    >
                        Maybe Later
                    </MyButton>
                    <MyButton onClick={onStartTour}>
                        Let&apos;s Get Started <ArrowRight />
                    </MyButton>
                </div>
            </div>
        </MyDialog>
    );
};

export default StartTourDialog;
