import { Thunder } from '@/svgs';
import { cn } from '@/lib/utils'; // Assuming cn exists, if not use template literals

const VacademyVoltLogo = ({ className }: { className?: string }) => {
    return (
        <div className={cn('flex items-center gap-x-1', className)}>
            <Thunder className="size-6" />
            <p className="text-lg font-bold text-[#ED7424]">Volt</p>
        </div>
    );
};

export default VacademyVoltLogo;
