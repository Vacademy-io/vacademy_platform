export interface AnalyticsErrorDetails {
    message: string;
    actionRequired: boolean;
    retryable: boolean;
    iconType: 'warning' | 'error' | 'info';
}

export const getAnalyticsErrorDetails = (error: any): AnalyticsErrorDetails => {
    // Handle axios error responses
    if (error?.response?.status) {
        const status = error.response.status;

        switch (status) {
            case 511:
                return {
                    message: 'Authentication required. Please refresh the page or log in again.',
                    actionRequired: true,
                    retryable: false,
                    iconType: 'warning',
                };

            case 401:
                return {
                    message: 'Session expired. Please log in again.',
                    actionRequired: true,
                    retryable: false,
                    iconType: 'warning',
                };

            case 403:
                return {
                    message: "Access denied. You don't have permission to view this data.",
                    actionRequired: true,
                    retryable: false,
                    iconType: 'error',
                };

            case 404:
                return {
                    message: 'Analytics data not found for this institute.',
                    actionRequired: false,
                    retryable: true,
                    iconType: 'info',
                };

            case 429:
                return {
                    message: 'Too many requests. Please wait a moment and try again.',
                    actionRequired: false,
                    retryable: true,
                    iconType: 'warning',
                };

            case 500:
            case 502:
            case 503:
            case 504:
                return {
                    message: "Server temporarily unavailable. We're working on it.",
                    actionRequired: false,
                    retryable: true,
                    iconType: 'error',
                };

            default:
                return {
                    message: `Service error (${status}). Please try again later.`,
                    actionRequired: false,
                    retryable: true,
                    iconType: 'error',
                };
        }
    }

    // Handle network errors
    if (error?.code === 'NETWORK_ERROR' || error?.message?.includes('Network Error')) {
        return {
            message: 'Connection lost. Please check your internet and try again.',
            actionRequired: false,
            retryable: true,
            iconType: 'warning',
        };
    }

    // Handle timeout errors
    if (error?.code === 'ECONNABORTED' || error?.message?.includes('timeout')) {
        return {
            message: 'Request timed out. The server is taking too long to respond.',
            actionRequired: false,
            retryable: true,
            iconType: 'warning',
        };
    }

    // Handle authentication-specific errors from our interceptor
    if (
        error?.message?.includes('authentication required') ||
        error?.message?.includes('log in again')
    ) {
        return {
            message: 'Authentication required. Please refresh the page or log in again.',
            actionRequired: true,
            retryable: false,
            iconType: 'warning',
        };
    }

    // Generic fallback
    return {
        message: 'Unable to load data. Please try again later.',
        actionRequired: false,
        retryable: true,
        iconType: 'error',
    };
};

export const shouldShowRetryButton = (error: any): boolean => {
    const details = getAnalyticsErrorDetails(error);
    return details.retryable && !details.actionRequired;
};

export const getErrorIconColor = (iconType: 'warning' | 'error' | 'info'): string => {
    switch (iconType) {
        case 'warning':
            return 'text-amber-500';
        case 'error':
            return 'text-red-500';
        case 'info':
            return 'text-blue-500';
        default:
            return 'text-gray-500';
    }
};
