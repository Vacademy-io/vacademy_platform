import { createFileRoute, useNavigate } from "@tanstack/react-router";
import SortAndSplitTopicQuestions from "./-components/SortAndSplitTopicQuestions";
import { AICenterProvider } from "@/routes/ai-center/-contexts/useAICenterContext";
import { LayoutContainer } from "@/components/common/layout-container/layout-container";
import { useNavHeadingStore } from "@/stores/layout-container/useNavHeadingStore";
import { CaretLeft } from "phosphor-react";
import { useEffect } from "react";
export const Route = createFileRoute("/ai-center/ai-tools/vsmart-organizer/")({
    component: RouteComponent,
});

function RouteComponent() {
    const navigate = useNavigate();
    const { setNavHeading } = useNavHeadingStore();

    useEffect(() => {
        const heading = (
            <div className="flex items-center gap-4">
                <CaretLeft
                    onClick={() => {
                        navigate({
                            to: "/ai-center",
                        });
                    }}
                    className="cursor-pointer"
                />
                <div>VSmart AI Tools</div>
            </div>
        );

        setNavHeading(heading);
    }, []);
    return (
        <LayoutContainer>
            <AICenterProvider>
                <SortAndSplitTopicQuestions />
            </AICenterProvider>
        </LayoutContainer>
    );
}
