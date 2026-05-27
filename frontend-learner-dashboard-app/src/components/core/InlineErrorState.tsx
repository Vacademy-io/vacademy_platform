import { ErrorState } from "@/components/design-system/states";

interface Props {
    message?: string;
    onRetry?: () => void;
}

/**
 * Backwards-compatible wrapper. Delegates to the canonical design-system
 * ErrorState (inline variant) so existing imports keep working while using
 * design tokens + Phosphor icons.
 */
export function InlineErrorState({ message = "Something went wrong", onRetry }: Props) {
    return <ErrorState variant="inline" message={message} onRetry={onRetry} />;
}
