import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { CaretLeft, CaretRight, Compass, MagicWand } from "@phosphor-icons/react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { MyButton } from "@/components/design-system/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { getTerminology, getTerminologyPlural } from "@/components/common/layout-container/sidebar/utils";
import { ContentTerms, SystemTerms } from "@/types/naming-settings";

export type CatalogueFilterWizardStep = "level" | "session" | "tag";

export interface CatalogueFilterWizardOption {
    id: string;
    name: string;
}

export interface CatalogueFilterWizardSelection {
    levels: string[];
    sessions: string[];
    tags: string[];
}

interface CatalogueFilterWizardProps {
    open: boolean;
    steps: CatalogueFilterWizardStep[];
    mandatory: boolean;
    levels: CatalogueFilterWizardOption[];
    sessions: CatalogueFilterWizardOption[];
    tags: CatalogueFilterWizardOption[];
    onComplete: (selection: CatalogueFilterWizardSelection) => void;
    onSkip: () => void;
}

const EMPTY_SELECTION: CatalogueFilterWizardSelection = { levels: [], sessions: [], tags: [] };

/**
 * Step-by-step filter picker shown once, the first time a learner opens the
 * course catalogue — asks only the steps an admin enabled (Course Settings →
 * Catalogue & Publishing), in the fixed order Level → Session → Tag, then
 * applies the picks as the catalogue's active filters. Steps whose institute
 * has no options at all are skipped so the learner is never stuck on an
 * unanswerable step.
 */
export const CatalogueFilterWizard: React.FC<CatalogueFilterWizardProps> = ({
    open,
    steps,
    mandatory,
    levels,
    sessions,
    tags,
    onComplete,
    onSkip,
}) => {
    const { t } = useTranslation("study");
    const [stepIndex, setStepIndex] = useState(0);
    const [selection, setSelection] = useState<CatalogueFilterWizardSelection>(EMPTY_SELECTION);

    const optionsByStep: Record<CatalogueFilterWizardStep, CatalogueFilterWizardOption[]> = {
        level: levels,
        session: sessions,
        tag: tags,
    };

    // Drop any step whose institute has zero options — nothing to ask there.
    const activeSteps = useMemo(
        () => steps.filter((step) => optionsByStep[step].length > 0),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [steps, levels, sessions, tags]
    );

    useEffect(() => {
        if (open) {
            setStepIndex(0);
            setSelection(EMPTY_SELECTION);
        }
    }, [open]);

    // Nothing answerable — don't strand the learner on an empty dialog.
    useEffect(() => {
        if (open && activeSteps.length === 0) {
            onSkip();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, activeSteps.length]);

    if (activeSteps.length === 0) return null;

    const currentStep = activeSteps[stepIndex]!;
    const isLastStep = stepIndex === activeSteps.length - 1;
    const currentOptions = optionsByStep[currentStep];
    const selectionKey: keyof CatalogueFilterWizardSelection =
        currentStep === "level" ? "levels" : currentStep === "session" ? "sessions" : "tags";
    const currentSelected = selection[selectionKey];

    const stepTitle =
        currentStep === "tag"
            ? getTerminologyPlural(ContentTerms.PopularTag, SystemTerms.PopularTag)
            : currentStep === "level"
              ? getTerminology(ContentTerms.Level, SystemTerms.Level)
              : getTerminology(ContentTerms.Session, SystemTerms.Session);

    const toggleOption = (id: string) => {
        setSelection((prev) => {
            const list = prev[selectionKey];
            const next = list.includes(id) ? list.filter((i) => i !== id) : [...list, id];
            return { ...prev, [selectionKey]: next };
        });
    };

    const handleNext = () => {
        if (isLastStep) {
            onComplete(selection);
        } else {
            setStepIndex((i) => i + 1);
        }
    };

    const handleBack = () => setStepIndex((i) => Math.max(0, i - 1));

    return (
        <Dialog
            open={open}
            onOpenChange={(nextOpen) => {
                // Controlled dialog: only the non-mandatory case should ever
                // close from here (X button, Escape, outside click) — treat
                // that the same as an explicit Skip.
                if (!nextOpen && !mandatory) onSkip();
            }}
        >
            <DialogContent
                className={cn("max-w-md gap-0 p-0", !mandatory ? undefined : "[&>button]:hidden")}
                onPointerDownOutside={(e) => e.preventDefault()}
                onEscapeKeyDown={(e) => {
                    if (mandatory) e.preventDefault();
                }}
                onInteractionOutside={(e) => {
                    if (mandatory) e.preventDefault();
                }}
            >
                <DialogHeader className="space-y-2 p-6 pb-4">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary-100 to-primary-50 ring-1 ring-primary-200/60">
                        <MagicWand className="size-5 text-primary-600" weight="fill" />
                    </div>
                    <DialogTitle>
                        {t("catalogFilterWizard.title", { term: stepTitle })}
                    </DialogTitle>
                    <DialogDescription>
                        {t("catalogFilterWizard.description", { term: stepTitle })}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex items-center gap-1.5 px-6">
                    {activeSteps.map((step, i) => (
                        <span
                            key={step}
                            className={cn(
                                "h-1.5 flex-1 rounded-full transition-colors",
                                i <= stepIndex ? "bg-primary-500" : "bg-neutral-200"
                            )}
                        />
                    ))}
                </div>
                <p className="px-6 pb-3 pt-2 text-caption text-muted-foreground">
                    {t("catalogFilterWizard.stepOf", {
                        current: stepIndex + 1,
                        total: activeSteps.length,
                    })}
                </p>

                <ScrollArea className="max-h-72 px-6">
                    <div className="space-y-2 pb-2">
                        {currentOptions.map((option) => (
                            <div
                                key={option.id}
                                className="flex items-center gap-2 rounded-md border border-transparent px-2 py-1.5 hover:bg-primary-50/50"
                            >
                                <Checkbox
                                    id={`wizard-${currentStep}-${option.id}`}
                                    checked={currentSelected.includes(option.id)}
                                    onCheckedChange={() => toggleOption(option.id)}
                                />
                                <Label
                                    htmlFor={`wizard-${currentStep}-${option.id}`}
                                    className="flex-1 cursor-pointer text-sm font-normal"
                                >
                                    {option.name}
                                </Label>
                            </div>
                        ))}
                    </div>
                </ScrollArea>

                <DialogFooter className="flex-row items-center justify-between gap-2 border-t p-4">
                    {!mandatory ? (
                        <Button variant="ghost" size="sm" onClick={onSkip} className="text-muted-foreground">
                            <Compass size={14} className="me-1.5" />
                            {t("catalogFilterWizard.skip")}
                        </Button>
                    ) : (
                        <span />
                    )}
                    <div className="flex items-center gap-2">
                        {stepIndex > 0 && (
                            <Button variant="outline" size="sm" onClick={handleBack}>
                                <CaretLeft size={14} className="me-1" />
                                {t("catalogFilterWizard.back")}
                            </Button>
                        )}
                        <MyButton
                            scale="small"
                            buttonType="primary"
                            disable={currentSelected.length === 0}
                            onClick={handleNext}
                        >
                            {isLastStep
                                ? t("catalogFilterWizard.showCourses")
                                : t("catalogFilterWizard.next")}
                            {!isLastStep && <CaretRight size={14} className="ms-1" />}
                        </MyButton>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default CatalogueFilterWizard;
