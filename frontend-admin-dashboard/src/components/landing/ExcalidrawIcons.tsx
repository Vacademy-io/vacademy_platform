import React from 'react';

export const SelectionIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
        <path d="M7.197 2.404L3.89 3.232a1 1 0 00-.781.976v13.584a1 1 0 00.78.976l3.308.828a1 1 0 001.018-.588l4.47-9.563-3.92-3.92-3.67 7.844" />
        <path d="M12.44 14.15l3.92 3.92 3.67-7.844-3.308-.828a1 1 0 00-1.018.588l-4.47 9.563" />
    </svg>
);

export const RectangleIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
        <rect x="4" y="6" width="16" height="12" rx="1" />
    </svg>
);

export const DiamondIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
        <path d="M12 2l8 10-8 10-8-10z" />
    </svg>
);

export const ArrowIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
        <path d="M5 12h14" />
        <path d="M12 5l7 7-7 7" />
    </svg>
);

export const PencilIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
        <path d="M17 3a2.828 2.828 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
    </svg>
);
