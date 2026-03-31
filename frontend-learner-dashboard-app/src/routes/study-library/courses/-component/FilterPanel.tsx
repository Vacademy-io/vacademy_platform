import React, { useState } from "react";
import { useCatalogStore } from "../-store/catalogStore";
import { useSuspenseQuery } from "@tanstack/react-query";
import { handleFetchInstituteDetails } from "../-services/institute-details";
import { Filter, X } from 'lucide-react';
import { cn, toTitleCase } from "@/lib/utils";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

// Internal reusable component for individual filter sections
interface FilterListProps {
    items: { id: string; name: string }[];
    selectedItems: string[];
    handleChange: (itemId: string) => void;
    disabled?: boolean;
}

const FilterList: React.FC<FilterListProps> = ({
    items,
    selectedItems,
    handleChange,
    disabled,
}) => {
    return (
        <div className="space-y-2">
            {items.length === 0 && !disabled && (
                <div className="text-sm text-muted-foreground py-2 italic">
                    No options available
                </div>
            )}
            {disabled && (
                <div className="text-sm text-muted-foreground py-2 italic">
                    Unavailable
                </div>
            )}
            {items.map((item) => (
                <div key={item.id} className="flex items-center space-x-2">
                    <Checkbox
                        id={item.id}
                        checked={selectedItems.includes(item.id)}
                        onCheckedChange={() => handleChange(item.id)}
                        disabled={disabled}
                    />
                    <Label
                        htmlFor={item.id}
                        className={cn(
                            "text-sm cursor-pointer leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
                            selectedItems.includes(item.id) ? "font-medium text-primary [.ui-vibrant_&]:font-semibold [.ui-play_&]:font-extrabold [.ui-play_&]:text-[#58cc02]" : "font-normal [.ui-play_&]:font-bold"
                        )}
                    >
                        {item.name}
                    </Label>
                </div>
            ))}
        </div>
    );
};

// Props for the entire filter panel
interface FilterPanelProps {
    selectedLevels: string[];
    onLevelChange: (levelId: string) => void;
    selectedTags: string[];
    onTagChange: (tagId: string) => void;
    selectedInstructors: string[];
    onInstructorChange: (instructorId: string) => void;
    clearAllFilters: () => void;
    onApplyFilters: () => void;
    levelsDisabled?: boolean;
    tagsDisabled?: boolean;
    instructorsDisabled?: boolean;
}

