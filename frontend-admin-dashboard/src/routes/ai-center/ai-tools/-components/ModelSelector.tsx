import { useState } from 'react';
import { cn } from '@/lib/utils';
import { CaretDown, Check, Robot, Sparkle, Info } from '@phosphor-icons/react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAIModels } from '../../-hooks/useAIModels';
import { ModelInfo } from '../../-types/ai-models';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea as UIScrollArea } from '@/components/ui/scroll-area';

interface ModelSelectorProps {
    value?: string;
    onChange: (model: string) => void;
    showAdvanced?: boolean;
    disabled?: boolean;
    className?: string;
    label?: string;
}

/**
 * Model Selector Component
 * A premium-looking dropdown for selecting AI models
 */
export const ModelSelector = ({
    value,
    onChange,
    showAdvanced = false,
    disabled = false,
    className,
    label = 'AI Model',
}: ModelSelectorProps) => {
    const [open, setOpen] = useState(false);
    const { availableModels, defaultModel, defaultModelId, isLoading, isError } = useAIModels();

    // Use default if no value selected
    const selectedModelId = value || defaultModelId || '';
    const selectedModel = availableModels.find((m) => m.id === selectedModelId) || defaultModel;

    const handleSelect = (model: ModelInfo) => {
        onChange(model.id);
        setOpen(false);
    };

    const handleUseDefault = () => {
        if (defaultModelId) {
            onChange(defaultModelId);
        }
        setOpen(false);
    };

    if (isLoading) {
        return (
            <div className={cn('flex flex-col gap-2', className)}>
                <span className="text-sm font-medium text-gray-700">{label}</span>
                <Skeleton className="h-10 w-full rounded-lg" />
            </div>
        );
    }

    if (isError) {
        return (
            <div className={cn('flex flex-col gap-2', className)}>
                <span className="text-sm font-medium text-gray-700">{label}</span>
                <div className="flex h-10 items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 text-sm text-red-600">
                    <Info size={16} />
                    <span>Unable to load models</span>
                </div>
            </div>
        );
    }

    return (
        <div className={cn('flex flex-col gap-2', className)}>
            <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700">{label}</span>
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Info
                                size={14}
                                className="cursor-help text-gray-400 transition-colors hover:text-gray-600"
                            />
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-[250px]">
                            <p className="text-xs">
                                Select an AI model for processing. The default model is recommended
                                for most use cases.
                            </p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>

            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <button
                        type="button"
                        disabled={disabled}
                        className={cn(
                            'group flex h-11 w-full items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 transition-all duration-200',
                            'hover:border-primary-300 hover:shadow-sm',
                            'focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100',
                            disabled && 'cursor-not-allowed opacity-50',
                            open && 'border-primary-400 ring-2 ring-primary-100'
                        )}
                    >
                        <div className="flex items-center gap-3">
                            <div
                                className={cn(
                                    'flex h-7 w-7 items-center justify-center rounded-lg transition-colors',
                                    selectedModel?.isDefault
                                        ? 'bg-gradient-to-br from-primary-100 to-primary-200'
                                        : 'bg-gradient-to-br from-amber-100 to-orange-200'
                                )}
                            >
                                {selectedModel?.isDefault ? (
                                    <Sparkle size={16} weight="fill" className="text-primary-600" />
                                ) : (
                                    <Robot size={16} weight="fill" className="text-amber-600" />
                                )}
                            </div>
                            <div className="flex flex-col items-start">
                                <span className="text-sm font-medium text-gray-800">
                                    {selectedModel?.name || 'Select Model'}
                                </span>
                                {selectedModel && (
                                    <span className="text-xs text-gray-500">
                                        {selectedModel.description}
                                    </span>
                                )}
                            </div>
                        </div>
                        <CaretDown
                            size={16}
                            className={cn(
                                'text-gray-400 transition-transform duration-200',
                                open && 'rotate-180'
                            )}
                        />
                    </button>
                </PopoverTrigger>

                <PopoverContent
                    className="w-[var(--radix-popover-trigger-width)] min-w-[320px] rounded-xl border border-gray-200 bg-white p-2 shadow-lg"
                    align="start"
                    sideOffset={8}
                >
                    {/* Default Model Option */}
                    {defaultModel && (
                        <>
                            <button
                                type="button"
                                onClick={handleUseDefault}
                                className={cn(
                                    'group flex w-full items-center gap-3 rounded-lg p-3 text-left transition-all',
                                    'hover:bg-primary-50',
                                    selectedModelId === defaultModelId && 'bg-primary-50'
                                )}
                            >
                                <div className="flex size-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary-100 to-primary-200 shadow-sm">
                                    <Sparkle size={18} weight="fill" className="text-primary-600" />
                                </div>
                                <div className="flex flex-1 flex-col">
                                    <span className="text-sm font-semibold text-gray-800">
                                        Default (Recommended)
                                    </span>
                                    <span className="text-xs text-gray-500">
                                        {defaultModel.name} - {defaultModel.description}
                                    </span>
                                </div>
                                {selectedModelId === defaultModelId && (
                                    <div className="flex size-5 items-center justify-center rounded-full bg-primary-500">
                                        <Check size={12} weight="bold" className="text-white" />
                                    </div>
                                )}
                            </button>
                            <div className="my-2 border-t border-gray-100" />
                        </>
                    )}
                    {/* Available Models */}
                    {showAdvanced && (
                        <div className="mb-2 px-3 pt-1">
                            <span className="text-xs font-medium uppercase tracking-wider text-gray-400">
                                Available Models
                            </span>
                        </div>
                    )}
                    <UIScrollArea className="flex h-[280px] flex-col gap-1">
                        <div className="flex flex-col gap-1 pr-3">
                            {availableModels
                                .filter((model) => showAdvanced || model.id !== defaultModelId)
                                .map((model) => (
                                    <button
                                        key={model.id}
                                        type="button"
                                        onClick={() => handleSelect(model)}
                                        className={cn(
                                            'group flex w-full items-center gap-3 rounded-lg p-3 text-left transition-all',
                                            'hover:bg-gray-50',
                                            selectedModelId === model.id &&
                                                model.id !== defaultModelId &&
                                                'bg-amber-50'
                                        )}
                                    >
                                        <div
                                            className={cn(
                                                'flex h-9 w-9 items-center justify-center rounded-lg shadow-sm transition-colors',
                                                model.id === defaultModelId
                                                    ? 'bg-gradient-to-br from-primary-100 to-primary-200'
                                                    : 'bg-gradient-to-br from-gray-100 to-gray-200 group-hover:from-amber-100 group-hover:to-orange-200'
                                            )}
                                        >
                                            <Robot
                                                size={18}
                                                weight="fill"
                                                className={cn(
                                                    'transition-colors',
                                                    model.id === defaultModelId
                                                        ? 'text-primary-600'
                                                        : 'text-gray-500 group-hover:text-amber-600'
                                                )}
                                            />
                                        </div>
                                        <div className="flex flex-1 flex-col">
                                            <span className="text-sm font-medium text-gray-800">
                                                {model.name}
                                            </span>
                                            <span className="text-xs text-gray-500">
                                                {model.description}
                                            </span>
                                        </div>
                                        {selectedModelId === model.id && (
                                            <div
                                                className={cn(
                                                    'flex h-5 w-5 items-center justify-center rounded-full',
                                                    model.id === defaultModelId
                                                        ? 'bg-primary-500'
                                                        : 'bg-amber-500'
                                                )}
                                            >
                                                <Check
                                                    size={12}
                                                    weight="bold"
                                                    className="text-white"
                                                />
                                            </div>
                                        )}
                                    </button>
                                ))}
                        </div>
                    </UIScrollArea>
                    {/* Footer Info */}
                    <div className="mt-2 border-t border-gray-100 pt-2">
                        <p className="px-3 text-xs text-gray-400">
                            Different models have varying capabilities. The default model works best
                            for most tasks.
                        </p>
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    );
};

export default ModelSelector;
