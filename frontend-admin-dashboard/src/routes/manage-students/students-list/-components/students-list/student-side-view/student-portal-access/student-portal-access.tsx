import { getActiveRoleDisplaySettingsKey } from '@/lib/auth/instituteUtils';
import { getInstituteId } from '@/constants/helper';
import { hasFacultyAssignedPermission } from '@/lib/auth/facultyAccessUtils';
import { useState, useEffect } from 'react';
import { Key, Shield, MonitorPlay, Envelope, Eye, EyeSlash, Copy, Check } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { MyButton } from '@/components/design-system/button';
import { cn } from '@/lib/utils';
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
import { BatchPicker } from '../BatchPicker';
import {
    ProfileHero,
    ProfileActionBar,
    ProfileSkeleton,
    ProfileEmpty,
} from '../profile-ui';

export const StudentPortalAccess = ({ isSubmissionTab }: { isSubmissionTab?: boolean }) => {
    const { selectedStudent } = useStudentSidebar();
    const { openIndividualShareCredentialsDialog } = useDialogStore();
    const { getDetailsFromPackageSessionId } = useInstituteDetailsStore();
    const [copiedField, setCopiedField] = useState<string>('');
    const [showPassword, setShowPassword] = useState(false);
    const [learnerSettings, setLearnerSettings] = useState<LearnerManagementSettings | null>(null);

    const userId = isSubmissionTab ? selectedStudent?.id : selectedStudent?.user_id;
    const { data: credentials, isLoading: isCredentialsLoading } = useStudentCredentails({
        userId: userId || '',
    });
    const password = credentials?.password || (isCredentialsLoading ? 'Loading...' : 'password not found');

    // For multi-enrollment learners: admin picks which batch's package the portal redirect /
    // reset-password email is scoped to. Defaults to the row's primary (latest) ps_id.
    // Falls back to the legacy single field when the new array isn't populated.
    const enrollmentPsIds: string[] = (selectedStudent?.all_package_session_ids?.length
        ? selectedStudent.all_package_session_ids
        : selectedStudent?.package_session_id
          ? [selectedStudent.package_session_id]
          : []) as string[];
    const [selectedPsId, setSelectedPsId] = useState<string>(enrollmentPsIds[0] ?? '');
    useEffect(() => {
        setSelectedPsId(enrollmentPsIds[0] ?? '');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedStudent?.user_id]);

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

    const handleCopy = async (text: string, fieldName: string, isSecret?: boolean) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedField(fieldName);
            // Never echo secret values (e.g. passwords) in the toast.
            toast.success(isSecret ? 'Copied to clipboard' : `${fieldName} copied to clipboard`);
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

        if (!packageId && selectedPsId) {
            const batchDetails = getDetailsFromPackageSessionId({
                packageSessionId: selectedPsId,
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

        if (!packageId && selectedPsId) {
            const batchDetails = getDetailsFromPackageSessionId({
                packageSessionId: selectedPsId,
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

    // Loading state — credentials query in flight
    if (isCredentialsLoading && learnerSettings?.allowViewPassword) {
        return <ProfileSkeleton blocks={2} />;
    }

    // No settings enabled at all
    const nothingEnabled =
        !learnerSettings?.allowViewPassword &&
        !learnerSettings?.allowPortalAccess &&
        !learnerSettings?.allowSendResetPasswordMail;

    if (nothingEnabled) {
        return (
            <ProfileEmpty
                icon={Shield}
                title="No portal access features enabled"
                hint="Contact admin to enable portal access settings."
            />
        );
    }

    const hasPassword = password && password !== 'password not found';
    const passwordDisplay = showPassword
        ? password
        : hasPassword
          ? '••••••••'
          : password;

    // Password row — rendered inside the hero children slot
    const passwordRow = learnerSettings?.allowViewPassword ? (
        <div className="mt-3 border-t border-neutral-100 pt-3">
            {/* Username copy row */}
            <div className="group flex items-center justify-between gap-3 py-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                    Username
                </span>
                <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-neutral-900">
                        {selectedStudent?.username || 'N/A'}
                    </span>
                    {selectedStudent?.username && (
                        <button
                            type="button"
                            onClick={() => handleCopy(selectedStudent.username!, 'Username')}
                            aria-label="Copy username"
                            className="shrink-0 rounded p-0.5 text-neutral-400 opacity-0 transition hover:bg-neutral-100 hover:text-neutral-600 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 group-hover:opacity-100"
                        >
                            {copiedField === 'Username' ? (
                                <Check className="size-3.5 text-success-600" />
                            ) : (
                                <Copy className="size-3.5" />
                            )}
                        </button>
                    )}
                </div>
            </div>

            {/* Password row — show/hide toggle alongside the copy button */}
            <div className="group flex items-center justify-between gap-3 py-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                    Password
                </span>
                <div className="flex items-center gap-1.5">
                    <span className="font-mono text-sm tracking-wider text-neutral-900">
                        {passwordDisplay}
                    </span>
                    {/* Show / hide toggle */}
                    {hasPassword && (
                        <button
                            type="button"
                            onClick={() => setShowPassword((v) => !v)}
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                            className="shrink-0 rounded p-0.5 text-neutral-400 opacity-0 transition hover:bg-neutral-100 hover:text-neutral-600 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 group-hover:opacity-100"
                        >
                            {showPassword ? (
                                <EyeSlash className="size-3.5" />
                            ) : (
                                <Eye className="size-3.5" />
                            )}
                        </button>
                    )}
                    {/* Copy button — generic toast, never echoes the secret */}
                    {hasPassword && (
                        <button
                            type="button"
                            onClick={() => handleCopy(password, 'Password', true)}
                            aria-label="Copy password"
                            className="shrink-0 rounded p-0.5 text-neutral-400 opacity-0 transition hover:bg-neutral-100 hover:text-neutral-600 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 group-hover:opacity-100"
                        >
                            {copiedField === 'Password' ? (
                                <Check className="size-3.5 text-success-600" />
                            ) : (
                                <Copy className="size-3.5" />
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    ) : null;

    return (
        <div className="flex flex-col gap-3">
            {/* Batch selector first — admin knows which portal context is active */}
            <BatchPicker
                packageSessionIds={enrollmentPsIds}
                value={selectedPsId}
                onChange={setSelectedPsId}
                label="Open portal for"
            />

            {/* Hero: credentials card — this IS the tab's job */}
            <ProfileHero
                eyebrow="LEARNER PORTAL"
                title={
                    <span
                        className={cn(
                            'break-all',
                            !selectedStudent?.username && 'text-neutral-400'
                        )}
                    >
                        {selectedStudent?.username || 'No username'}
                    </span>
                }
                subtitle="Use these credentials to sign in"
                icon={Key}
                tone="primary"
                action={
                    learnerSettings?.allowPortalAccess ? (
                        <MyButton
                            type="button"
                            buttonType="primary"
                            scale="small"
                            disable={false}
                            onAsyncClick={handleAccessPortal}
                        >
                            <MonitorPlay className="size-3.5" />
                            Open Portal
                        </MyButton>
                    ) : undefined
                }
            >
                {passwordRow}
            </ProfileHero>

            {/* Action bar: secondary actions below the hero */}
            {(learnerSettings?.allowViewPassword || learnerSettings?.allowSendResetPasswordMail) && (
                <ProfileActionBar>
                    {learnerSettings?.allowViewPassword && (
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
                        >
                            <Shield className="size-3.5" />
                            Share credentials
                        </MyButton>
                    )}
                    {learnerSettings?.allowSendResetPasswordMail && (
                        <MyButton
                            type="button"
                            buttonType="secondary"
                            scale="small"
                            disable={false}
                            onAsyncClick={handleSendResetPassword}
                        >
                            <Envelope className="size-3.5" />
                            Send reset email
                        </MyButton>
                    )}
                </ProfileActionBar>
            )}
        </div>
    );
};