const FilterPanel: React.FC<FilterPanelProps> = ({
    selectedLevels,
    onLevelChange,
    selectedTags,
    onTagChange,
    selectedInstructors,
    onInstructorChange,
    clearAllFilters,
    onApplyFilters,
    levelsDisabled = false,
    tagsDisabled = false,
    instructorsDisabled = false,
}) => {
    const instructor = useCatalogStore((state) => state.instructor);

    const { data: instituteData, isLoading } = useSuspenseQuery(
        handleFetchInstituteDetails()
    );

    const hasActiveFilters =
        selectedLevels.length > 0 ||
        selectedTags.length > 0 ||
        selectedInstructors.length > 0;

    const activeFiltersCount = selectedLevels.length + selectedTags.length + selectedInstructors.length;

    type LevelItem = { id: string; level_name?: string };
    const levels = (instituteData?.levels || []).map((level: LevelItem) => ({
        id: level.id,
        name: toTitleCase(level.level_name || "Unnamed Level"),
    }));

    const tags = React.useMemo(() => {
        const uniqueMap = new Map<string, string>();
        (instituteData?.tags || []).forEach((tag: string) => {
            const normalized = tag.toLowerCase();
            if (!uniqueMap.has(normalized)) {
                uniqueMap.set(normalized, toTitleCase(tag));
            }
        });
        return Array.from(uniqueMap.entries()).map(([id, name]) => ({
            id,
            name,
        }));
    }, [instituteData?.tags]);

    type InstructorItem = { id: string; full_name?: string; username?: string };
    const instructors = (instructor || []).map((inst: InstructorItem) => ({
        id: inst.id,
        name: inst.full_name || inst.username || "Unnamed Instructor",
    }));

    if (isLoading) {
        return (
            <div className="bg-card border rounded-lg p-4 shadow-sm space-y-4">
                <div className="flex items-center gap-2">
                    <div className="w-5 h-5 bg-muted rounded animate-pulse"></div>
                    <div className="h-4 bg-muted rounded w-16 animate-pulse"></div>
                </div>
                {[1, 2, 3].map((i) => (
                    <div key={i} className="space-y-2">
                        <div className="h-4 bg-muted rounded w-20 animate-pulse"></div>
                        <div className="space-y-2">
                            {[1, 2, 3].map((j) => (
                                <div key={j} className="flex items-center gap-2">
                                    <div className="w-4 h-4 bg-muted rounded animate-pulse"></div>
                                    <div className="h-4 bg-muted rounded w-24 animate-pulse"></div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    const FilterContent = () => (
        <div className={cn(
            "bg-card border rounded-lg shadow-sm",
            // Vibrant Styles - Flat Pastel
            "[.ui-vibrant_&]:bg-slate-50/50 dark:[.ui-vibrant_&]:bg-slate-900/20",
            "[.ui-vibrant_&]:border-slate-200/50 dark:[.ui-vibrant_&]:border-slate-800/30",
            "[.ui-vibrant_&]:shadow-md",
            // Play Styles — solid, bold, Duolingo-style
            "[.ui-play_&]:bg-[#235390] [.ui-play_&]:border-[#1a3d6d] [.ui-play_&]:rounded-2xl [.ui-play_&]:text-white",
            "[.ui-play_&]:shadow-[0_4px_0_#1a3d6d]"
        )}>
            {/* Desktop Header */}
            <div className={cn(
                "p-4 border-b flex items-center justify-between",
                "[.ui-vibrant_&]:border-primary/10",
                // Play Styles
                "[.ui-play_&]:border-white/20"
            )}>
                <div className="flex items-center gap-2">
                    <Filter size={18} className={cn("text-muted-foreground", "[.ui-vibrant_&]:text-primary", "[.ui-play_&]:text-[#ffc800]")} />
                    <h2 className={cn("text-lg font-semibold", "[.ui-vibrant_&]:text-primary", "[.ui-play_&]:text-white [.ui-play_&]:font-extrabold [.ui-play_&]:uppercase [.ui-play_&]:tracking-wide")}>Filters</h2>
                </div>
                {hasActiveFilters && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearAllFilters}
                        className="h-8 text-xs px-2 text-muted-foreground hover:text-foreground"
                    >
                        <X size={14} className="mr-1" />
                        Clear All
                    </Button>
                )}
            </div>

            {hasActiveFilters && (
                <div className="px-4 py-2 bg-muted/30 border-b">
                    <p className="text-xs text-primary font-medium">
                        {activeFiltersCount} filter(s) applied
                    </p>
                </div>
            )}

            <ScrollArea className="h-[calc(100vh-300px)] min-h-[200px] lg:h-[min(600px,calc(100vh-14rem))] lg:min-h-[240px]">
                <div className="p-4">
                    <Accordion type="multiple" defaultValue={["levels", "tags", "instructors"]} className="w-full">
                        <AccordionItem value="levels" className="border-b-0">
                            <AccordionTrigger className="hover:no-underline py-3">
                                <span className="text-sm font-semibold">Level</span>
                                {selectedLevels.length > 0 && (
                                    <Badge variant="secondary" className="ml-2 text-[10px] h-5 px-1.5">
                                        {selectedLevels.length}
                                    </Badge>
                                )}
                            </AccordionTrigger>
                            <AccordionContent>
                                <FilterList
                                    items={levels}
                                    selectedItems={selectedLevels}
                                    handleChange={onLevelChange}
                                    disabled={levelsDisabled || levels.length === 0}
                                />
                            </AccordionContent>
                        </AccordionItem>

                        <Separator className="my-2" />

                        <AccordionItem value="tags" className="border-b-0">
                            <AccordionTrigger className="hover:no-underline py-3">
                                <span className="text-sm font-semibold">Popular Tags</span>
                                {selectedTags.length > 0 && (
                                    <Badge variant="secondary" className="ml-2 text-[10px] h-5 px-1.5">
                                        {selectedTags.length}
                                    </Badge>
                                )}
                            </AccordionTrigger>
                            <AccordionContent>
                                <FilterList
                                    items={tags}
                                    selectedItems={selectedTags}
                                    handleChange={onTagChange}
                                    disabled={tagsDisabled || tags.length === 0}
                                />
                            </AccordionContent>
                        </AccordionItem>

                        <Separator className="my-2" />

                        <AccordionItem value="instructors" className="border-b-0">
                            <AccordionTrigger className="hover:no-underline py-3">
                                <span className="text-sm font-semibold">Instructors</span>
                                {selectedInstructors.length > 0 && (
                                    <Badge variant="secondary" className="ml-2 text-[10px] h-5 px-1.5">
                                        {selectedInstructors.length}
                                    </Badge>
                                )}
                            </AccordionTrigger>
                            <AccordionContent>
                                <FilterList
                                    items={instructors}
                                    selectedItems={selectedInstructors}
                                    handleChange={onInstructorChange}
                                    disabled={instructorsDisabled || instructors.length === 0}
                                />
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </div>
            </ScrollArea>

            <div className="p-4 border-t bg-muted/20">
                <Button
                    onClick={onApplyFilters}
                    disabled={!hasActiveFilters}
                    className="w-full"
                    size="sm"
                >
                    Apply Filters
                    {hasActiveFilters && (
                        <Badge variant="secondary" className="ml-2 bg-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/30 border-0">
                            {activeFiltersCount}
                        </Badge>
                    )}
                </Button>
            </div>
        </div>
    );

    return (
        <>
            {/* Desktop View */}
            <div className="hidden lg:block sticky top-4">
                <FilterContent />
            </div>

            {/* Mobile View with Sheet */}
            <div className="lg:hidden mb-4">
                <Sheet>
                    <SheetTrigger asChild>
                        <Button
                            variant="outline"
                            className={cn(
                                "w-full justify-between bg-card",
                                // Vibrant Styles
                                "[.ui-vibrant_&]:border-slate-200/50 dark:[.ui-vibrant_&]:border-slate-800/30",
                                "[.ui-vibrant_&]:shadow-sm",
                                "[.ui-vibrant_&]:bg-slate-50/50 dark:[.ui-vibrant_&]:bg-slate-900/20",
                                // Play Styles
                                "[.ui-play_&]:bg-[#58cc02] [.ui-play_&]:text-white [.ui-play_&]:border-[#46a302] [.ui-play_&]:rounded-full [.ui-play_&]:font-bold [.ui-play_&]:uppercase [.ui-play_&]:tracking-wide",
                                "[.ui-play_&]:shadow-[0_4px_0_#46a302] [.ui-play_&]:hover:bg-[#46a302]"
                            )}
                        >
                            <div className="flex items-center gap-2">
                                <Filter size={16} />
                                <span>Filters</span>
                                {hasActiveFilters && (
                                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                                        {activeFiltersCount}
                                    </Badge>
                                )}
                            </div>
                            <span className="text-xs text-muted-foreground mr-1">Show</span>
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="w-[300px] sm:w-[400px] p-0 overflow-hidden flex flex-col">
                        <SheetHeader className="p-4 border-b">
                            <SheetTitle className="text-left flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Filter size={18} />
                                    <span>Filters</span>
                                </div>
                                {hasActiveFilters && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={clearAllFilters}
                                        className="h-8 w-8 text-muted-foreground"
                                        title="Clear All"
                                    >
                                        <X size={16} />
                                    </Button>
                                )}
                            </SheetTitle>
                        </SheetHeader>

                        <div className="flex-1 overflow-auto p-4">
                            <Accordion type="multiple" defaultValue={["levels", "tags"]} className="w-full">
                                <AccordionItem value="levels" className="border-b-0 mb-4">
                                    <h4 className="font-semibold mb-3 text-sm flex items-center justify-between">
                                        Level
                                        {selectedLevels.length > 0 && (
                                            <Badge variant="secondary" className="text-[10px]">{selectedLevels.length}</Badge>
                                        )}
                                    </h4>
                                    <FilterList
                                        items={levels}
                                        selectedItems={selectedLevels}
                                        handleChange={onLevelChange}
                                        disabled={levelsDisabled || levels.length === 0}
                                    />
                                </AccordionItem>

                                <Separator className="my-4" />

                                <AccordionItem value="tags" className="border-b-0 mb-4">
                                    <h4 className="font-semibold mb-3 text-sm flex items-center justify-between">
                                        Tags
                                        {selectedTags.length > 0 && (
                                            <Badge variant="secondary" className="text-[10px]">{selectedTags.length}</Badge>
                                        )}
                                    </h4>
                                    <FilterList
                                        items={tags}
                                        selectedItems={selectedTags}
                                        handleChange={onTagChange}
                                        disabled={tagsDisabled || tags.length === 0}
                                    />
                                </AccordionItem>

                                <Separator className="my-4" />

                                <AccordionItem value="instructors" className="border-b-0">
                                    <h4 className="font-semibold mb-3 text-sm flex items-center justify-between">
                                        Instructors
                                        {selectedInstructors.length > 0 && (
                                            <Badge variant="secondary" className="text-[10px]">{selectedInstructors.length}</Badge>
                                        )}
                                    </h4>
                                    <FilterList
                                        items={instructors}
                                        selectedItems={selectedInstructors}
                                        handleChange={onInstructorChange}
                                        disabled={instructorsDisabled || instructors.length === 0}
                                    />
                                </AccordionItem>
                            </Accordion>
                        </div>

                        <div className="p-4 border-t bg-muted/20">
                            <Button
                                onClick={onApplyFilters}
                                disabled={!hasActiveFilters}
                                className="w-full"
                            >
                                Apply {activeFiltersCount > 0 ? `(${activeFiltersCount})` : ''}
                            </Button>
                        </div>
                    </SheetContent>
                </Sheet>
            </div>
        </>
    );
};

export default FilterPanel;
