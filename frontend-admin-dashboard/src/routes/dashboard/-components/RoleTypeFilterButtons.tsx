import { MyButton } from "@/components/design-system/button";
import { RoleTypeSelectedFilter } from "./RoleTypeComponent";

interface RoleTypeFilterButtonsProps {
    selectedQuestionPaperFilters: RoleTypeSelectedFilter;
    handleSubmitFilters: () => void;
    handleResetFilters: () => void;
}

const RoleTypeFilterButtons = ({
    selectedQuestionPaperFilters,
    handleSubmitFilters,
    handleResetFilters,
}: RoleTypeFilterButtonsProps) => {
    const isButtonEnabled = () => {
        const { roles, status } = selectedQuestionPaperFilters;
        return roles?.length > 0 || status?.length > 0;
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

export default RoleTypeFilterButtons;
