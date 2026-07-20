import { Key, Copy, Check, Eye, EyeSlash } from '@phosphor-icons/react';
import { useState } from 'react';
import { DialogContent } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { UserRolesDataEntry } from '@/types/dashboard/user-roles';
import { useStudentCredentails } from '@/services/student-list-section/getStudentCredentails';
import { getDisplaySettingsFromCache } from '@/services/display-settings';
import { getActiveRoleDisplaySettingsKey } from '@/lib/auth/instituteUtils';

// "View Password" shows by default; an admin can hide it per institute from
// Settings → Admin Display Settings by explicitly turning the flag off.
// Shared by the Institute Users and Invites menus.
export const isViewPasswordAllowed = (): boolean => {
    const roleKey = getActiveRoleDisplaySettingsKey();
    const ds = getDisplaySettingsFromCache(roleKey);
    return ds?.teamManagement?.allowViewPassword !== false;
};

interface ViewPasswordComponentProps {
    student: UserRolesDataEntry;
}

// Gated per-member credential reveal. Reuses the same user-agnostic
// /auth-service/v1/user/user-credentials/{userId} endpoint the learner side
// uses, so no student-specific context is required — it works for staff and for
// invited users alike (invites are real User rows with a generated password).
export const ViewPasswordComponent: React.FC<ViewPasswordComponentProps> = ({ student }) => {
    const [showPassword, setShowPassword] = useState(false);
    const [copiedField, setCopiedField] = useState<string>('');

    const { data: credentials, isLoading } = useStudentCredentails({ userId: student.id });

    const username = credentials?.username || student.username || '-';
    const password = credentials?.password || '';

    const handleCopy = async (text: string, fieldName: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedField(fieldName);
            toast.success(`${fieldName} copied to clipboard!`);
            setTimeout(() => setCopiedField(''), 2000);
        } catch {
            toast.error(`Failed to copy ${fieldName}`);
        }
    };

    return (
        <DialogContent className="flex w-96 flex-col p-0">
            <h1 className="flex items-center gap-2 rounded-md bg-primary-50 p-4 text-primary-500">
                <Key size={18} />
                Login Credentials
            </h1>
            <div className="flex flex-col gap-4 px-4 pb-6">
                <div className="text-sm text-neutral-600">
                    Credentials for{' '}
                    <span className="font-medium text-primary-500">{student.full_name}</span>
                </div>

                {/* Username */}
                <div className="flex flex-col gap-1">
                    <span className="text-caption font-medium text-neutral-500">Username</span>
                    <div className="flex items-center justify-between rounded-md border border-neutral-200 px-3 py-2">
                        <span className="text-sm text-neutral-700">
                            {isLoading ? 'Loading...' : username}
                        </span>
                        {!isLoading && username !== '-' && (
                            <button
                                type="button"
                                onClick={() => handleCopy(username, 'Username')}
                                className="text-neutral-400 hover:text-primary-500"
                            >
                                {copiedField === 'Username' ? (
                                    <Check size={16} className="text-success-500" />
                                ) : (
                                    <Copy size={16} />
                                )}
                            </button>
                        )}
                    </div>
                </div>

                {/* Password */}
                <div className="flex flex-col gap-1">
                    <span className="text-caption font-medium text-neutral-500">Password</span>
                    <div className="flex items-center justify-between rounded-md border border-neutral-200 px-3 py-2">
                        <span className="text-sm text-neutral-700">
                            {isLoading
                                ? 'Loading...'
                                : password
                                  ? showPassword
                                      ? password
                                      : '••••••••'
                                  : 'Password not set'}
                        </span>
                        {!isLoading && password && (
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowPassword((prev) => !prev)}
                                    className="text-neutral-400 hover:text-primary-500"
                                >
                                    {showPassword ? <EyeSlash size={16} /> : <Eye size={16} />}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleCopy(password, 'Password')}
                                    className="text-neutral-400 hover:text-primary-500"
                                >
                                    {copiedField === 'Password' ? (
                                        <Check size={16} className="text-success-500" />
                                    ) : (
                                        <Copy size={16} />
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </DialogContent>
    );
};
