import { useMutation } from "@tanstack/react-query"
import { fetchLast7DaysProgress } from "../-lib/utils"

export const usePastLearningInsights = () => {
    return useMutation({
        mutationFn: fetchLast7DaysProgress
    })
}
