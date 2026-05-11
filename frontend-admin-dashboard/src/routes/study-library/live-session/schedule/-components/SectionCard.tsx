import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface SectionCardProps {
    icon: React.ReactNode;
    title: string;
    description?: string;
    children: React.ReactNode;
    /** Optional content to render on the right side of the header (e.g. a badge). */
    headerRight?: React.ReactNode;
    className?: string;
    contentClassName?: string;
}

export const SectionCard = ({
    icon,
    title,
    description,
    children,
    headerRight,
    className,
    contentClassName,
}: SectionCardProps) => (
    <Card className={cn('border-neutral-200 shadow-none', className)}>
        <CardHeader className="flex flex-row items-start gap-3 space-y-0 p-4 pb-3 sm:p-5 sm:pb-3">
            <div className="flex size-8 items-center justify-center rounded-md bg-primary-50 text-primary-500">
                {icon}
            </div>
            <div className="flex-1">
                <CardTitle className="text-sm font-semibold text-neutral-800">{title}</CardTitle>
                {description && (
                    <CardDescription className="mt-0.5 text-xs text-neutral-500">
                        {description}
                    </CardDescription>
                )}
            </div>
            {headerRight}
        </CardHeader>
        <CardContent
            className={cn(
                'border-t border-neutral-100 p-4 pt-4 sm:p-5 sm:pt-5',
                contentClassName
            )}
        >
            {children}
        </CardContent>
    </Card>
);
