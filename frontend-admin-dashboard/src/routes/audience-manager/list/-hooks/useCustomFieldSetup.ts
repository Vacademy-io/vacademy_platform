import { useQuery } from '@tanstack/react-query';
import {
    CustomFieldSetupItem,
    fetchCustomFieldSetup,
} from '../-services/get-custom-field-setup';

export const useCustomFieldSetup = (instituteId?: string) => {
    return useQuery<CustomFieldSetupItem[]>({
        queryKey: ['customFieldSetup', instituteId],
        queryFn: () => fetchCustomFieldSetup(instituteId || ''),
        enabled: Boolean(instituteId),
        staleTime: 5 * 60 * 1000,
    });
};

