/**
 * CaptionSettings Component
 * Popover for customizing caption appearance
 */

import React, { useState, useRef, useEffect } from 'react';
import { Settings } from 'lucide-react';
import { CaptionSettings as CaptionSettingsType, CaptionFontSize } from '../types';

interface CaptionSettingsProps {
    settings: CaptionSettingsType;
    onUpdate: (updates: Partial<CaptionSettingsType>) => void;
}

export const CaptionSettingsPopover: React.FC<CaptionSettingsProps> = ({ settings, onUpdate }) => {
    const [isOpen, setIsOpen] = useState(false);
    const popoverRef = useRef<HTMLDivElement>(null);

    // Close popover when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    return (
        <div ref={popoverRef} style={{ position: 'relative' }}>
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(!isOpen);
                }}
                style={buttonStyle}
                title="Caption Settings"
            >
                <Settings className="size-4 text-white" />
            </button>

            {isOpen && (
                <div
                    style={{
                        position: 'absolute',
                        bottom: '100%',
                        right: 0,
                        marginBottom: '8px',
                        background: 'rgba(30, 30, 30, 0.95)',
                        borderRadius: '8px',
                        padding: '16px',
                        minWidth: '240px',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
                        zIndex: 100,
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <h4 style={headerStyle}>Caption Settings</h4>

                    {/* Position */}
                    <div style={settingRowStyle}>
                        <label style={labelStyle}>Position</label>
                        <div style={buttonGroupStyle}>
                            <OptionButton
                                active={settings.position === 'bottom'}
                                onClick={() => onUpdate({ position: 'bottom' })}
                            >
                                Bottom
                            </OptionButton>
                            <OptionButton
                                active={settings.position === 'top'}
                                onClick={() => onUpdate({ position: 'top' })}
                            >
                                Top
                            </OptionButton>
                        </div>
                    </div>

                    {/* Font Size */}
                    <div style={settingRowStyle}>
                        <label style={labelStyle}>Font Size</label>
                        <div style={buttonGroupStyle}>
                            {(['small', 'medium', 'large'] as CaptionFontSize[]).map((size) => (
                                <OptionButton
                                    key={size}
                                    active={settings.fontSize === size}
                                    onClick={() => onUpdate({ fontSize: size })}
                                >
                                    {size.charAt(0).toUpperCase() + size.slice(1)}
                                </OptionButton>
                            ))}
                        </div>
                    </div>

                    {/* Style */}
                    <div style={settingRowStyle}>
                        <label style={labelStyle}>Style</label>
                        <div style={buttonGroupStyle}>
                            <OptionButton
                                active={settings.style === 'phrase'}
                                onClick={() => onUpdate({ style: 'phrase' })}
                            >
                                Phrase
                            </OptionButton>
                            <OptionButton
                                active={settings.style === 'karaoke'}
                                onClick={() => onUpdate({ style: 'karaoke' })}
                            >
                                Karaoke
                            </OptionButton>
                        </div>
                    </div>

                    {/* Background Opacity */}
                    <div style={settingRowStyle}>
                        <label style={labelStyle}>
                            Background: {Math.round(settings.backgroundOpacity * 100)}%
                        </label>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            value={settings.backgroundOpacity * 100}
                            onChange={(e) =>
                                onUpdate({ backgroundOpacity: Number(e.target.value) / 100 })
                            }
                            style={sliderStyle}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

// Option button component
const OptionButton: React.FC<{
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
}> = ({ active, onClick, children }) => (
    <button
        onClick={onClick}
        style={{
            padding: '4px 10px',
            fontSize: '12px',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            background: active ? '#3b82f6' : 'rgba(255,255,255,0.1)',
            color: active ? '#fff' : 'rgba(255,255,255,0.7)',
            transition: 'all 0.15s ease',
        }}
    >
        {children}
    </button>
);

// Styles
const buttonStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.8,
};

const headerStyle: React.CSSProperties = {
    margin: '0 0 12px 0',
    fontSize: '14px',
    fontWeight: 600,
    color: '#fff',
};

const settingRowStyle: React.CSSProperties = {
    marginBottom: '12px',
};

const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '12px',
    color: 'rgba(255,255,255,0.7)',
    marginBottom: '6px',
};

const buttonGroupStyle: React.CSSProperties = {
    display: 'flex',
    gap: '6px',
};

const sliderStyle: React.CSSProperties = {
    width: '100%',
    height: '4px',
    borderRadius: '2px',
    cursor: 'pointer',
    accentColor: '#3b82f6',
};

export default CaptionSettingsPopover;
