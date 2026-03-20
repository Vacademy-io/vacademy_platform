import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus, Trash, Copy, Warning, FileText } from '@phosphor-icons/react';
import {
    BulkCourseItem,
    CourseType,
    LevelOption,
    SessionOption,
    ValidationError,
    BatchConfig,
} from '../-types/bulk-create-types';
import { BatchSelectorDialog } from './batch-selector-dialog';
import { CourseContentDialog } from './course-content-dialog';
import { cn } from '@/lib/utils';

interface BulkCreateTableProps {
    courses: BulkCourseItem[];
    levels: LevelOption[];
    sessions: SessionOption[];
    validationErrors: ValidationError[];
    onAddCourse: () => void;
    onRemoveCourse: (id: string) => void;
    onDuplicateCourse: (id: string) => void;
    onUpdateCourse: (id: string, updates: Partial<BulkCourseItem>) => void;
    onAddLevel: (name: string) => Promise<LevelOption>;
    onAddSession: (name: string) => Promise<SessionOption>;
    getErrorsForCourse: (courseId: string) => ValidationError[];
}

const COURSE_TYPES: { value: CourseType; label: string }[] = [
    { value: 'COURSE', label: 'Course' },
    { value: 'MEMBERSHIP', label: 'Membership' },
    { value: 'PRODUCT', label: 'Product' },
    { value: 'SERVICE', label: 'Service' },
];

