import React from 'react';
import { Badge } from '@/components/ui/badge';
import {
    ConcessionStatus,
    CONCESSION_STATUS_CONFIG,
} from '@/routes/admissions/-types/fee-concession-types';

interface ConcessionBadgeProps {
    status: ConcessionStatus;
}

export function ConcessionBadge({ status }: ConcessionBadgeProps) {
    const config = CONCESSION_STATUS_CONFIG[status];

    return (
        <Badge
            variant="outline"
            className={`${config.bgColor} ${config.color} border-none text-[10px] font-medium`}
        >
            {config.label}
        </Badge>
    );
}
