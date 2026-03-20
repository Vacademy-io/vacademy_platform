// import { Thunder } from '@/svgs';
import { cn } from '@/lib/utils';

const VacademyVSmartLogo = ({ className }: { className?: string }) => {
    return (
        <div className={cn('flex items-center gap-x-1 pt-2', className)}>
            {/* <Thunder className="size-6" /> */}
            <img src={'/img.png'} alt="vsmart-logo" className="w-24" />
        </div>
    );
};

export default VacademyVSmartLogo;
