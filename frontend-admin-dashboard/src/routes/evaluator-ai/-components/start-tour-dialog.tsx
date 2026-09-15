import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MyButton } from '@/components/design-system/button';
import { MyDialog } from '@/components/design-system/dialog';
import { ArrowRight } from '@phosphor-icons/react';
import useLocalStorage from '../-hooks/useLocalStorage';
import { EvaluationAIKey } from '../-constants/intro-keys';

const StartTourDialog = ({ onStartTour }: { onStartTour: () => void }) => {
    const { t } = useTranslation('evaluatorAiStartTourDialog');
    const [firstVisit, setFirstVisit] = useLocalStorage<boolean>(
        EvaluationAIKey.dashboard,
        false
    ) as [boolean, (val: boolean) => void];
    const [isOpen, setIsOpen] = useState(!firstVisit);
    return (
        <MyDialog heading={t('title')} open={isOpen} onOpenChange={setIsOpen}>
            <div className="flex flex-col gap-y-4 p-3 text-base">
                {t('welcomeMessage')}
                <div className="flex justify-end gap-x-2">
                    <MyButton
                        buttonType="secondary"
                        onClick={() => {
                            setFirstVisit(true);
                            setIsOpen(false);
                        }}
                    >
                        {t('maybeLater')}
                    </MyButton>
                    <MyButton onClick={onStartTour}>
                        {t('getStarted')} <ArrowRight />
                    </MyButton>
                </div>
            </div>
        </MyDialog>
    );
};

export default StartTourDialog;
