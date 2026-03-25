export type WeekDay = {
    label: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
    value: 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun'; // lowercase values
};

export const WEEK_DAYS: WeekDay[] = [
    { label: 'monday', value: 'Mon' },
    { label: 'tuesday', value: 'Tue' },
    { label: 'wednesday', value: 'Wed' },
    { label: 'thursday', value: 'Thu' },
    { label: 'friday', value: 'Fri' },
    { label: 'saturday', value: 'Sat' },
    { label: 'sunday', value: 'Sun' },
];

export type SessionDetails = {
    startTime: string;
    duration: string;
    link?: string;
    linkType: 'auto' | 'manual';
};

export type WeeklyClasses = {
    day: WeekDay;
    sessions: SessionDetails[];
    isSelect: boolean;
};
