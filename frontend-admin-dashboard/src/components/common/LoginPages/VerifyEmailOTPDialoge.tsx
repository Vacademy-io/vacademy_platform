import React, { useState, useEffect, useRef } from 'react';
import { MyDialog } from '@/components/design-system/dialog';
import { MyButton } from '@/components/design-system/button';
import axios from 'axios';
import { toast } from 'sonner';
import { REQUEST_OTP, LOGIN_OTP } from '@/constants/urls';

const VerifyEmailOTPDialoge = () => {
    const [open, setOpen] = useState(true);
    const [loading, setLoading] = useState(false);
    const [localEmail, setLocalEmail] = useState('');
    const [otpArr, setOtpArr] = useState(Array(6).fill(''));
    const [countdown, setCountdown] = useState(60);
    const [step, setStep] = useState<'email' | 'otp'>('email');
    const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

    useEffect(() => {
        let interval: NodeJS.Timeout | null = null;
        if (step === 'otp' && countdown === 60) {
            interval = setInterval(() => {
                setCountdown((prev) => {
                    if (prev <= 1) {
                        if (interval) clearInterval(interval);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [step]);

    const sendOtp = async () => {
        if (!localEmail || !/\S+@\S+\.\S+/.test(localEmail)) {
            toast.error('Enter a valid email address');
            return;
        }

        try {
            setLoading(true);
            await axios.post(REQUEST_OTP, {
                to: localEmail,
                name: 'Vacademy user!!!',
                service: 'auth-service',
            });
            toast.success('OTP sent to email');
            setStep('otp');
            setCountdown(60);
        } catch {
            toast.error('Failed to send OTP');
        } finally {
            setLoading(false);
        }
    };

    const verifyOtp = async () => {
        const finalOtp = otpArr.join('');
        if (finalOtp.length !== 6) {
            toast.error('Enter full 6-digit OTP');
            return;
        }

        try {
            setLoading(true);
            await axios.post(LOGIN_OTP, {
                to: localEmail,
                otp: finalOtp,
            });
            toast.success('Email verified successfully');
            setOpen(false);
            cleanup();
        } catch {
            toast.error('Invalid OTP or verification failed');
        } finally {
            setLoading(false);
        }
    };

    const handleOtpChange = (value: string, index: number) => {
        const cleanVal = value.replace(/\D/, '');
        const updated = [...otpArr];
        updated[index] = cleanVal;
        setOtpArr(updated);
        if (cleanVal && index < 5) otpRefs.current[index + 1]?.focus();
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
        if (e.key === 'Backspace') {
            if (!otpArr[index] && index > 0) {
                otpRefs.current[index - 1]?.focus();
                const updated = [...otpArr];
                updated[index - 1] = '';
                setOtpArr(updated);
            }
        }
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
        e.preventDefault();
        const paste = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        if (paste) {
            const updated = paste.padEnd(6, '').split('');
            setOtpArr(updated);
            updated.forEach((val, i) => {
                if (val) otpRefs.current[i]?.focus();
            });
        }
    };

    const cleanup = () => {
        const container = document.getElementById('__otp_modal_container');
        if (container) {
            container.remove();
        }
    };

    return (
        <div>
            <MyDialog
                open={open}
                onOpenChange={() => {
                    setOpen(false);
                    cleanup();
                }}
                heading={step === 'email' ? 'Email Verification' : 'OTP Verification'}
                content={undefined}
                footer={undefined}
                dialogWidth="max-w-md"
                isTour={false}
                dialogId="otp-verification-dialog"
                className="rounded-xl bg-white shadow-xl dark:bg-gray-900"
            >
                <div className="space-y-4 p-6 text-center">
                    {step === 'email' ? (
                        <div className="flex items-end gap-3">
                            <div className="w-full text-left">
                                <label
                                    htmlFor="email-input"
                                    className="mb-1 block font-medium text-gray-700 dark:text-white"
                                >
                                    Email
                                </label>
                                <input
                                    type="email"
                                    id="email-input"
                                    value={localEmail}
                                    onChange={(e) => setLocalEmail(e.target.value)}
                                    placeholder="you@example.com"
                                    required
                                    autoFocus
                                    disabled={loading}
                                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                                />
                            </div>
                            <div>
                                <button
                                    onClick={sendOtp}
                                    disabled={loading || !localEmail}
                                    className={`h-10 min-w-20 self-end rounded bg-primary-500 px-4 text-xs font-semibold text-white transition-colors hover:bg-primary-400 active:bg-primary-400 disabled:cursor-not-allowed disabled:bg-primary-300`}
                                >
                                    {loading ? 'Sending...' : 'Send OTP'}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <h2 className="text-xl font-semibold">Enter OTP</h2>
                            <div className="flex justify-center gap-2">
                                {otpArr.map((val, idx) => (
                                    <input
                                        key={idx}
                                        ref={(el) => (otpRefs.current[idx] = el)}
                                        type="text"
                                        maxLength={1}
                                        value={val}
                                        onChange={(e) => handleOtpChange(e.target.value, idx)}
                                        onKeyDown={(e) => handleKeyDown(e, idx)}
                                        onPaste={handlePaste}
                                        className="h-12 w-10 rounded border text-center text-xl"
                                    />
                                ))}
                            </div>
                            <div className="text-sm text-gray-500">
                                {countdown > 0 ? (
                                    `Resend OTP in ${countdown}s`
                                ) : (
                                    <button
                                        className="text-blue-500 underline"
                                        onClick={sendOtp}
                                        disabled={loading}
                                    >
                                        Resend OTP
                                    </button>
                                )}
                            </div>
                            <MyButton
                                buttonType="primary"
                                scale="large"
                                onClick={verifyOtp}
                                disabled={loading}
                                className="w-full"
                            >
                                {loading ? 'Verifying...' : 'Verify OTP'}
                            </MyButton>
                        </>
                    )}
                </div>
            </MyDialog>
        </div>
    );
};

export default VerifyEmailOTPDialoge;
