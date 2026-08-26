import { TrashSimple } from "@phosphor-icons/react";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useState } from "react";
import { useAddDoubt } from "../services/AddDoubt";
import { Doubt as DoubtType } from "../types/get-doubts-type";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

export const DeleteDoubt = ({ doubt, refetch }: { doubt: DoubtType; refetch: () => void }) => {
    const { t } = useTranslation("studyContent");
    const [showDeleteDialog, setShowDeleteDialog] = useState<boolean>(false);
    const addDoubt = useAddDoubt();

    const handleDeleteDoubt = () => {
        addDoubt.mutate(
            { ...doubt, status: "DELETED" },
            {
                onSuccess: () => refetch(),
                onError: () => toast.error(t("doubts.errorDeleting")),
            }
        );
        setShowDeleteDialog(false);
    };

    return (
        <>
            <button
                type="button"
                onClick={() => setShowDeleteDialog(true)}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-2xs font-semibold text-neutral-600 transition-colors hover:bg-danger-50 hover:text-danger-600"
            >
                <TrashSimple size={12} />
                {t("doubts.delete")}
            </button>
            <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t("doubts.deleteDialogTitle")}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t("doubts.deleteDialogDescription")}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t("doubts.cancel")}</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteDoubt}
                            className="bg-danger-500 text-white hover:bg-danger-600"
                        >
                            {t("doubts.delete")}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
};
