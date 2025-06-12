import React, { ReactNode, useEffect } from 'react';
import { cn } from '@/lib/utils';
import {
    InputChipsProps,
    FilterChipsProps,
    ChipsProps,
    ChipsWrapperProps,
} from './utils/types/chips-types';
import { PlusCircle, Check } from '@phosphor-icons/react';
import { ActivityStatusData } from './utils/constants/chips-data';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
} from '../ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Separator } from '../ui/separator';
import { ActivityStatus } from './utils/types/chips-types';

const ChipsWrapper = ({ children, className }: ChipsWrapperProps) => {
    return (
        <div
            className={cn(
                'inline-flex h-8 flex-shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg border border-neutral-300 px-3 py-[6px] text-body font-regular text-neutral-600',
                className
            )}
        >
            {children}
        </div>
    );
};

const Chips = ({
    label,
    trailingIcon,
    leadingIcon,
    avatarAddress,
    selected,
    disabled,
    className,
}: ChipsProps) => {
    return (
        <ChipsWrapper
            className={cn(
                avatarAddress ? 'rounded-full' : 'rounded-lg',
                'active:bg-[#f5e6d1]',
                disabled
                    ? 'border-neutral-100'
                    : selected
                      ? 'border-primary-500 bg-primary-100'
                      : 'hover:border-primary-500 hover:bg-primary-50',
                className
            )}
        >
            {leadingIcon &&
                React.createElement(leadingIcon, {
                    className: cn(
                        'size-[18px]',
                        disabled ? 'text-neutral-300' : 'text-neutral-600'
                    ),
                })}

            {avatarAddress && (
                <div className="size-5 overflow-hidden rounded-full">
                    <img src={avatarAddress} className="size-5 object-cover" alt="avatar" />
                </div>
            )}

            {label && (
                <div
                    className={cn(
                        'flex items-center text-[14px] leading-[22px]',
                        disabled ? 'text-neutral-300' : 'text-neutral-600'
                    )}
                >
                    {label}
                </div>
            )}
            {trailingIcon &&
                React.createElement(trailingIcon, {
                    className: cn('size-4', disabled ? 'text-neutral-300' : 'text-neutral-600'),
                })}
        </ChipsWrapper>
    );
};

export const InputChips = (props: InputChipsProps) => {
    return <Chips {...props} />;
};

export const FilterChips = ({
    label,
    filterList,
    selectedFilters,
    disabled,
    clearFilters,
    handleSelect,
    handleClearFilters,
}: FilterChipsProps) => {
    useEffect(() => {
        if (clearFilters) handleClearFilters && handleClearFilters();
    }, [clearFilters]);

    return (
        <Popover>
            <PopoverTrigger className="flex items-center">
                <button>
                    <ChipsWrapper
                        className={cn(
                            disabled
                                ? 'border-neutral-100'
                                : selectedFilters.length > 0
                                  ? 'border-primary-500 bg-primary-100'
                                  : 'hover:border-primary-500 hover:bg-primary-50'
                        )}
                    >
                        <div className="flex items-center gap-2">
                            {React.createElement(PlusCircle, {
                                className: cn(
                                    'size-[18px]',
                                    disabled ? 'text-neutral-300' : 'text-neutral-600'
                                ),
                            })}
                            <div
                                className={cn(
                                    'flex items-center text-[14px] leading-[22px]',
                                    disabled ? 'text-neutral-300' : 'text-neutral-600'
                                )}
                            >
                                {label}{' '}
                            </div>

                            <div
                                className={`${
                                    selectedFilters.length > 0 ? 'visible' : 'hidden'
                                } flex items-center gap-2`}
                            >
                                <Separator
                                    orientation="vertical"
                                    className="mx-2 h-4 bg-neutral-500"
                                />
                                <div
                                    className={`inline-flex items-center rounded-md bg-primary-200 px-2.5 py-0.5 text-caption font-normal ${
                                        selectedFilters.length > 0 ? 'visible' : 'hidden'
                                    }`}
                                >
                                    {selectedFilters.length} selected
                                </div>
                            </div>
                        </div>
                    </ChipsWrapper>
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-0" align="start">
                <Command>
                    <CommandInput placeholder="Search" />
                    <CommandList>
                        <CommandEmpty>filters_no_results_found</CommandEmpty>
                        <CommandGroup>
                            {filterList?.map((option) => (
                                <CommandItem
                                    key={option.id}
                                    onSelect={() => handleSelect && handleSelect(option)}
                                >
                                    <div
                                        className={cn(
                                            'mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-gray-300',
                                            selectedFilters.some((filter) => filter.id == option.id)
                                                ? 'text-base-white border-none bg-primary-300'
                                                : 'opacity-70 [&_svg]:invisible'
                                        )}
                                    >
                                        <Check className={cn('h-4 w-4')} />
                                    </div>
                                    <span>{option.label}</span>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                        {selectedFilters.length > 0 && (
                            <>
                                <CommandSeparator />
                                <CommandGroup>
                                    <CommandItem onSelect={handleClearFilters}>
                                        clear_filters
                                    </CommandItem>
                                </CommandGroup>
                            </>
                        )}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
};

export const StatusChips = ({
    status,
    children,
    className,
    showIcon = true,
}: {
    status: ActivityStatus | 'ACTIVE' | 'TERMINATED' | 'INACTIVE' | 'EVALUATED';
    children?: ReactNode;
    className?: string;
    showIcon?: boolean;
}) => {
    const normalizedStatus =
        status === 'ACTIVE'
            ? 'active'
            : status === 'INACTIVE'
              ? 'inactive'
              : (status as ActivityStatus);

    const statusData = ActivityStatusData[normalizedStatus];
    const StatusIcon = statusData.icon;

    return (
        <ChipsWrapper className={cn(statusData.color.bg, '')}>
            <div className="flex items-center gap-1">
                {showIcon && (
                    <StatusIcon
                        className={cn(statusData.color.icon, 'size-[18px]')}
                        weight="fill"
                    />
                )}
                <div className={cn('text-body capitalize text-neutral-600', className)}>
                    {children ? children : status}
                </div>
            </div>
        </ChipsWrapper>
    );
};
