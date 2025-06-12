import { createFileRoute, useNavigate } from "@tanstack/react-router";
import GenerateAiQuestionFromImageComponent from "./-components/GenerateQuestionPaper";
import { AICenterProvider } from "@/routes/ai-center/-contexts/useAICenterContext";
import { LayoutContainer } from "@/components/common/layout-container/layout-container";
import { useNavHeadingStore } from "@/stores/layout-container/useNavHeadingStore";
import { useEffect } from "react";
import { CaretLeft } from "phosphor-react";

export const Route = createFileRoute("/ai-center/ai-tools/vsmart-image/")({
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
                <GenerateAiQuestionFromImageComponent />
            </AICenterProvider>
        </LayoutContainer>
    );
}
