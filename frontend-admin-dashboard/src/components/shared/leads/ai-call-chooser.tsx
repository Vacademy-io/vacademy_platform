import { useQuery } from '@tanstack/react-query';
import { Label } from '@/components/ui/label';
import { MyDropdown } from '@/components/design-system/dropdown';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import { useAiAgentOptions } from '@/hooks/use-ai-agent-options';
import { fetchCallOptions } from './services/call-options';

/**
 * Options for an outbound AI call: which agent speaks, and which caller-ID number to
 * dial from. Only shown/needed when the institute has MORE THAN ONE choice — a blank
 * pick means "use the institute default" (agent) / "auto" (number), so leaving it
 * untouched preserves the previous behaviour.
 */
export function useAiCallChooser(userId?: string | null) {
    const instituteId = getCurrentInstituteId() ?? '';
    const { agents, isLoading: agentsLoading } = useAiAgentOptions();
    const numbersQuery = useQuery({
        queryKey: ['ai-call-numbers', instituteId, userId ?? null],
        queryFn: () => fetchCallOptions(instituteId, userId),
        enabled: !!instituteId,
        staleTime: 60_000,
    });
    // Outbound-capable agents only (BOTH agents have no direction / OUTBOUND).
    const outboundAgents = agents.filter((a) => a.direction !== 'INBOUND');
    const numbers = numbersQuery.data?.numbers ?? [];
    return {
        agents: outboundAgents,
        numbers,
        isLoading: agentsLoading || numbersQuery.isLoading,
        showAgentPicker: outboundAgents.length > 1,
        showNumberPicker: numbers.length > 1,
        /** True when the caller should get to pick (more than one agent or number). */
        needsChooser: outboundAgents.length > 1 || numbers.length > 1,
    };
}

const DEFAULT_AGENT_LABEL = 'Default agent';
const AUTO_NUMBER_LABEL = 'Auto (recommended)';

interface AiCallChooserFieldsProps {
    userId?: string | null;
    /** Chosen agent id ('' = default) and setter. */
    agentId: string;
    onAgentChange: (id: string) => void;
    /** Chosen caller number id ('' = auto) and setter. */
    numberId: string;
    onNumberChange: (id: string) => void;
}

/**
 * The agent + caller-number dropdowns for an AI call. Renders nothing when there's only
 * one of each (no choice to make). Each dropdown leads with a "default"/"auto" option.
 */
export function AiCallChooserFields({
    userId,
    agentId,
    onAgentChange,
    numberId,
    onNumberChange,
}: AiCallChooserFieldsProps) {
    const { agents, numbers, showAgentPicker, showNumberPicker } = useAiCallChooser(userId);
    if (!showAgentPicker && !showNumberPicker) return null;

    const agentLabel = agents.find((a) => a.id === agentId)?.name ?? DEFAULT_AGENT_LABEL;
    const chosenNumber = numbers.find((n) => n.id === numberId);
    const numberLabel = chosenNumber
        ? chosenNumber.label
            ? `${chosenNumber.label} · ${chosenNumber.phoneNumber}`
            : chosenNumber.phoneNumber
        : AUTO_NUMBER_LABEL;

    return (
        <div className="flex flex-col gap-3">
            {showAgentPicker && (
                <div className="flex flex-col gap-1">
                    <Label className="text-caption font-medium text-neutral-600">AI agent</Label>
                    <MyDropdown
                        placeholder={DEFAULT_AGENT_LABEL}
                        currentValue={agentLabel}
                        dropdownList={[
                            { label: DEFAULT_AGENT_LABEL, value: '' },
                            ...agents.map((a) => ({ label: a.name, value: a.id })),
                        ]}
                        handleChange={onAgentChange}
                    />
                </div>
            )}
            {showNumberPicker && (
                <div className="flex flex-col gap-1">
                    <Label className="text-caption font-medium text-neutral-600">
                        Call from number
                    </Label>
                    <MyDropdown
                        placeholder={AUTO_NUMBER_LABEL}
                        currentValue={numberLabel}
                        dropdownList={[
                            { label: AUTO_NUMBER_LABEL, value: '' },
                            ...numbers.map((n) => ({
                                label: n.label ? `${n.label} · ${n.phoneNumber}` : n.phoneNumber,
                                value: n.id,
                            })),
                        ]}
                        handleChange={onNumberChange}
                    />
                </div>
            )}
        </div>
    );
}
