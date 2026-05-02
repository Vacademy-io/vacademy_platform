import { AlertCircle } from 'lucide-react';

interface Props {
    message?: string;
}

export function InlineErrorState({ message = 'Something went wrong' }: Props) {
    return (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{message}</span>
        </div>
    );
}
