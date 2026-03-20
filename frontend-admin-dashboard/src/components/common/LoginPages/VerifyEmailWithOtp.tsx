// File: verifyEmailWithOtp.ts
import { createRoot } from 'react-dom/client';
import { MyDialog } from '@/components/design-system/dialog';
import { MyButton } from '@/components/design-system/button';
import { toast } from 'sonner';
import axios from 'axios';
import { REQUEST_OTP, LOGIN_OTP } from '@/constants/urls';
import { useEffect, useRef, useState } from 'react';

// Track root instance to prevent duplicate calls
let otpModalRoot: ReturnType<typeof createRoot> | null = null;

export async function verifyEmailWithOtp(): Promise<string | null> {
    return new Promise((resolve) => {
        let container = document.getElementById('__otp_modal_container');
        if (!container) {
            container = document.createElement('div');
            container.id = '__otp_modal_container';
            document.body.appendChild(container);
        }

        if (!otpModalRoot) {
            otpModalRoot = createRoot(container);
        }

        otpModalRoot.render(<VerifyEmailWithOtpModal resolve={resolve} />);
    });
}

function VerifyEmailWithOtpModal({ resolve }: { resolve: (verifiedEmail: string | null) => void }) {
    const [open, setOpen] = useState(true);
    const [loading, setLoading] = useState(false);
    const [localEmail, setLocalEmail] = useState('');
    const [otpArr, setOtpArr] = useState(Array(6).fill(''));
    const [countdown, setCountdown] = useState(60);
    const [step, setStep] = useState<'email' | 'otp'>('email');
    const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
    const isUnmounted = useRef(false);

    useEffect(() => {
        return () => {
            isUnmounted.current = true;
        };
    }, []);

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (step === 'otp') {
            setCountdown(60);
            interval = setInterval(() => {
                setCountdown((prev) => {
                    if (prev <= 1) {
                        clearInterval(interval);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => clearInterval(interval);
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
            setOtpArr(Array(6).fill(''));
            setTimeout(() => otpRefs.current[0]?.focus(), 100);
        } catch {
            toast.error('Failed to send OTP');
        } finally {
            if (!isUnmounted.current) setLoading(false);
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
            resolve(localEmail); // ✅ Return the email instead of true
            cleanup();
        } catch {
            toast.error('Invalid OTP or verification failed');
        } finally {
            if (!isUnmounted.current) setLoading(false);
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
                const updated = [...otpArr];
                updated[index - 1] = '';
                setOtpArr(updated);
                otpRefs.current[index - 1]?.focus();
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
            otpModalRoot = null;
        }
    };

    return (
        <MyDialog
            open={open}
            onOpenChange={() => {
                setOpen(false);
                resolve(null); // ❌ cancelled
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
                                onKeyDown={(e) => e.key === 'Enter' && sendOtp()}
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
                                className="h-10 min-w-20 self-end whitespace-nowrap rounded bg-primary-500 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-primary-400 active:bg-primary-400 disabled:cursor-not-allowed disabled:bg-primary-300"
                            >
                                {loading ? 'Sending...' : 'Send OTP'}
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
                            Enter OTP
                        </h2>
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
                                    className="h-12 w-10 rounded border border-gray-300 bg-white text-center text-xl text-black dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                                />
                            ))}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
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
                            className="w-full whitespace-nowrap"
                        >
                            {loading ? 'Verifying...' : 'Verify OTP'}
                        </MyButton>
                    </>
                )}
            </div>
        </MyDialog>
    );
}
