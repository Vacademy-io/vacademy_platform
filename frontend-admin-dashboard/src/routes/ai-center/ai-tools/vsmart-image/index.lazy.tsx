import { createLazyFileRoute } from '@tanstack/react-router';
import GenerateAiQuestionFromImageComponent from './-components/GenerateQuestionPaper';
import { AICenterProvider } from '@/routes/ai-center/-contexts/useAICenterContext';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { useEffect } from 'react';
import { CaretLeft } from '@phosphor-icons/react';

export const Route = createLazyFileRoute('/ai-center/ai-tools/vsmart-image/')({
    component: RouteComponent,
});

function RouteComponent() {
    const { setNavHeading } = useNavHeadingStore();

    useEffect(() => {
        const heading = (
            <div className="flex items-center gap-4">
                <CaretLeft onClick={() => window.history.back()} className="cursor-pointer" />
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
