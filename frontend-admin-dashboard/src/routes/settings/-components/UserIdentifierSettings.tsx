import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { MyButton } from '@/components/design-system/button';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { GET_INSITITUTE_SETTINGS } from '@/constants/urls';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';

const SAVE_SETTING_URL = GET_INSITITUTE_SETTINGS.replace('/get', '/save-setting');
const SETTING_KEY = 'USER_IDENTIFIER';

type UserIdentifier = 'EMAIL' | 'PHONE';

const fetchUserIdentifierSetting = async (): Promise<UserIdentifier> => {
    const instituteId = getCurrentInstituteId();
    const response = await authenticatedAxiosInstance({
        method: 'GET',
        url: GET_INSITITUTE_SETTINGS,
        params: { instituteId, settingKey: SETTING_KEY },
    });
    // response.data is SettingDto; .data is the stored value string
    const val = response.data?.data;
    return val === 'PHONE' ? 'PHONE' : 'EMAIL';
};

const saveUserIdentifierSetting = async (identifier: UserIdentifier): Promise<void> => {
    const instituteId = getCurrentInstituteId();
    await authenticatedAxiosInstance.post(
        SAVE_SETTING_URL,
        { setting_name: 'User Identifier Setting', setting_data: identifier },
        { params: { instituteId, settingKey: SETTING_KEY } },
    );
};

export default function UserIdentifierSettings() {
    const queryClient = useQueryClient();

    const { data: savedIdentifier, isLoading } = useQuery({
        queryKey: ['user-identifier-setting'],
        queryFn: fetchUserIdentifierSetting,
        staleTime: 5 * 60 * 1000,
    });

    const [selected, setSelected] = useState<UserIdentifier>('EMAIL');

    useEffect(() => {
        if (savedIdentifier) setSelected(savedIdentifier);
    }, [savedIdentifier]);

    const mutation = useMutation({
        mutationFn: saveUserIdentifierSetting,
        onSuccess: () => {
            toast.success('User identifier setting saved successfully');
            queryClient.invalidateQueries({ queryKey: ['user-identifier-setting'] });
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.message || 'Failed to save setting');
        },
    });

    if (isLoading) return <div className="p-4">Loading...</div>;

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg">User Identifier Setting</CardTitle>
                <CardDescription>
                    Choose how users are uniquely identified when registering or logging in to your
                    institute. This affects how duplicate accounts are detected during enrollment.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <RadioGroup
                    value={selected}
                    onValueChange={(val) => setSelected(val as UserIdentifier)}
                    className="space-y-4"
                >
                    <div className="flex items-start gap-3 rounded-lg border p-4">
                        <RadioGroupItem value="EMAIL" id="identifier-email" className="mt-0.5" />
                        <div className="space-y-1">
                            <Label htmlFor="identifier-email" className="cursor-pointer font-semibold">
                                Email Address
                            </Label>
                            <p className="text-sm text-muted-foreground">
                                Users are identified by their email. Two users with the same email are
                                treated as the same person across enrollments.
                            </p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3 rounded-lg border p-4">
                        <RadioGroupItem value="PHONE" id="identifier-phone" className="mt-0.5" />
                        <div className="space-y-1">
                            <Label htmlFor="identifier-phone" className="cursor-pointer font-semibold">
                                Phone Number
                            </Label>
                            <p className="text-sm text-muted-foreground">
                                Users are identified by their mobile number. Use this when learners
                                register without email or when phone is the primary login method for your
                                institute.
                            </p>
                        </div>
                    </div>
                </RadioGroup>

                <div className="flex justify-end border-t pt-4">
                    <MyButton
                        buttonType="primary"
                        onClick={() => mutation.mutate(selected)}
                        disabled={mutation.isPending}
                    >
                        {mutation.isPending ? 'Saving...' : 'Save Changes'}
                    </MyButton>
                </div>
            </CardContent>
        </Card>
    );
}
