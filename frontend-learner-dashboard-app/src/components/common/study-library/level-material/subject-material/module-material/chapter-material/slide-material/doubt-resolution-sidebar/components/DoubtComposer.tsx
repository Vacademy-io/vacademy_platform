import { Plus, X } from "@phosphor-icons/react";
import { useTranslation } from "react-i18next";
import { MainViewQuillEditor } from "@/components/quill/MainViewQuillEditor";
import { MyButton } from "@/components/design-system/button";
import { AddDoubt } from "./AddDoubt";
import { TimestampChip } from "./TimestampChip";

interface DoubtComposerProps {
    open: boolean;
    doubt: string;
    setDoubt: (value: string) => void;
    onOpen: () => void;
    onCancel: () => void;
    refetch: () => void;
    setShowInput: (show: boolean) => void;
    /** Position this doubt is anchored to — undefined for slides without a position. */
    timestamp?: number;
    positionLabel?: string;
    isDocument: boolean;
    onEditPosition: () => void;
    /** Fired after a doubt is created, so the panel can surface it. */
    onPosted?: () => void;
}

/**
 * Bottom composer. Collapsed it is a single primary CTA; expanded it is one
 * bounded card — position chip, editor, then the actions row — instead of the
 * old editor with two large floating icon buttons stacked beside it.
 */
export const DoubtComposer = ({
    open,
    doubt,
    setDoubt,
    onOpen,
    onCancel,
    refetch,
    setShowInput,
    timestamp,
    positionLabel,
    isDocument,
    onEditPosition,
    onPosted,
}: DoubtComposerProps) => {
    const { t } = useTranslation("studyContent");

    return (
        <div className="shrink-0 border-t border-neutral-200 bg-white px-3 py-3 pb-[calc(env(safe-area-inset-bottom)+12px)]"> {/* design-lint-ignore: safe-area viewport math */}
            {open ? (
                <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                        {positionLabel && (
                            <TimestampChip
                                label={positionLabel}
                                isDocument={isDocument}
                                onEdit={onEditPosition}
                            />
                        )}
                        <button
                            type="button"
                            onClick={onCancel}
                            aria-label={t("doubts.discard")}
                            className="ms-auto flex size-7 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
                        >
                            <X size={16} />
                        </button>
                    </div>

                    <MainViewQuillEditor
                        value={doubt}
                        onChange={setDoubt}
                        placeholder={t("doubts.composerPlaceholder")}
                        autoFocus
                        className="overflow-hidden rounded-lg border border-neutral-200 focus-within:border-primary-500"
                        isDoubtResolution={true}
                    />

                    <div className="flex items-center gap-2">
                        <AddDoubt
                            doubtText={doubt}
                            refetch={refetch}
                            setDoubt={setDoubt}
                            setShowInput={setShowInput}
                            timestamp={timestamp}
                            onPosted={onPosted}
                        />
                    </div>
                </div>
            ) : (
                <MyButton
                    scale="large"
                    onClick={onOpen}
                    className="w-full min-w-0 gap-1.5 rounded-lg"
                >
                    <Plus size={16} />
                    {t("doubts.askADoubt")}
                </MyButton>
            )}
        </div>
    );
};
