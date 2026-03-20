import React, { useState, KeyboardEvent } from 'react';
import { Switch } from '@/components/ui/switch';
interface MultiEmailInputProps {
    value: string[];
    onChange: (emails: string[]) => void;
    placeholder?: string;
    error?: string;
}
import { useAudienceCampaignForm } from '../../../-hooks/useAudienceCampaignForm';

const MultiEmailInput: React.FC<MultiEmailInputProps> = ({
    value,
    onChange,
    placeholder,
    error,
}) => {
    const [input, setInput] = useState('');

    const { form, handleDateChange, handleSubmit, handleReset, isSubmitting } =
        useAudienceCampaignForm();

    const {
        control,
        register,
        watch,
        setValue,
        getValues,
        formState: { errors },
    } = form;

    const isValidEmail = (email: string) => {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    };

    const addEmail = () => {
        const email = input.trim();
        if (email && isValidEmail(email) && !value.includes(email)) {
            onChange([...value, email]);
        }
        setInput('');
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            addEmail();
        }
    };

    const removeEmail = (email: string) => {
        onChange(value.filter((e) => e !== email));
    };

    return (
        <div>
            <div className="flex w-full flex-wrap gap-2   px-3 py-2">
                {value.map((email) => (
                    <span
                        key={email}
                        className="text-primary-700 flex items-center gap-1 rounded-md bg-primary-100 px-2 py-1 text-sm"
                    >
                        {email}
                        <button
                            type="button"
                            onClick={() => removeEmail(email)}
                            className="text-primary-700 font-bold hover:text-red-500"
                        >
                            ×
                        </button>
                    </span>
                ))}

                <input
                    type="text"
                    className="mt-2 w-full rounded-lg border border-neutral-300 px-4 py-2.5 text-sm transition-all focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                    placeholder={'Enter email & press Enter'}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                />


            </div>

            {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
        </div>
    );
};

export default MultiEmailInput;
