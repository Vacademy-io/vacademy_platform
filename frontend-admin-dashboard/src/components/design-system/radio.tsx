import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ReactElement } from 'react';

interface RadioOption {
    label: string | ReactElement;
    value: string;
}

interface RadioGroupFieldProps {
    options: RadioOption[];
    value: string;
    onChange: (value: string) => void;
    name: string;
    className?: string;
    disabled?: boolean;
    disabledOptions?: string[];
}

export function MyRadioButton({
    options,
    value,
    onChange,
    name,
    className,
    disabled = false,
    disabledOptions = [],
}: RadioGroupFieldProps) {
    return (
        <RadioGroup
            disabled={disabled}
            value={value}
            onValueChange={onChange}
            className={className}
        >
            {options.map((option, index) => {
                const id = `${name}-${index}`;
                const isDisabled = disabled || disabledOptions.includes(option.value);
                return (
                    <div key={id} className="flex items-center space-x-2">
                        <RadioGroupItem disabled={isDisabled} value={option.value} id={id} />
                        <Label
                            htmlFor={id}
                            className={isDisabled ? 'cursor-not-allowed opacity-50' : ''}
                        >
                            {option.label}
                        </Label>
                    </div>
                );
            })}
        </RadioGroup>
    );
}
