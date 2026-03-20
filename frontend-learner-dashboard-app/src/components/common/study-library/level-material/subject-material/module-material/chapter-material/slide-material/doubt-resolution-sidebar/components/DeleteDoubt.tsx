import { TrashSimple } from "@phosphor-icons/react"
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

export const DeleteDoubt = ({doubt, refetch}: {doubt: DoubtType, refetch: () => void}) => {
    const [showDeleteDialog, setShowDeleteDialog] = useState<boolean>(false);
    const addDoubt = useAddDoubt();

    const handleDeleteDoubt = () => {
        const doubtData: DoubtType = {
            ...doubt,
            status: "DELETED",
        }

        addDoubt.mutate(doubtData, {
            onSuccess: () => {
                if (refetch) {
                    refetch()
                }
            },
            onError: () => {
                toast.error("Error deleting doubt")
            }
        })
        setShowDeleteDialog(false);
        refetch();
    }

    return(
        <>
            <button 
                onClick={() => setShowDeleteDialog(true)}
                className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all duration-200 border border-red-200/60 hover:border-red-300 group"
            >
                <TrashSimple size={16} className="text-red-500 group-hover:text-red-600 transition-colors" />
                <span className="font-medium">Delete</span>
            </button>
            <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Doubt</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete this doubt? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteDoubt} className="bg-danger-500 text-white">
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}