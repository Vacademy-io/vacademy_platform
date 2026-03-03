import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { MyButton } from '@/components/design-system/button';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { GET_INSITITUTE_SETTINGS } from '@/constants/urls';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import Counsellor from './Counsellor';

interface SchoolSettingsProps {
    isTab?: boolean;
}

interface CounsellorAllocationData {
    autoAssignEnabled: boolean;
    assignmentStrategy: string;
    counsellorIds: string[];
}

interface SchoolSettingData {
    COUNSELLOR_ALLOCATION_SETTING: {
        key: string;
        name: string;
        data: CounsellorAllocationData;
    };
}

// Fetch school settings
const fetchSchoolSettings = async () => {
    const instituteId = getCurrentInstituteId();
    const response = await authenticatedAxiosInstance({
        method: 'GET',
        url: GET_INSITITUTE_SETTINGS,
        params: {
            instituteId,
            settingKey: 'SCHOOL_SETTING',
        },
    });
    return response.data;
};

// Update school settings - following the same pattern as AI Settings
const updateSchoolSettings = async (settingData: any) => {
    const instituteId = getCurrentInstituteId();

    const response = await authenticatedAxiosInstance.post(
        `${GET_INSITITUTE_SETTINGS.replace('/get', '/save-setting')}`,
        {
            setting_name: 'School Settings',
            setting_data: settingData,
        },
        {
            params: {
                instituteId,
                settingKey: 'SCHOOL_SETTING',
            },
        }
    );
    return response.data;
};

export default function SchoolSettings({ isTab }: SchoolSettingsProps) {
    const queryClient = useQueryClient();

    // Fetch current settings
    const { data: settingsData, isLoading } = useQuery({
        queryKey: ['school-settings'],
        queryFn: fetchSchoolSettings,
        staleTime: 5 * 60 * 1000,
    });

    const [counsellorAllocationData, setCounsellorAllocationData] =
        useState<CounsellorAllocationData>({
            autoAssignEnabled:
                settingsData?.data?.COUNSELLOR_ALLOCATION_SETTING?.data?.autoAssignEnabled ?? true,
            assignmentStrategy:
                settingsData?.data?.COUNSELLOR_ALLOCATION_SETTING?.data?.assignmentStrategy ??
                'round_robin',
            counsellorIds:
                settingsData?.data?.COUNSELLOR_ALLOCATION_SETTING?.data?.counsellorIds ?? [],
        });

    // Update mutation
    const updateMutation = useMutation({
        mutationFn: updateSchoolSettings,
        onSuccess: () => {
            toast.success('School settings updated successfully');
            queryClient.invalidateQueries({ queryKey: ['school-settings'] });
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.message || 'Failed to update settings');
        },
    });

    const handleSave = () => {
        const payload = {
            COUNSELLOR_ALLOCATION_SETTING: {
                key: 'COUNSELLOR_ALLOCATION_SETTING',
                name: 'Counsellor Allocation Settings',
                data: counsellorAllocationData,
            },
        };
        updateMutation.mutate(payload);
    };

    if (isLoading) {
        return <div className="p-4">Loading...</div>;
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">School Settings</CardTitle>
                    <CardDescription>
                        Configure school-wide settings for enquiry management and operations
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <Counsellor
                        data={counsellorAllocationData}
                        onChange={setCounsellorAllocationData}
                    />

                    <div className="flex justify-end gap-3 border-t pt-4">
                        <MyButton
                            buttonType="primary"
                            onClick={handleSave}
                            disabled={updateMutation.isPending}
                        >
                            {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                        </MyButton>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
