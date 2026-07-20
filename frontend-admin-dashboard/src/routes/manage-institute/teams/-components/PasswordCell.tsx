import { useState } from 'react';
import { Copy, Check } from '@phosphor-icons/react';
import { toast } from 'sonner';

// Table cell for the Teams "Password" column. Shows the password in plaintext
// directly (no reveal click) with a copy button. Value comes from the
// users-of-status response once deployed, or a live credentials fetch until then.
export const PasswordCell = ({ password }: { password: string | null | undefined }) => {
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
            <span className="text-sm text-neutral-600">{password}</span>
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
