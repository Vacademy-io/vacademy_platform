import { useState } from 'react';
import { Copy, Check, Eye, EyeSlash } from '@phosphor-icons/react';
import { toast } from 'sonner';

// Table cell for the gated Teams "Password" column. Masked by default with a
// per-row reveal toggle + copy, so credentials aren't shoulder-surfable at a
// glance. The password value comes from the authenticated users-of-status
// response (see UserService.toUserWithRolesDtoWithPassword on the backend).
export const PasswordCell = ({ password }: { password: string | null | undefined }) => {
    const [showPassword, setShowPassword] = useState(false);
    const [copied, setCopied] = useState(false);

    if (!password) {
        return <div className="text-sm text-neutral-400">-</div>;
    }

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(password);
            setCopied(true);
            toast.success('Password copied to clipboard!');
            setTimeout(() => setCopied(false), 2000);
        } catch {
            toast.error('Failed to copy password');
        }
    };

    return (
        <div className="flex items-center gap-2">
            <span className="text-sm text-neutral-600">
                {showPassword ? password : '••••••••'}
            </span>
            <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="text-neutral-400 hover:text-primary-500"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
                {showPassword ? <EyeSlash size={16} /> : <Eye size={16} />}
            </button>
            <button
                type="button"
                onClick={handleCopy}
                className="text-neutral-400 hover:text-primary-500"
                aria-label="Copy password"
            >
                {copied ? <Check size={16} className="text-success-500" /> : <Copy size={16} />}
            </button>
        </div>
    );
};