export function BulkCreateTable({
    courses,
    levels,
    sessions,
    validationErrors,
    onAddCourse,
    onRemoveCourse,
    onDuplicateCourse,
    onUpdateCourse,
    onAddLevel,
    onAddSession,
    getErrorsForCourse,
}: BulkCreateTableProps) {
    const [batchDialogOpen, setBatchDialogOpen] = useState(false);
    const [contentDialogOpen, setContentDialogOpen] = useState(false);
    const [activeCourseId, setActiveCourseId] = useState<string | null>(null);
    const [tagInputs, setTagInputs] = useState<Record<string, string>>({});

    const handleOpenBatchDialog = (courseId: string) => {
        setActiveCourseId(courseId);
        setBatchDialogOpen(true);
    };

    const handleOpenContentDialog = (courseId: string) => {
        setActiveCourseId(courseId);
        setContentDialogOpen(true);
    };

    const handleBatchSelect = (batch: BatchConfig) => {
        if (!activeCourseId) return;
        const course = courses.find((c) => c.id === activeCourseId);
        if (course) {
            onUpdateCourse(activeCourseId, {
                batches: [...course.batches, batch],
            });
        }
        setBatchDialogOpen(false);
    };

    const handleRemoveBatch = (courseId: string, batchIndex: number) => {
        const course = courses.find((c) => c.id === courseId);
        if (course) {
            const newBatches = [...course.batches];
            newBatches.splice(batchIndex, 1);
            onUpdateCourse(courseId, { batches: newBatches });
        }
    };

    const handleAddTag = (courseId: string) => {
        const tagInput = tagInputs[courseId]?.trim();
        if (!tagInput) return;

        const course = courses.find((c) => c.id === courseId);
        if (course && !course.tags.includes(tagInput)) {
            onUpdateCourse(courseId, { tags: [...course.tags, tagInput] });
        }
        setTagInputs((prev) => ({ ...prev, [courseId]: '' }));
    };

    const handleRemoveTag = (courseId: string, tag: string) => {
        const course = courses.find((c) => c.id === courseId);
        if (course) {
            onUpdateCourse(courseId, { tags: course.tags.filter((t) => t !== tag) });
        }
    };

    const activeCourse = courses.find((c) => c.id === activeCourseId);

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-neutral-800">
                    Courses ({courses.length})
                </h3>
                <Button onClick={onAddCourse} size="sm" className="h-8">
                    <Plus className="mr-1 size-4" />
                    Add Course
                </Button>
            </div>

            <div className="overflow-x-auto rounded-lg border border-neutral-200">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-neutral-50">
                            <TableHead className="w-10 text-center text-xs">#</TableHead>
                            <TableHead className="min-w-[200px] text-xs">Course Name *</TableHead>
                            <TableHead className="w-[120px] text-xs">Type</TableHead>
                            <TableHead className="min-w-[280px] text-xs">
                                Batches (with Payment)
                            </TableHead>
                            <TableHead className="min-w-[150px] text-xs">Tags</TableHead>
                            <TableHead className="w-[100px] text-xs">Content</TableHead>
                            <TableHead className="w-[80px] text-center text-xs">Publish</TableHead>
                            <TableHead className="w-[100px] text-center text-xs">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {courses.map((course, index) => {
                            const rowErrors = getErrorsForCourse(course.id);
                            const hasErrors = rowErrors.length > 0;

                            return (
                                <TableRow
                                    key={course.id}
                                    className={cn('transition-colors', hasErrors && 'bg-red-50/50')}
                                >
                                    {/* Row Number */}
                                    <TableCell className="text-center">
                                        <div className="flex items-center justify-center">
                                            {hasErrors ? (
                                                <TooltipProvider>
                                                    <Tooltip>
                                                        <TooltipTrigger>
                                                            <Warning className="size-4 text-red-500" />
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            <ul className="text-xs">
                                                                {rowErrors.map((e, i) => (
                                                                    <li key={i}>{e.message}</li>
                                                                ))}
                                                            </ul>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            ) : (
                                                <span className="text-xs text-neutral-500">
                                                    {index + 1}
                                                </span>
                                            )}
                                        </div>
                                    </TableCell>

                                    {/* Course Name */}
                                    <TableCell>
                                        <Input
                                            value={course.course_name}
                                            onChange={(e) =>
                                                onUpdateCourse(course.id, {
                                                    course_name: e.target.value,
                                                })
                                            }
                                            placeholder="Enter course name"
                                            className={cn(
                                                'h-8 text-sm',
                                                rowErrors.some((e) => e.field === 'course_name') &&
                                                    'border-red-300 focus:border-red-500'
                                            )}
                                        />
                                    </TableCell>

                                    {/* Course Type */}
                                    <TableCell>
                                        <Select
                                            value={course.course_type}
                                            onValueChange={(value: CourseType) =>
                                                onUpdateCourse(course.id, { course_type: value })
                                            }
                                        >
                                            <SelectTrigger className="h-8 text-xs">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {COURSE_TYPES.map((type) => (
                                                    <SelectItem key={type.value} value={type.value}>
                                                        {type.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </TableCell>

                                    {/* Batches (with Payment) */}
                                    <TableCell>
                                        <div className="flex flex-wrap items-center gap-1">
                                            {course.batches.length === 0 ? (
                                                <span className="text-xs text-neutral-400">
                                                    Using defaults
                                                </span>
                                            ) : (
                                                course.batches.slice(0, 2).map((batch, bIdx) => (
                                                    <TooltipProvider key={bIdx}>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Badge
                                                                    variant="secondary"
                                                                    className="cursor-help text-[10px]"
                                                                >
                                                                    {batch.level_name}/
                                                                    {batch.session_name}
                                                                    {batch.payment_config?.price && (
                                                                        <span className="ml-1 text-green-600">
                                                                            ₹
                                                                            {
                                                                                batch.payment_config
                                                                                    .price
                                                                            }
                                                                        </span>
                                                                    )}
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleRemoveBatch(
                                                                                course.id,
                                                                                bIdx
                                                                            );
                                                                        }}
                                                                        className="ml-1 hover:text-red-500"
                                                                    >
                                                                        ×
                                                                    </button>
                                                                </Badge>
                                                            </TooltipTrigger>
                                                            <TooltipContent>
                                                                <div className="text-xs">
                                                                    <p>
                                                                        <strong>
                                                                            {batch.level_name} /{' '}
                                                                            {batch.session_name}
                                                                        </strong>
                                                                    </p>
                                                                    {batch.payment_config && (
                                                                        <>
                                                                            <p>
                                                                                Type:{' '}
                                                                                {
                                                                                    batch
                                                                                        .payment_config
                                                                                        .payment_type
                                                                                }
                                                                            </p>
                                                                            {batch.payment_config
                                                                                .price && (
                                                                                <p>
                                                                                    Price: ₹
                                                                                    {
                                                                                        batch
                                                                                            .payment_config
                                                                                            .price
                                                                                    }
                                                                                </p>
                                                                            )}
                                                                        </>
                                                                    )}
                                                                    {batch.inventory_config
                                                                        ?.max_slots && (
                                                                        <p>
                                                                            Slots:{' '}
                                                                            {
                                                                                batch.inventory_config
                                                                                    .max_slots
                                                                            }
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                ))
                                            )}
                                            {course.batches.length > 2 && (
                                                <Badge variant="outline" className="text-[10px]">
                                                    +{course.batches.length - 2}
                                                </Badge>
                                            )}
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="size-6 p-0"
                                                onClick={() => handleOpenBatchDialog(course.id)}
                                            >
                                                <Plus className="size-3" />
                                            </Button>
                                        </div>
                                    </TableCell>

                                    {/* Tags */}
                                    <TableCell>
                                        <div className="flex flex-wrap items-center gap-1">
                                            {course.tags.slice(0, 2).map((tag) => (
                                                <Badge
                                                    key={tag}
                                                    variant="outline"
                                                    className="text-[10px]"
                                                >
                                                    {tag}
                                                    <button
                                                        onClick={() =>
                                                            handleRemoveTag(course.id, tag)
                                                        }
                                                        className="ml-1 hover:text-red-500"
                                                    >
                                                        ×
                                                    </button>
                                                </Badge>
                                            ))}
                                            {course.tags.length > 2 && (
                                                <Badge variant="outline" className="text-[10px]">
                                                    +{course.tags.length - 2}
                                                </Badge>
                                            )}
                                            <div className="flex items-center">
                                                <Input
                                                    value={tagInputs[course.id] || ''}
                                                    onChange={(e) =>
                                                        setTagInputs((prev) => ({
                                                            ...prev,
                                                            [course.id]: e.target.value,
                                                        }))
                                                    }
                                                    onKeyDown={(e) =>
                                                        e.key === 'Enter' && handleAddTag(course.id)
                                                    }
                                                    placeholder="Tag"
                                                    className="h-6 w-16 text-[10px]"
                                                />
                                            </div>
                                        </div>
                                    </TableCell>

                                    {/* Content & Media */}
                                    <TableCell>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-auto w-full justify-start gap-2 px-2 py-1.5 text-left text-xs"
                                            onClick={() => handleOpenContentDialog(course.id)}
                                        >
                                            <FileText className="size-3.5 shrink-0" />
                                            <div className="flex flex-col items-start">
                                                {course.why_learn_html ||
                                                course.about_the_course_html ||
                                                course.thumbnail_file_id ||
                                                course.course_banner_media_id ? (
                                                    <>
                                                        <span className="text-[10px] text-green-600">
                                                            Configured
                                                        </span>
                                                        <span className="text-[9px] text-neutral-400">
                                                            Click to edit
                                                        </span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <span className="text-[10px] text-neutral-500">
                                                            Not set
                                                        </span>
                                                        <span className="text-[9px] text-neutral-400">
                                                            Click to add
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                        </Button>
                                    </TableCell>

                                    {/* Publish */}
                                    <TableCell className="text-center">
                                        <Switch
                                            checked={course.publish_to_catalogue}
                                            onCheckedChange={(checked) =>
                                                onUpdateCourse(course.id, {
                                                    publish_to_catalogue: checked,
                                                })
                                            }
                                        />
                                    </TableCell>

                                    {/* Actions */}
                                    <TableCell>
                                        <div className="flex items-center justify-center gap-1">
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="size-7 p-0"
                                                            onClick={() =>
                                                                onDuplicateCourse(course.id)
                                                            }
                                                        >
                                                            <Copy className="size-3.5" />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>Duplicate</TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="size-7 p-0 text-red-500 hover:bg-red-50 hover:text-red-600"
                                                            onClick={() =>
                                                                onRemoveCourse(course.id)
                                                            }
                                                            disabled={courses.length <= 1}
                                                        >
                                                            <Trash className="size-3.5" />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>Delete</TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>

            {/* Add More Button */}
            <div className="flex justify-center">
                <Button variant="outline" onClick={onAddCourse} className="w-full max-w-xs">
                    <Plus className="mr-2 size-4" />
                    Add Another Course
                </Button>
            </div>

            {/* Batch Selector Dialog */}
            <BatchSelectorDialog
                open={batchDialogOpen}
                onOpenChange={setBatchDialogOpen}
                levels={levels}
                sessions={sessions}
                onAddLevel={onAddLevel}
                onAddSession={onAddSession}
                onSelect={handleBatchSelect}
                existingBatches={activeCourse?.batches || []}
            />

            {/* Course Content Dialog */}
            {activeCourse && (
                <CourseContentDialog
                    open={contentDialogOpen}
                    onOpenChange={setContentDialogOpen}
                    courseName={activeCourse.course_name || 'Untitled Course'}
                    initialData={{
                        why_learn_html: activeCourse.why_learn_html,
                        who_should_learn_html: activeCourse.who_should_learn_html,
                        about_the_course_html: activeCourse.about_the_course_html,
                        course_html_description: activeCourse.course_html_description,
                        thumbnail_file_id: activeCourse.thumbnail_file_id,
                        course_preview_image_media_id: activeCourse.course_preview_image_media_id,
                        course_banner_media_id: activeCourse.course_banner_media_id,
                        course_media_id: activeCourse.course_media_id,
                    }}
                    onSave={(data) => {
                        onUpdateCourse(activeCourse.id, data);
                    }}
                />
            )}
        </div>
    );
}
