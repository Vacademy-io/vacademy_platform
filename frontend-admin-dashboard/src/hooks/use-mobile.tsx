import * as React from 'react';

const MOBILE_BREAKPOINT = 768;
const TABLET_BREAKPOINT = 1024;

export function useIsMobile() {
    const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

    React.useEffect(() => {
        const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
        const onChange = () => {
            setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
        };
        mql.addEventListener('change', onChange);
        setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
        return () => mql.removeEventListener('change', onChange);
    }, []);

    return !!isMobile;
}

export function useIsTablet() {
    const [isTablet, setIsTablet] = React.useState<boolean | undefined>(undefined);

    React.useEffect(() => {
        const onChange = () => {
            const width = window.innerWidth;
            setIsTablet(width >= MOBILE_BREAKPOINT && width < TABLET_BREAKPOINT);
        };
        const mql = window.matchMedia(
            `(min-width: ${MOBILE_BREAKPOINT}px) and (max-width: ${TABLET_BREAKPOINT - 1}px)`
        );
        mql.addEventListener('change', onChange);
        onChange();
        return () => mql.removeEventListener('change', onChange);
    }, []);

    return !!isTablet;
}

export function useBreakpoint() {
    const [breakpoint, setBreakpoint] = React.useState<'mobile' | 'tablet' | 'desktop'>('desktop');

    React.useEffect(() => {
        const onChange = () => {
            const width = window.innerWidth;
            if (width < MOBILE_BREAKPOINT) {
                setBreakpoint('mobile');
            } else if (width < TABLET_BREAKPOINT) {
                setBreakpoint('tablet');
            } else {
                setBreakpoint('desktop');
            }
        };
        window.addEventListener('resize', onChange);
        onChange();
        return () => window.removeEventListener('resize', onChange);
    }, []);

    return breakpoint;
}

export { MOBILE_BREAKPOINT, TABLET_BREAKPOINT };
