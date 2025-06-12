import { cn } from '@/lib/utils';
import { useTheme } from '@/providers/theme/theme-provider';
import ClipLoader from 'react-spinners/ClipLoader';
import themeData from '@/constants/themes/theme.json';

export function DashboardLoader({
    height = '100vh',
    size = 40,
    color = '#ED7424',
    className = '',
}: {
    height?: string;
    size?: number;
    color?: string;
    className?: string;
}) {
    const { primaryColor } = useTheme();
    const loaderColor =
        themeData.themes.find((color) => color.code === primaryColor)?.colors['primary-500'] ||
        color;
    return (
        <div
            className={cn(`flex flex-col items-center justify-center`, className)}
            style={{ height }}
        >
            <ClipLoader size={size} color={loaderColor} />
        </div>
    );
}
