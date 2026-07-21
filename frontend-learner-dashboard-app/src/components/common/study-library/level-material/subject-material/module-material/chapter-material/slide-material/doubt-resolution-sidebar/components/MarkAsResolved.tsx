import { Switch } from "@/components/ui/switch"
import { Doubt as DoubtType } from "../types/get-doubts-type";
import { useAddDoubt } from "../services/AddDoubt";
import { useEffect } from "react";
import { useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

export const MarkAsResolved = ({doubt, refetch}: {doubt: DoubtType, refetch: () => void}) => {

    const { t } = useTranslation("studyContent");
    const addDoubt = useAddDoubt();
    const [doubtResolved, setDoubtResolved] = useState<boolean>(doubt.status === "RESOLVED");
    
    useEffect(() => {
        setDoubtResolved(doubt.status === "RESOLVED");
    }, [doubt.status]);

    const handleMarkAsResolved = () => {
        const doubtData: DoubtType = {
            ...doubt,
            status: doubtResolved ? "ACTIVE" : "RESOLVED",
        }
        setDoubtResolved(!doubtResolved);
        addDoubt.mutate(doubtData, {
            onSuccess: () => {
                if (refetch) {
                    refetch()
                }
            },
            onError: () => {
                toast.error(t("doubts.errorResolving"))
            }
        })
        refetch();
    }


    return(
        <div className="flex gap-2 items-center font-semibold ">
            {t("doubts.markAsResolved")} <Switch checked={doubtResolved} onCheckedChange={() => {handleMarkAsResolved()}} className="data-[state=checked]:bg-primary-500" />
        </div>
    )
}