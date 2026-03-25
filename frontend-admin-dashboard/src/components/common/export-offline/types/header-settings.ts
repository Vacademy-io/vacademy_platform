export type FontWeight = 'normal' | 'bold' | 'lighter';
export type FontStyle = 'normal' | 'italic';
export type TextAlignment = 'left' | 'center' | 'right';
export type BorderStyle = 'none' | 'solid' | 'dashed' | 'dotted' | 'double';
export type LogoPosition = 'left' | 'right';

interface TextSectionSettings {
    visible: boolean;
    content: string;
    fontSize: number;
    fontWeight: FontWeight;
    fontStyle: FontStyle;
    textAlign: TextAlignment;
}

interface LogoSettings {
    visible: boolean;
    url: string;
    position: LogoPosition;
    size: number;
    showInstitutionLogo: boolean;
}

export interface HeaderSettings {
    enabled: boolean;
    onEachPage: boolean;
    leftSection: TextSectionSettings;
    centerSection: TextSectionSettings & {
        useSectionName: boolean;
    };
    rightSection: TextSectionSettings;
    logo: LogoSettings;
    style: {
        backgroundColor: string;
        textColor: string;
        borderStyle: BorderStyle;
        borderWidth: number;
        borderColor: string;
        padding: number;
        spacing: number;
    };
}

export const defaultHeaderSettings: HeaderSettings = {
    enabled: false,
    onEachPage: false,
    leftSection: {
        visible: false,
        content: '',
        fontSize: 14,
        fontWeight: 'normal',
        fontStyle: 'normal',
        textAlign: 'left',
    },
    centerSection: {
        visible: true,
        content: '',
        useSectionName: false,
        fontSize: 24,
        fontWeight: 'bold',
        fontStyle: 'normal',
        textAlign: 'center',
    },
    rightSection: {
        visible: false,
        content: '',
        fontSize: 14,
        fontWeight: 'normal',
        fontStyle: 'normal',
        textAlign: 'right',
    },
    logo: {
        visible: false,
        url: '',
        position: 'left',
        size: 60,
        showInstitutionLogo: false,
    },
    style: {
        backgroundColor: '#ffffff',
        textColor: '#000000',
        borderStyle: 'solid',
        borderWidth: 1,
        borderColor: '#e5e7eb',
        padding: 16,
        spacing: 16,
    },
};
