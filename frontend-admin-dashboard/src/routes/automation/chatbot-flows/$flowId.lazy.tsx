import { createLazyFileRoute, useParams } from '@tanstack/react-router';
import { useEffect } from 'react';
import { FlowBuilder } from './-components/flow-builder';
import { useChatbotFlowStore } from './-stores/chatbot-flow-store';
import { getChatbotFlow } from './-services/chatbot-flow-api';
import { getInstituteId } from '@/constants/helper';
import { toast } from 'sonner';

export const Route = createLazyFileRoute('/automation/chatbot-flows/$flowId')({
    component: ChatbotFlowBuilderWrapper,
});

function ChatbotFlowBuilderWrapper() {
    const { flowId } = useParams({ from: '/automation/chatbot-flows/$flowId' });
    const loadFlow = useChatbotFlowStore((s) => s.loadFlow);
    const reset = useChatbotFlowStore((s) => s.reset);
    const setInstituteId = useChatbotFlowStore((s) => s.setInstituteId);

    useEffect(() => {
        const instituteId = getInstituteId() || '';

        if (flowId === 'new') {
            reset();
            // Set instituteId AFTER reset (reset clears it to '')
            // Use setTimeout to ensure reset state is committed first
            queueMicrotask(() => setInstituteId(instituteId));
        } else {
            getChatbotFlow(flowId)
                .then((data) => {
                    loadFlow(data);
                })
                .catch((err) => {
                    toast.error('Failed to load flow');
                    console.error(err);
                });
        }

        return () => {
            reset();
        };
    }, [flowId, loadFlow, reset, setInstituteId]);

    return (
        <div className="h-screen flex flex-col">
            <FlowBuilder />
        </div>
    );
}
