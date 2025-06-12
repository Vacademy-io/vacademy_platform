import { useExportSettings } from '../contexts/export-settings-context';
import { cn } from '@/lib/utils';

interface SectionHeaderProps {
    title: string;
    description: string;
    totalMarks: number;
    duration: number;
    showDuration?: boolean;
    showMarks?: boolean;
}

export function SectionHeader({
    title,
    description,
    totalMarks,
    duration,
    showDuration = true,
    showMarks = true,
}: SectionHeaderProps) {
    const { settings } = useExportSettings();
    const { headerSettings } = settings;

    if (!headerSettings.enabled) {
        return (
            <DefaultHeader
                {...{ title, description, totalMarks, duration, showDuration, showMarks }}
            />
        );
    }

    const headerStyle = {
        backgroundColor: headerSettings.style.backgroundColor,
        color: headerSettings.style.textColor,
        borderStyle: headerSettings.style.borderStyle,
        borderWidth: `${headerSettings.style.borderWidth}px`,
        borderColor: headerSettings.style.borderColor,
        padding: `${headerSettings.style.padding}px`,
        gap: `${headerSettings.style.spacing}px`,
    };

    return (
        <div className="mb-4">
            <div className="flex items-center justify-between" style={headerStyle}>
                {headerSettings.logo.visible && headerSettings.logo.position === 'left' && (
                    <img
                        src={headerSettings.logo.url}
                        alt="Logo"
                        style={{ height: `${headerSettings.logo.size}px` }}
                    />
                )}

                {headerSettings.leftSection.visible && (
                    <div
                        className={cn('flex-1')}
                        style={{
                            fontSize: `${headerSettings.leftSection.fontSize}px`,
                            fontWeight: headerSettings.leftSection.fontWeight,
                            fontStyle: headerSettings.leftSection.fontStyle,
                            textAlign: headerSettings.leftSection.textAlign,
                        }}
                    >
                        {headerSettings.leftSection.content.split('\n').map((line, i) => (
                            <div key={i}>{line}</div>
                        ))}
                    </div>
                )}

                {headerSettings.centerSection.visible && (
                    <div
                        className={cn('flex-1')}
                        style={{
                            fontSize: `${headerSettings.centerSection.fontSize}px`,
                            fontWeight: headerSettings.centerSection.fontWeight,
                            fontStyle: headerSettings.centerSection.fontStyle,
                            textAlign: headerSettings.centerSection.textAlign,
                        }}
                    >
                        {headerSettings.centerSection.useSectionName
                            ? title
                            : headerSettings.centerSection.content
                                  .split('\n')
                                  .map((line, i) => <div key={i}>{line}</div>)}
                    </div>
                )}

                {headerSettings.rightSection.visible && (
                    <div
                        className={cn('flex-1')}
                        style={{
                            fontSize: `${headerSettings.rightSection.fontSize}px`,
                            fontWeight: headerSettings.rightSection.fontWeight,
                            fontStyle: headerSettings.rightSection.fontStyle,
                            textAlign: headerSettings.rightSection.textAlign,
                        }}
                    >
                        {headerSettings.rightSection.content.split('\n').map((line, i) => (
                            <div key={i}>{line}</div>
                        ))}
                    </div>
                )}

                {headerSettings.logo.visible && headerSettings.logo.position === 'right' && (
                    <img
                        src={headerSettings.logo.url}
                        alt="Logo"
                        style={{ height: `${headerSettings.logo.size}px` }}
                    />
                )}
            </div>
        </div>
    );
}

function DefaultHeader({
    title,
    description,
    totalMarks,
    duration,
    showDuration,
    showMarks,
}: SectionHeaderProps) {
    return (
        <div className="mb-4 border-b pb-2">
            <h2 className="text-center text-lg font-semibold">{title}</h2>
            <div className="flex items-center justify-between text-sm text-gray-600">
                {showMarks && <div>Marks: {totalMarks}</div>}
                {showDuration && (
                    <div>
                        Duration:{' '}
                        {duration % 60 === 0 ? `${duration / 60} Hrs` : `${duration} Mins`}
                    </div>
                )}
            </div>
            {description && <p className="text-gray-600">{description}</p>}
        </div>
    );
}
