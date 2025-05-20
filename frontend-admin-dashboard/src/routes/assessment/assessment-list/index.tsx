import { LayoutContainer } from "@/components/common/layout-container/layout-container";
import { createFileRoute } from "@tanstack/react-router";
import { ScheduleTestMainComponent } from "./-components/ScheduleTestMainComponent";
import { z } from "zod";

export const assessmentListParamsSchema = z.object({
    selectedTab: z.string().optional(),
});

export const Route = createFileRoute("/assessment/assessment-list/")({
    validateSearch: assessmentListParamsSchema,
    component: () => (
        <LayoutContainer>
            <ScheduleTestMainComponent />
        </LayoutContainer>
    ),
});
