import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Plus, Copy, Trash, Play, Pause, ChartBar } from '@phosphor-icons/react';
import { toast } from 'sonner';
import {
    listChatbotFlows,
    deleteChatbotFlow,
    duplicateChatbotFlow,
    activateChatbotFlow,
    deactivateChatbotFlow,
} from '../-services/chatbot-flow-api';
import { ChatbotFlowDTO } from '@/types/chatbot-flow/chatbot-flow-types';
import { getInstituteId } from '@/constants/helper';
import { SessionViewer } from './session-viewer';

export function FlowListPage() {
    const [flows, setFlows] = useState<ChatbotFlowDTO[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewingSessionsFlow, setViewingSessionsFlow] = useState<ChatbotFlowDTO | null>(null);
    const navigate = useNavigate();
    const instituteId = getInstituteId() || '';

    const loadFlows = async () => {
        try {
            setLoading(true);
            const data = await listChatbotFlows(instituteId);
            setFlows(data);
        } catch (err) {
            toast.error('Failed to load flows');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadFlows();
    }, []);

    const handleCreate = () => {
        navigate({ to: '/automation/chatbot-flows/new' as any });
    };

    const handleEdit = (flowId: string) => {
        navigate({ to: `/automation/chatbot-flows/${flowId}` });
    };

    const handleDuplicate = async (flowId: string) => {
        try {
            await duplicateChatbotFlow(flowId);
            toast.success('Flow duplicated');
            loadFlows();
        } catch {
            toast.error('Failed to duplicate');
        }
    };

    const handleDelete = async (flowId: string) => {
        if (!confirm('Archive this flow?')) return;
        try {
            await deleteChatbotFlow(flowId);
            toast.success('Flow archived');
            loadFlows();
        } catch {
            toast.error('Failed to archive');
        }
    };

    const handleToggleStatus = async (flow: ChatbotFlowDTO) => {
        try {
            if (flow.status === 'ACTIVE') {
                await deactivateChatbotFlow(flow.id!);
                toast.success('Flow deactivated');
            } else {
                await activateChatbotFlow(flow.id!);
                toast.success('Flow activated');
            }
            loadFlows();
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Failed';
            toast.error(msg);
        }
    };

    const statusBadge = (status: string) => {
        const styles: Record<string, string> = {
            ACTIVE: 'bg-green-100 text-green-700',
            DRAFT: 'bg-gray-100 text-gray-600',
            INACTIVE: 'bg-yellow-100 text-yellow-700',
            ARCHIVED: 'bg-red-100 text-red-600',
        };
        return (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles[status] || styles.DRAFT}`}>
                {status}
            </span>
        );
    };

    // If viewing sessions for a flow, render the session viewer
    if (viewingSessionsFlow) {
        return (
            <SessionViewer
                flowId={viewingSessionsFlow.id!}
                flowName={viewingSessionsFlow.name}
                onBack={() => setViewingSessionsFlow(null)}
            />
        );
    }

    return (
        <div className="p-6 max-w-5xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Chatbot Flows</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Create automated WhatsApp conversation flows
                    </p>
                </div>
                <button
                    onClick={handleCreate}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                    <Plus size={18} />
                    New Flow
                </button>
            </div>

            {loading ? (
                <div className="text-center py-12 text-gray-400">Loading...</div>
            ) : flows.length === 0 ? (
                <div className="text-center py-12">
                    <p className="text-gray-400 mb-4">No flows yet. Create your first chatbot flow!</p>
                    <button
                        onClick={handleCreate}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                        Create Flow
                    </button>
                </div>
            ) : (
                <div className="space-y-3">
                    {flows.map((flow) => (
                        <div
                            key={flow.id}
                            onClick={() => handleEdit(flow.id!)}
                            className="flex items-center justify-between p-4 bg-white rounded-lg border hover:border-blue-300 hover:shadow-sm cursor-pointer transition"
                        >
                            <div className="flex-1">
                                <div className="flex items-center gap-2">
                                    <h3 className="font-medium text-gray-800">{flow.name}</h3>
                                    {statusBadge(flow.status)}
                                    <span className="text-xs text-gray-400">{flow.channelType}</span>
                                </div>
                                {flow.description && (
                                    <p className="text-sm text-gray-500 mt-1">{flow.description}</p>
                                )}
                                <p className="text-xs text-gray-400 mt-1">
                                    Updated: {flow.updatedAt ? new Date(flow.updatedAt).toLocaleString() : 'N/A'}
                                </p>
                            </div>
                            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                <button
                                    onClick={() => handleToggleStatus(flow)}
                                    className="p-2 rounded hover:bg-gray-100"
                                    title={flow.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                                >
                                    {flow.status === 'ACTIVE' ? (
                                        <Pause size={16} className="text-yellow-600" />
                                    ) : (
                                        <Play size={16} className="text-green-600" />
                                    )}
                                </button>
                                <button
                                    onClick={() => setViewingSessionsFlow(flow)}
                                    className="p-2 rounded hover:bg-gray-100"
                                    title="Sessions & Analytics"
                                >
                                    <ChartBar size={16} className="text-blue-500" />
                                </button>
                                <button
                                    onClick={() => handleDuplicate(flow.id!)}
                                    className="p-2 rounded hover:bg-gray-100"
                                    title="Duplicate"
                                >
                                    <Copy size={16} className="text-gray-500" />
                                </button>
                                <button
                                    onClick={() => handleDelete(flow.id!)}
                                    className="p-2 rounded hover:bg-gray-100"
                                    title="Archive"
                                >
                                    <Trash size={16} className="text-red-500" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
