import { useState, useEffect } from 'react';
import { MyButton } from '@/components/design-system/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useNavigate } from '@tanstack/react-router';
import { Eye, EyeOff, User, Lock, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { UPDATE_USER_DETAILS } from '@/constants/urls';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { getUserId, getUserName } from '@/utils/userDetails';
import { removeCookiesAndLogout } from '@/lib/auth/sessionUtility';
import { Dialog, DialogContent } from '@/components/ui/dialog';

// Validation schemas
const accountDetailsSchema = z
    .object({
        username: z
            .string()
            .min(3, 'Username must be at least 3 characters')
            .max(50, 'Username must be less than 50 characters'),
        newPassword: z.string().min(4, 'New password must be at least 4 characters'),
        confirmPassword: z.string().min(1, 'Please confirm your password'),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
        message: "Passwords don't match",
        path: ['confirmPassword'],
    });

type AccountDetailsFormData = z.infer<typeof accountDetailsSchema>;

interface AccountDetailsProps {
    open: boolean;
    setOpen: (open: boolean) => void;
    onClose?: () => void;
}

export default function AccountDetailsEdit({ open, setOpen, onClose }: AccountDetailsProps) {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [userId, setUserId] = useState<string>('');
    const [currentUsername, setCurrentUsername] = useState<string>('');
    const [redirecting, setRedirecting] = useState(false);
    const {
        register,
        handleSubmit,
        formState: { errors },
        setValue,
        watch,
    } = useForm<AccountDetailsFormData>({
        resolver: zodResolver(accountDetailsSchema),
        defaultValues: {
            username: '',
            newPassword: '',
            confirmPassword: '',
        },
    });

    // Watch for password changes to show validation feedback
    const newPassword = watch('newPassword');
    const confirmPassword = watch('confirmPassword');

    const passwordValidations = [
        { label: 'At least 4 characters', valid: newPassword.length >= 4 },
    ];

    const passwordsMatch = newPassword && confirmPassword && newPassword === confirmPassword;

    // Load user details from preferences
    useEffect(() => {
        const loadUserDetails = async () => {
            try {
                const username = getUserName();
                const user_id = getUserId();
                setUserId(user_id || '');
                setCurrentUsername(username || '');
                setValue('username', username || '');
            } catch (error) {
                console.error('Error loading user details:', error);
                toast.error('Failed to load user details');
            }
        };

        loadUserDetails();
    }, [setValue]);

    const handleClose = async () => {
        setRedirecting(true);
        if (onClose) {
            onClose();
        } else {
            navigate({ to: '/dashboard' });
        }
        setRedirecting(false);
    };

    const onSubmit = async (data: AccountDetailsFormData) => {
        if (!userId) {
            toast.error('User ID not found. Please try again.');
            return;
        }

        setIsLoading(true);

        try {
            // Prepare the request payload
            const updatePayload = {
                username: data.username,
                password: data.newPassword,
            };

            // Make API call to update user details
            const response = await authenticatedAxiosInstance.put(
                `${UPDATE_USER_DETAILS}?userId=${userId}`,
                updatePayload
            );

            if (response.status === 200) {
                removeCookiesAndLogout();
                toast.success('Account details updated successfully!');
                handleClose();
            }
        } catch (error: unknown) {
            console.error('Error updating account details:', error);

            // Handle specific error cases
            const axiosError = error as {
                response?: { status?: number; data?: { message?: string } };
            };
            if (axiosError.response?.status === 510) {
                toast.error('Username already exists. Please choose a different username.');
            } else if (axiosError.response?.data?.message) {
                toast.error(axiosError.response.data.message);
            } else {
                toast.error('Failed to update account details. Please try again.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="flex h-4/5 w-1/3 flex-col p-0">
                <h1 className="rounded-t-lg bg-primary-50 p-4 font-semibold text-primary-500">
                    Edit Account Details
                </h1>

                {/* Form Content */}
                <div className="space-y-6 p-4">
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                        {/* Username Section */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                                <User size={16} />
                                <h3>Username</h3>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="username" className="text-sm">
                                    Username*
                                </Label>
                                <Input
                                    id="username"
                                    {...register('username')}
                                    placeholder="Enter your username"
                                    className="h-11 text-sm"
                                    disabled={isLoading}
                                />
                                {errors.username && (
                                    <p className="text-xs text-red-500">
                                        {errors.username.message}
                                    </p>
                                )}
                                {currentUsername && (
                                    <p className="text-xs text-gray-500">
                                        Current: {currentUsername}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Password Section */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                                <Lock size={16} />
                                <h3>Change Password</h3>
                            </div>

                            {/* New Password */}
                            <div className="space-y-2">
                                <Label htmlFor="newPassword" className="text-sm">
                                    New Password*
                                </Label>
                                <div className="relative">
                                    <Input
                                        id="newPassword"
                                        type={showNewPassword ? 'text' : 'password'}
                                        {...register('newPassword')}
                                        placeholder="Enter your new password"
                                        className="h-11 pr-10 text-sm"
                                        disabled={isLoading}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowNewPassword(!showNewPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                    >
                                        {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                                {errors.newPassword && (
                                    <p className="text-xs text-red-500">
                                        {errors.newPassword.message}
                                    </p>
                                )}

                                {/* Password validation indicators */}
                                {newPassword && (
                                    <div className="mt-2 space-y-1">
                                        {passwordValidations.map((validation, index) => (
                                            <div
                                                key={index}
                                                className={`flex items-center gap-1 text-xs ${
                                                    validation.valid
                                                        ? 'text-green-600'
                                                        : 'text-gray-400'
                                                }`}
                                            >
                                                {validation.valid ? (
                                                    <CheckCircle size={12} />
                                                ) : (
                                                    <AlertCircle size={12} />
                                                )}
                                                <span>{validation.label}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Confirm Password */}
                            <div className="space-y-2">
                                <Label htmlFor="confirmPassword" className="text-sm">
                                    Confirm New Password*
                                </Label>
                                <div className="relative">
                                    <Input
                                        id="confirmPassword"
                                        type={showConfirmPassword ? 'text' : 'password'}
                                        {...register('confirmPassword')}
                                        placeholder="Confirm your new password"
                                        className="h-11 pr-10 text-sm"
                                        disabled={isLoading}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                    >
                                        {showConfirmPassword ? (
                                            <EyeOff size={16} />
                                        ) : (
                                            <Eye size={16} />
                                        )}
                                    </button>
                                </div>
                                {errors.confirmPassword && (
                                    <p className="text-xs text-red-500">
                                        {errors.confirmPassword.message}
                                    </p>
                                )}

                                {/* Password match indicator */}
                                {confirmPassword && (
                                    <div
                                        className={`flex items-center gap-1 text-xs ${
                                            passwordsMatch ? 'text-green-600' : 'text-red-500'
                                        }`}
                                    >
                                        {passwordsMatch ? (
                                            <CheckCircle size={12} />
                                        ) : (
                                            <AlertCircle size={12} />
                                        )}
                                        <span>
                                            {passwordsMatch
                                                ? 'Passwords match'
                                                : "Passwords don't match"}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-3 pt-4">
                            <MyButton
                                type="button"
                                scale="medium"
                                buttonType="secondary"
                                layoutVariant="default"
                                className="flex-1"
                                onClick={handleClose}
                                disable={isLoading || redirecting}
                            >
                                {redirecting && (
                                    <Loader2 className="size-10 animate-spin text-primary-500" />
                                )}
                                Cancel
                            </MyButton>
                            <MyButton
                                type="submit"
                                scale="medium"
                                buttonType="primary"
                                layoutVariant="default"
                                className="flex-1"
                                disabled={isLoading}
                            >
                                {isLoading ? 'Updating...' : 'Update Details'}
                            </MyButton>
                        </div>
                    </form>
                </div>
            </DialogContent>
        </Dialog>
    );
}
