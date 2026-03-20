import React from 'react';
import { X } from '@phosphor-icons/react';
import { Input } from './input';
import { Button } from './button';

interface TagInputProps {
    tags: string[];
    onChange: (tags: string[]) => void;
    placeholder?: string;
}

export const TagInput: React.FC<TagInputProps> = ({ tags, onChange, placeholder }) => {
    const [inputValue, setInputValue] = React.useState('');

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && inputValue.trim()) {
            e.preventDefault();
            onChange([...tags, inputValue.trim()]);
            setInputValue('');
        }
    };

    const removeTag = (indexToRemove: number) => {
        onChange(tags.filter((_, index) => index !== indexToRemove));
    };

    return (
        <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
                {tags.map((tag, index) => (
                    <span
                        key={index}
                        className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-900"
                    >
                        {tag}
                        <Button
                            variant="ghost"
                            size="sm"
                            className="size-4 p-0 hover:bg-blue-200"
                            onClick={() => removeTag(index)}
                        >
                            <X className="size-3" />
                        </Button>
                    </span>
                ))}
            </div>
            <Input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                className="mt-2"
            />
        </div>
    );
};
