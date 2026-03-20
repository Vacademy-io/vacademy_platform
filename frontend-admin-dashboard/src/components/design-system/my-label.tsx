import * as React from 'react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface MyLabelProps extends React.ComponentPropsWithoutRef<typeof Label> {
    required?: boolean;
}

const MyLabel = React.forwardRef<React.ElementRef<typeof Label>, MyLabelProps>(
    ({ className, children, required, ...props }, ref) => {
        return (
            <Label ref={ref} className={cn('text-subtitle font-regular', className)} {...props}>
                {children}
                {required && <span className="text-red-500">*</span>}
            </Label>
        );
    }
);
MyLabel.displayName = 'MyLabel';

export { MyLabel };
