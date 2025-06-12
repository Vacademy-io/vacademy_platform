import { Icon, CheckCircle, XCircle, WarningCircle } from "@phosphor-icons/react";
import { ActivityStatus } from "../types/chips-types";

export const ActivityStatusData: Record<
    ActivityStatus,
    {
        icon: Icon;
        color: {
            bg: string;
            icon: string;
        };
    }
> = {
    Attempted: {
        icon: CheckCircle,
        color: {
            bg: "bg-success-50",
            icon: "text-success-600",
        },
    },
    "Not Attempted": {
        icon: XCircle,
        color: {
            bg: "bg-neutral-100",
            icon: "text-neutral-600",
        },
    },
    active: {
        icon: CheckCircle,
        color: {
            bg: "bg-success-50",
            icon: "text-success-600",
        },
    },
    inactive: {
        icon: XCircle,
        color: {
            bg: "bg-neutral-100",
            icon: "text-neutral-600",
        },
    },
    pending: {
        icon: WarningCircle,
        color: {
            bg: "bg-warning-100",
            icon: "text-warning-600",
        },
    },
    error: {
        icon: XCircle,
        color: {
            bg: "bg-danger-100",
            icon: "text-danger-600",
        },
    },
    LIVE: {
        icon: CheckCircle,
        color: {
            bg: "bg-success-50",
            icon: "text-success-600",
        },
    },
    ENDED: {
        icon: XCircle,
        color: {
            bg: "bg-neutral-100",
            icon: "text-neutral-600",
        },
    },
    PENDING: {
        icon: WarningCircle,
        color: {
            bg: "bg-warning-100",
            icon: "text-warning-600",
        },
    },
    evaluated: {
        icon: CheckCircle,
        color: {
            bg: "bg-success-50",
            icon: "text-success-600",
        },
    },
    evaluating: {
        icon: WarningCircle,
        color: {
            bg: "bg-warning-100",
            icon: "text-warning-600",
        },
    },
};
