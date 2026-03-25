import React, { useState, useEffect } from 'react';
import { ChevronRightIcon, FolderIcon, FileIcon, SlideIcon } from '../common/icons/icons';
import { Plus, Trash2 } from 'lucide-react';
import type { Slide } from './courseData';

interface TreeItemProps {
    label: string;
    isFolder?: boolean;
    children?: React.ReactNode;
    level?: number;
    slide?: Slide;
    itemType?: 'course' | 'slideGroup' | 'subject' | 'module' | 'chapter' | 'slide';
    isSelected?: boolean;
    onSelect?: () => void;
    slideCount?: number;
    completedSlides?: number;
    // Controls for global expand/collapse
    expandAll?: boolean;
    expandSignal?: number; // incremented each time parent toggles expandAll
    onAdd?: () => void; // add new child handler
    onDelete?: () => void; // delete handler
    customAddButton?: React.ReactNode; // custom add button for specific items like chapters
    // Animation and highlighting props
    isNewlyAdded?: boolean;
    isAnimating?: boolean;
    itemPath?: string;
}

export const TreeItem: React.FC<TreeItemProps> = ({
    label,
    isFolder,
    children,
    level = 0,
    slide,
    itemType = 'slide',
    isSelected = false,
    onSelect,
    slideCount,
    completedSlides = 0,
    expandAll = false,
    expandSignal = 0,
    onAdd,
    onDelete,
    customAddButton,
    isNewlyAdded = false,
    isAnimating = false,
    itemPath,
}) => {
    const [isOpen, setIsOpen] = useState<boolean>(expandAll || level <= 1);

    // When parent toggles expandAll, sync state
    const lastSignalRef = React.useRef<number>(expandSignal);
    useEffect(() => {
        if (expandSignal !== lastSignalRef.current) {
            lastSignalRef.current = expandSignal;
            setIsOpen(expandAll);
        }
    }, [expandSignal, expandAll]);

    const handleToggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isFolder) {
            setIsOpen(!isOpen);
        }
    };

    const handleSelect = () => {
        onSelect?.();
    };

    const getIndentStyle = () => {
        const baseIndent = 8;
        const indentPerLevel = 12;
        return {
            paddingLeft: `${baseIndent + level * indentPerLevel}px`,
        };
    };

    const getBadgeText = () => {
        if (slide) {
            return slide.type.substring(0, 3).toUpperCase();
        }
        if (itemType === 'module' && slideCount) {
            return `${completedSlides}/${slideCount}`;
        }
        if (itemType === 'chapter' && slideCount) {
            return slideCount.toString();
        }
        return null;
    };

    const getBadgeClass = () => {
        if (slide) {
            return slide.type;
        }
        return '';
    };

    const getProgressPercentage = () => {
        if (slideCount && slideCount > 0) {
            return Math.max(3, (completedSlides / slideCount) * 100);
        }
        return 0;
    };

    const itemClasses = [
        'tree-item',
        itemType,
        isSelected ? 'selected' : '',
        isNewlyAdded ? 'newly-added' : '',
        isAnimating ? 'animating-in' : '',
    ]
        .filter(Boolean)
        .join(' ');

    const truncateLabel = (text: string) => {
        const maxLength = itemType === 'slide' ? 25 : 30;
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength - 2) + '..';
    };

    return (
        <>
            <div
                className={itemClasses}
                style={getIndentStyle()}
                onClick={handleSelect}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleSelect();
                    } else if (e.key === 'ArrowRight' && isFolder && !isOpen) {
                        e.preventDefault();
                        setIsOpen(true);
                    } else if (e.key === 'ArrowLeft' && isFolder && isOpen) {
                        e.preventDefault();
                        setIsOpen(false);
                    }
                }}
            >
                <span className="tree-item-icon" onClick={handleToggle}>
                    {isFolder && (
                        <span className={`chevron ${isOpen ? 'open' : ''}`}>
                            <ChevronRightIcon />
                        </span>
                    )}
                    {isFolder ? (
                        <FolderIcon isOpen={isOpen} />
                    ) : slide ? (
                        <SlideIcon type={slide.type} />
                    ) : (
                        <FileIcon />
                    )}
                </span>

                <span
                    className="tree-item-label"
                    title={label}
                    style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                    {truncateLabel(label)}
                    {isFolder && itemType !== 'slide' && customAddButton ? (
                        <span
                            className="tree-item-add"
                            onClick={(e) => {
                                e.stopPropagation();
                            }}
                        >
                            {customAddButton}
                        </span>
                    ) : (
                        isFolder &&
                        itemType !== 'slide' && (
                            <span
                                className="tree-item-add"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onAdd?.();
                                }}
                                title="Add"
                            >
                                <Plus className="size-3 text-green-600" />
                            </span>
                        )
                    )}

                    {isFolder && itemType !== 'slide' && onDelete && (
                        <span
                            className="tree-item-delete"
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete?.();
                            }}
                            title="Delete"
                        >
                            <Trash2 className="size-3 text-red-500" />
                        </span>
                    )}
                </span>

                {getBadgeText() && (
                    <span className={`tree-item-badge ${getBadgeClass()}`}>{getBadgeText()}</span>
                )}

                {itemType === 'module' && slideCount && slideCount > 0 && (
                    <div
                        className="module-progress"
                        title={`${Math.round(getProgressPercentage())}% complete`}
                    >
                        <div
                            className="module-progress-fill"
                            style={{ width: `${getProgressPercentage()}%` }}
                        />
                    </div>
                )}
            </div>

            {isFolder && isOpen && children && <div className="tree-item-children">{children}</div>}
        </>
    );
};
