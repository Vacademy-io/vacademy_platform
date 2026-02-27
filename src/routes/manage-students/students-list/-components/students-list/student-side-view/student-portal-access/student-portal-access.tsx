import { getActiveRoleDisplaySettingsKey } from '@/lib/auth/instituteUtils';
import { getInstituteId } from '@/constants/helper';
import { hasFacultyAssignedPermission } from '@/lib/auth/facultyAccessUtils';
import { useState, useEffect } from 'react';
import { Key, Copy, Check, Shield, MonitorPlay, Envelope } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { MyButton } from '@/components/design-system/button';
import { useStudentSidebar } from '../../../../-context/selected-student-sidebar-context';
import { useStudentCredentails } from '@/services/student-list-section/getStudentCredentails';
import { useDialogStore } from '@/routes/manage-students/students-list/-hooks/useDialogStore';
import {
    getDisplaySettingsWithFallback,
    getDisplaySettingsFromCache,
} from '@/services/display-settings';
import {
    ADMIN_DISPLAY_SETTINGS_KEY,
    TEACHER_DISPLAY_SETTINGS_KEY, CUSTOM_ROLE_DISPLAY_SETTINGS_KEY,
    type LearnerManagementSettings,
} from '@/types/display-settings';
import { isUserAdmin } from '@/utils/userDetails';
import { getLearnerPortalAccess, sendResetPasswordEmail } from '@/services/learner-portal-access';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';

