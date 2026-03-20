import { useState, useEffect } from 'react';
import { getSelectedInstitute, setSelectedInstitute, clearSelectedInstitute, getInstituteSelectionResult, getUserRoleForInstitute } from '@/lib/auth/instituteUtils';

export const useInstitute = () => {
    const [currentInstituteId, setCurrentInstituteId] = useState<string | undefined>(undefined);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Load the selected institute from localStorage on mount
        const instituteId = getSelectedInstitute();
        setCurrentInstituteId(instituteId);
        setIsLoading(false);
    }, []);

    const selectInstitute = (instituteId: string) => {
        setSelectedInstitute(instituteId);
        setCurrentInstituteId(instituteId);
    };

    const clearInstitute = () => {
        clearSelectedInstitute();
        setCurrentInstituteId(undefined);
    };

    const getCurrentInstituteRole = () => {
        if (!currentInstituteId) return null;
        return getUserRoleForInstitute(currentInstituteId);
    };

    const getInstituteSelectionStatus = () => {
        return getInstituteSelectionResult();
    };

    return {
        currentInstituteId,
        isLoading,
        selectInstitute,
        clearInstitute,
        getCurrentInstituteRole,
        getInstituteSelectionStatus,
    };
};
