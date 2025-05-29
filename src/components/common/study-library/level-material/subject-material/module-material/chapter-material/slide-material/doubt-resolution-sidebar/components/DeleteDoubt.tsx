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
             <div className="flex gap-1 items-center cursor-pointer" onClick={()=>setShowDeleteDialog(true)}>
                <TrashSimple className="text-danger-500" />
                <p className="text-body">Delete</p>
            </div>
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