export const StudentPortalAccess = ({ isSubmissionTab }: { isSubmissionTab?: boolean }) => {
    const { selectedStudent } = useStudentSidebar();
    const { openIndividualShareCredentialsDialog } = useDialogStore();
    const { getDetailsFromPackageSessionId } = useInstituteDetailsStore();
    const [copiedField, setCopiedField] = useState<string>('');
    const [learnerSettings, setLearnerSettings] = useState<LearnerManagementSettings | null>(null);

    const userId = isSubmissionTab ? selectedStudent?.id : selectedStudent?.user_id;
    const { data: credentials, isLoading: isCredentialsLoading } = useStudentCredentails({
        userId: userId || '',
    });
    const password = credentials?.password || (isCredentialsLoading ? 'Loading...' : 'password not found');

    useEffect(() => {
        const fetchLearnerSettings = async () => {
            const isAdmin = isUserAdmin();
            const hasFaculty = hasFacultyAssignedPermission(getInstituteId());
    const roleKey = getActiveRoleDisplaySettingsKey();

            const cachedSettings = getDisplaySettingsFromCache(roleKey);
            const settings =
                cachedSettings?.learnerManagement ||
                (await getDisplaySettingsWithFallback(roleKey)).learnerManagement;

            if (settings) {
                setLearnerSettings(settings);
            }
        };

        fetchLearnerSettings();
    }, []);

    const handleCopy = async (text: string, fieldName: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedField(fieldName);
            toast.success(`${fieldName} copied to clipboard!`);
            setTimeout(() => setCopiedField(''), 2000);
        } catch (error) {
            toast.error(`Failed to copy ${fieldName}`);
        }
    };

    const handleAccessPortal = async () => {
        if (!selectedStudent?.user_id) {
            toast.error('Student user ID not found');
            return;
        }

        // Get packageId from selectedStudent.package_id or derive it from package_session_id
        let packageId = selectedStudent.package_id;

        if (!packageId && selectedStudent.package_session_id) {
            const batchDetails = getDetailsFromPackageSessionId({
                packageSessionId: selectedStudent.package_session_id,
            });
            packageId = batchDetails?.package_dto?.id;
        }

        if (!packageId) {
            toast.error('Student package ID not found');
            return;
        }

        try {
            toast.loading('Accessing learner portal...');
            const response = await getLearnerPortalAccess(
                selectedStudent.user_id,
                packageId
            );

            if (response.redirect_url) {
                // Open the redirect URL in a new tab
                window.open(response.redirect_url, '_blank', 'noopener,noreferrer');
                toast.success('Learner portal opened in new tab');
            } else {
                toast.error('No redirect URL received');
            }
        } catch (error) {
            console.error('Error accessing learner portal:', error);
            toast.error('Failed to access learner portal. Please try again.');
        } finally {
            toast.dismiss();
        }
    };

    const handleSendResetPassword = async () => {
        if (!selectedStudent?.user_id) {
            toast.error('Student user ID not found');
            return;
        }

        // Get packageId from selectedStudent.package_id or derive it from package_session_id
        let packageId = selectedStudent.package_id;

        if (!packageId && selectedStudent.package_session_id) {
            const batchDetails = getDetailsFromPackageSessionId({
                packageSessionId: selectedStudent.package_session_id,
            });
            packageId = batchDetails?.package_dto?.id;
        }

        if (!packageId) {
            toast.error('Student package ID not found');
            return;
        }

        try {
            toast.loading('Sending reset password email...');
            await sendResetPasswordEmail(selectedStudent.user_id, packageId);
            toast.success('Reset password email sent successfully');
        } catch (error) {
            console.error('Error sending reset password email:', error);
            toast.error('Failed to send reset password email. Please try again.');
        } finally {
            toast.dismiss();
        }
    };

    return (
        <div className="space-y-4">
            {/* Account Credentials Section */}
            {learnerSettings?.allowViewPassword && (
                <div className="group rounded-lg border border-neutral-200/50 bg-gradient-to-br from-white to-primary-50/30 p-3 transition-all duration-200 hover:scale-[1.01] hover:border-primary-200/50 hover:shadow-md">
                    <div className="mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="rounded-md bg-gradient-to-br from-primary-50 to-primary-100 p-1 transition-transform duration-200 group-hover:scale-105">
                                <Key className="size-3.5 text-primary-600" />
                            </div>
                            <h3 className="group-hover:text-primary-700 text-xs font-semibold text-neutral-700 transition-colors duration-200">
                                Account Credentials
                            </h3>
                        </div>

                        <MyButton
                            type="button"
                            buttonType="secondary"
                            scale="small"
                            disable={false}
                            onClick={() => {
                                if (selectedStudent) {
                                    openIndividualShareCredentialsDialog(selectedStudent);
                                }
                            }}
                            className="h-auto min-h-0 cursor-pointer px-2 py-1 text-[10px]"
                            style={{ pointerEvents: 'auto', zIndex: 10 }}
                        >
                            <Shield className="mr-1 size-2.5" />
                            Share
                        </MyButton>
                    </div>

                    <div className="space-y-1">
                        {/* Username */}
                        <div className="flex items-start gap-2 rounded-md px-1.5 py-1">
                            <div className="mt-1.5 size-1 shrink-0 rounded-full bg-neutral-300"></div>
                            <div className="min-w-0 flex-1 text-xs leading-relaxed text-neutral-700">
                                <span className="font-medium text-neutral-600">Username: </span>
                                <span className="group/value relative inline-flex items-center text-neutral-800">
                                    <span>{selectedStudent?.username || 'N/A'}</span>
                                    {selectedStudent?.username && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                selectedStudent.username &&
                                                    handleCopy(
                                                        selectedStudent.username,
                                                        'Username'
                                                    );
                                            }}
                                            className="ml-2 cursor-pointer rounded-md p-1 hover:bg-neutral-200"
                                            style={{ pointerEvents: 'auto' }}
                                        >
                                            {copiedField === 'Username' ? (
                                                <Check className="size-3 text-green-600" />
                                            ) : (
                                                <Copy className="size-3 text-neutral-500 hover:text-neutral-700" />
                                            )}
                                        </button>
                                    )}
                                </span>
                            </div>
                        </div>

                        {/* Password */}
                        <div className="flex items-start gap-2 rounded-md px-1.5 py-1">
                            <div className="mt-1.5 size-1 shrink-0 rounded-full bg-neutral-300"></div>
                            <div className="min-w-0 flex-1 text-xs leading-relaxed text-neutral-700">
                                <span className="font-medium text-neutral-600">Password: </span>
                                <span className="group/value relative inline-flex items-center text-neutral-800">
                                    <span>{password}</span>
                                    {password && password !== 'password not found' && (
                                        <button
                                            type="button"
                                            onClick={() => handleCopy(password, 'Password')}
                                            className="ml-2 cursor-pointer rounded-md p-1 hover:bg-neutral-200"
                                            style={{ pointerEvents: 'auto' }}
                                        >
                                            {copiedField === 'Password' ? (
                                                <Check className="size-3 text-green-600" />
                                            ) : (
                                                <Copy className="size-3 text-neutral-500 hover:text-neutral-700" />
                                            )}
                                        </button>
                                    )}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Action Buttons Section */}
            <div className="space-y-2">
                {learnerSettings?.allowPortalAccess && (
                    <div className="rounded-lg border border-neutral-200/50 bg-gradient-to-br from-white to-blue-50/30 p-3 transition-all duration-200 hover:border-blue-200/50 hover:shadow-md">
                        <div className="mb-2 flex items-center gap-2">
                            <div className="rounded-md bg-gradient-to-br from-blue-50 to-blue-100 p-1.5">
                                <MonitorPlay className="size-4 text-blue-600" />
                            </div>
                            <div className="flex-1">
                                <h4 className="text-xs font-medium text-neutral-700">
                                    Learner Portal
                                </h4>
                                <p className="text-[10px] text-neutral-500">
                                    Access learner portal directly
                                </p>
                            </div>
                        </div>
                        <MyButton
                            type="button"
                            buttonType="primary"
                            scale="small"
                            disable={false}
                            onClick={handleAccessPortal}
                            className="w-full cursor-pointer text-xs"
                            style={{ pointerEvents: 'auto', zIndex: 10 }}
                        >
                            <MonitorPlay className="mr-1.5 size-3.5" />
                            Access Learner Portal
                        </MyButton>
                    </div>
                )}

                {learnerSettings?.allowSendResetPasswordMail && (
                    <div className="rounded-lg border border-neutral-200/50 bg-gradient-to-br from-white to-green-50/30 p-3 transition-all duration-200 hover:border-green-200/50 hover:shadow-md">
                        <div className="mb-2 flex items-center gap-2">
                            <div className="rounded-md bg-gradient-to-br from-green-50 to-green-100 p-1.5">
                                <Envelope className="size-4 text-green-600" />
                            </div>
                            <div className="flex-1">
                                <h4 className="text-xs font-medium text-neutral-700">
                                    Reset Password
                                </h4>
                                <p className="text-[10px] text-neutral-500">
                                    Send password reset email
                                </p>
                            </div>
                        </div>
                        <MyButton
                            type="button"
                            buttonType="secondary"
                            scale="small"
                            disable={false}
                            onClick={handleSendResetPassword}
                            className="w-full cursor-pointer border-green-200 text-xs text-green-700 hover:border-green-300 hover:bg-green-50"
                            style={{ pointerEvents: 'auto', zIndex: 10 }}
                        >
                            <Envelope className="mr-1.5 size-3.5" />
                            Send Reset Password Email
                        </MyButton>
                    </div>
                )}
            </div>

            {/* Info when no settings enabled */}
            {!learnerSettings?.allowViewPassword &&
                !learnerSettings?.allowPortalAccess &&
                !learnerSettings?.allowSendResetPasswordMail && (
                    <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-neutral-200 bg-neutral-50/50 py-12">
                        <Shield className="mb-2 size-8 text-neutral-400" />
                        <p className="text-sm text-neutral-500">
                            No portal access features enabled
                        </p>
                        <p className="text-xs text-neutral-400">
                            Contact admin to enable portal access settings
                        </p>
                    </div>
                )}
        </div>
    );
};
