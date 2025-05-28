import { MyButton } from '@/components/design-system/button';
import { SelectedFilterQuestionWise } from '@/types/assessments/student-questionwise-status';

interface ScheduleTestFilterButtonsProps {
    selectedQuestionPaperFilters: SelectedFilterQuestionWise;
    handleSubmitFilters: () => void;
    handleResetFilters: () => void;
}

const StudentQuestionwiseFilterButtons = ({
    selectedQuestionPaperFilters,
    handleSubmitFilters,
    handleResetFilters,
}: ScheduleTestFilterButtonsProps) => {
    const isButtonEnabled = () => {
        const { name, registration_source_id } = selectedQuestionPaperFilters;
        return name || registration_source_id?.length > 0;
    };
    return (
        <>
            {!!isButtonEnabled() && (
                <div className="flex gap-6">
                    <MyButton
                        buttonType="primary"
                        scale="small"
                        layoutVariant="default"
                        className="h-8"
                        onClick={handleSubmitFilters}
                    >
                        Filter
                    </MyButton>
                    <MyButton
                        buttonType="secondary"
                        scale="small"
                        layoutVariant="default"
                        className="h-8 border border-neutral-400 bg-neutral-200 hover:border-neutral-500 hover:bg-neutral-300 active:border-neutral-600 active:bg-neutral-400"
                        onClick={handleResetFilters}
                    >
                        Reset
                    </MyButton>
                </div>
            )}
        </>
    );
};

export default StudentQuestionwiseFilterButtons;
