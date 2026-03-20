import { CheckCircle, WarningCircle } from '@phosphor-icons/react';

export const StatusIcon = ({ status }: { status: 'done' | 'pending' }) => {
    return (
        <div>
            {status === 'done' && (
                <CheckCircle size={24} weight="fill" className="text-success-600" />
            )}
            {status === 'pending' && (
                <WarningCircle size={24} weight="fill" className="text-warning-500" />
            )}
        </div>
    );
};
