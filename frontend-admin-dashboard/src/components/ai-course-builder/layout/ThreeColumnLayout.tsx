import React from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import './ThreeColumnLayout.css';

interface ThreeColumnLayoutProps {
    leftPane: React.ReactNode;
    middlePane: React.ReactNode;
    rightPane: React.ReactNode;
    isFullScreen?: boolean;
}

const ThreeColumnLayout: React.FC<ThreeColumnLayoutProps> = ({
    leftPane,
    middlePane,
    rightPane,
    isFullScreen = false,
}) => {
    const [isNarrow, setIsNarrow] = React.useState(false);

    React.useEffect(() => {
        const checkWidth = () => {
            // Check if we're in a narrow container (sidebar open scenario)
            const container = document.querySelector('.panel-group');
            if (container) {
                const width = container.getBoundingClientRect().width;
                setIsNarrow(width < 1100); // Adjust threshold as needed
            }
        };

        checkWidth();
        window.addEventListener('resize', checkWidth);

        // Check width periodically to catch sidebar state changes
        const interval = setInterval(checkWidth, 500);

        return () => {
            window.removeEventListener('resize', checkWidth);
            clearInterval(interval);
        };
    }, []);

    return (
        <PanelGroup
            direction="horizontal"
            className={`panel-group ${isNarrow ? 'narrow-layout' : ''} ${isFullScreen ? 'fullscreen-mode' : ''}`}
        >
            <Panel defaultSize={isNarrow ? 18 : 20} minSize={isNarrow ? 12 : 15}>
                <div className="panel-content">{leftPane}</div>
            </Panel>
            <PanelResizeHandle className="resize-handle" />
            <Panel minSize={25}>
                <div className="panel-content">{middlePane}</div>
            </Panel>
            <PanelResizeHandle className="resize-handle" />
            <Panel defaultSize={isNarrow ? 22 : 25} minSize={isNarrow ? 15 : 20}>
                <div className="panel-content">{rightPane}</div>
            </Panel>
        </PanelGroup>
    );
};

export default ThreeColumnLayout;
