import { useState, useMemo } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    DownloadSimple,
    UploadSimple,
    CheckCircle,
    Warning,
    ArrowRight,
    ArrowLeft,
    Plus,
    X,
} from '@phosphor-icons/react';
import Papa from 'papaparse';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';
import {
    BulkCourseItem,
    LevelOption,
    SessionOption,
    CourseType,
    PaymentType,
    SelectedBatchCombination,
    generateColumnKey,
    BATCH_CSV_FIELDS,
    BatchConfig,
} from '../-types/bulk-create-types';

interface CsvImportDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    levels: LevelOption[];
    sessions: SessionOption[];
    onImport: (courses: BulkCourseItem[]) => void;
}

const STEP_TITLES = {
    1: 'Select Batch Combinations',
    2: 'Download Template',
    3: 'Upload & Import',
};

const STEP_DESCRIPTIONS = {
    1: 'Choose the level and session combinations for your courses.',
    2: 'Download the CSV template with columns for your selected batches.',
    3: 'Upload your filled CSV file to import courses.',
};

const COURSE_TYPES: { value: CourseType; label: string }[] = [
    { value: 'COURSE', label: 'Course' },
    { value: 'MEMBERSHIP', label: 'Membership' },
    { value: 'PRODUCT', label: 'Product' },
    { value: 'SERVICE', label: 'Service' },
];

const PACKAGE_LEVEL_HEADERS = [
    'Course Name',
    'Course Type (COURSE/MEMBERSHIP/PRODUCT/SERVICE)',
    'Tags (comma separated)',
    'Description (HTML allowed)',
    'About the Course (HTML)',
    'Why Learn (HTML)',
    'Who Should Learn (HTML)',
];

export function CsvImportDialog({
    open,
    onOpenChange,
    levels,
    sessions,
    onImport,
}: CsvImportDialogProps) {
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [selectedCourseType, setSelectedCourseType] = useState<CourseType>('COURSE');
    const [parsedCourses, setParsedCourses] = useState<BulkCourseItem[]>([]);
    const [importStats, setImportStats] = useState<{ total: number; valid: number } | null>(null);

    // Batch combination selection
    const [selectedCombinations, setSelectedCombinations] = useState<SelectedBatchCombination[]>(
        []
    );
    const [pendingLevelId, setPendingLevelId] = useState<string>('');
    const [pendingSessionId, setPendingSessionId] = useState<string>('');

    const resetState = () => {
        setStep(1);
        setSelectedCourseType('COURSE');
        setParsedCourses([]);
        setImportStats(null);
        setSelectedCombinations([]);
        setPendingLevelId('');
        setPendingSessionId('');
    };

    const handleOpenChange = (newOpen: boolean) => {
        if (!newOpen) resetState();
        onOpenChange(newOpen);
    };

    const handleAddCombination = () => {
        if (!pendingLevelId || !pendingSessionId) {
            toast.error('Please select both level and session');
            return;
        }

        const level = levels.find((l) => l.id === pendingLevelId);
        const session = sessions.find((s) => s.id === pendingSessionId);

        if (!level || !session) return;

        // Check for duplicate
        const exists = selectedCombinations.some(
            (c) => c.levelId === pendingLevelId && c.sessionId === pendingSessionId
        );

        if (exists) {
            toast.error('This combination is already added');
            return;
        }

        const columnKey = generateColumnKey(level.name, session.name);

        setSelectedCombinations((prev) => [
            ...prev,
            {
                levelId: level.id,
                levelName: level.name,
                sessionId: session.id,
                sessionName: session.name,
                columnKey,
            },
        ]);

        setPendingLevelId('');
        setPendingSessionId('');
    };

    const handleRemoveCombination = (index: number) => {
        setSelectedCombinations((prev) => prev.filter((_, i) => i !== index));
    };

    // Generate CSV headers based on selected combinations
    const csvHeaders = useMemo(() => {
        const headers = [...PACKAGE_LEVEL_HEADERS];

        // Add batch-specific columns for each combination
        selectedCombinations.forEach((combo) => {
            BATCH_CSV_FIELDS.forEach((field) => {
                headers.push(`${combo.columnKey}_${field}`);
            });
        });

        return headers;
    }, [selectedCombinations]);

    const handleDownloadTemplate = () => {
        // Generate sample row data
        const sampleRow1: string[] = [
            'Introduction to Python',
            'COURSE',
            'python,coding,beginner',
            '<p>Learn Python basics</p>',
            '<p>Detailed about the course...</p>',
            '<p>Great career opportunities...</p>',
            '<p>Beginners and students...</p>',
        ];

        const sampleRow2: string[] = [
            'Advanced React Patterns',
            'COURSE',
            'react,frontend,advanced',
            '<p>Master React patterns</p>',
            '',
            '',
            '',
        ];

        // Add batch-specific sample values
        selectedCombinations.forEach((_, idx) => {
            // Sample values for each batch field
            sampleRow1.push(
                idx === 0 ? '499' : '599', // price
                'ONE_TIME', // payment_type
                '50', // max_slots
                '180' // validity_days
            );
            sampleRow2.push(
                idx === 0 ? '999' : '1099', // price
                'SUBSCRIPTION', // payment_type
                '', // max_slots
                '365' // validity_days
            );
        });

        const csvContent = [
            csvHeaders.join(','),
            sampleRow1.map((cell) => `"${cell}"`).join(','),
            sampleRow2.map((cell) => `"${cell}"`).join(','),
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute(
                'download',
                `bulk_course_import_${selectedCombinations.length}_batches.csv`
            );
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
        toast.success('Template downloaded');
    };

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const courses: BulkCourseItem[] = [];
                let validCount = 0;

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                results.data.forEach((row: any) => {
                    const courseName = row['Course Name']?.trim();
                    if (!courseName) return;

                    // Parse Course Type
                    let courseType: CourseType = selectedCourseType;
                    const typeInput = row['Course Type (COURSE/MEMBERSHIP/PRODUCT/SERVICE)']
                        ?.toString()
                        .toUpperCase();
                    if (
                        typeInput &&
                        ['COURSE', 'MEMBERSHIP', 'PRODUCT', 'SERVICE'].includes(typeInput)
                    ) {
                        courseType = typeInput as CourseType;
                    }

                    // Parse Tags
                    const tagsInput = row['Tags (comma separated)'];
                    const tags = tagsInput
                        ? tagsInput
                              .split(',')
                              .map((t: string) => t.trim())
                              .filter(Boolean)
                        : [];

                    // Parse Description and Metadata
                    const description = row['Description (HTML allowed)'] || '';
                    const aboutCourse = row['About the Course (HTML)'] || '';
                    const whyLearn = row['Why Learn (HTML)'] || '';
                    const whoShouldLearn = row['Who Should Learn (HTML)'] || '';

                    // Parse batch-specific data for each combination
                    const batches: BatchConfig[] = [];

                    selectedCombinations.forEach((combo) => {
                        const priceKey = `${combo.columnKey}_price`;
                        const paymentTypeKey = `${combo.columnKey}_payment_type`;
                        const maxSlotsKey = `${combo.columnKey}_max_slots`;
                        const validityKey = `${combo.columnKey}_validity_days`;

                        const priceInput = row[priceKey];
                        const paymentTypeInput = row[paymentTypeKey]?.toString().toUpperCase();
                        const maxSlotsInput = row[maxSlotsKey];
                        const validityInput = row[validityKey];

                        // Determine payment type
                        let paymentType: PaymentType = 'FREE';
                        if (
                            paymentTypeInput &&
                            ['FREE', 'ONE_TIME', 'SUBSCRIPTION', 'DONATION'].includes(
                                paymentTypeInput
                            )
                        ) {
                            paymentType = paymentTypeInput as PaymentType;
                        }

                        const price = priceInput ? parseFloat(priceInput) : undefined;
                        const maxSlots = maxSlotsInput ? parseInt(maxSlotsInput) : null;
                        const validity = validityInput ? parseInt(validityInput) : undefined;

                        batches.push({
                            level_id: combo.levelId,
                            session_id: combo.sessionId,
                            level_name: combo.levelName,
                            session_name: combo.sessionName,
                            inventory_config: {
                                max_slots: isNaN(Number(maxSlots)) ? null : Number(maxSlots),
                                available_slots: isNaN(Number(maxSlots)) ? null : Number(maxSlots),
                            },
                            payment_config: {
                                payment_type: paymentType,
                                price: isNaN(Number(price)) ? undefined : Number(price),
                                validity_in_days: isNaN(Number(validity))
                                    ? undefined
                                    : Number(validity),
                                currency: 'INR',
                            },
                        });
                    });

                    courses.push({
                        id: uuidv4(),
                        course_name: courseName,
                        course_type: courseType,
                        tags: tags,
                        publish_to_catalogue: true,
                        batches: batches,
                        payment_config: {
                            payment_type: 'FREE',
                        },
                        course_html_description: description,
                        about_the_course_html: aboutCourse,
                        why_learn_html: whyLearn,
                        who_should_learn_html: whoShouldLearn,
                        course_depth: 5,
                    });
                    validCount++;
                });

                setParsedCourses(courses);
                setImportStats({ total: results.data.length, valid: validCount });
            },
            error: (error) => {
                toast.error(`Error parsing CSV: ${error.message}`);
            },
        });
    };

    const handleImport = () => {
        if (parsedCourses.length === 0) {
            toast.error('No valid courses to import');
            return;
        }
        onImport(parsedCourses);
        toast.success(
            `Imported ${parsedCourses.length} courses with ${selectedCombinations.length} batch(es) each`
        );
        handleOpenChange(false);
    };

    const canProceedToDownload = selectedCombinations.length > 0;
    const canProceedToUpload = canProceedToDownload;

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>{STEP_TITLES[step]}</DialogTitle>
                    <DialogDescription>{STEP_DESCRIPTIONS[step]}</DialogDescription>
                </DialogHeader>

                {/* Step 1: Select Batch Combinations */}
                {step === 1 && (
                    <div className="space-y-4 py-4">
                        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
                            <p className="mb-2 text-xs text-neutral-600">
                                Add level + session combinations. Each combination will create
                                separate columns in the CSV for pricing and inventory.
                            </p>
                        </div>

                        {/* Add Combination Form */}
                        <div className="flex items-end gap-2">
                            <div className="flex-1 space-y-1">
                                <Label className="text-xs">Level</Label>
                                <Select value={pendingLevelId} onValueChange={setPendingLevelId}>
                                    <SelectTrigger className="h-9">
                                        <SelectValue placeholder="Select Level" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {levels.map((level) => (
                                            <SelectItem key={level.id} value={level.id}>
                                                {level.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex-1 space-y-1">
                                <Label className="text-xs">Session</Label>
                                <Select
                                    value={pendingSessionId}
                                    onValueChange={setPendingSessionId}
                                >
                                    <SelectTrigger className="h-9">
                                        <SelectValue placeholder="Select Session" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {sessions.map((session) => (
                                            <SelectItem key={session.id} value={session.id}>
                                                {session.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <Button
                                size="sm"
                                onClick={handleAddCombination}
                                disabled={!pendingLevelId || !pendingSessionId}
                                className="h-9"
                            >
                                <Plus className="size-4" />
                            </Button>
                        </div>

                        {/* Selected Combinations List */}
                        <div className="space-y-2">
                            <Label className="text-xs text-neutral-500">
                                Selected Combinations ({selectedCombinations.length})
                            </Label>
                            {selectedCombinations.length === 0 ? (
                                <div className="rounded-lg border-2 border-dashed border-neutral-200 p-4 text-center text-sm text-neutral-400">
                                    No combinations added yet
                                </div>
                            ) : (
                                <ScrollArea className="max-h-[150px]">
                                    <div className="space-y-2">
                                        {selectedCombinations.map((combo, index) => (
                                            <div
                                                key={`${combo.levelId}-${combo.sessionId}`}
                                                className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white p-2"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="secondary" className="text-xs">
                                                        {combo.levelName}
                                                    </Badge>
                                                    <span className="text-neutral-400">+</span>
                                                    <Badge variant="outline" className="text-xs">
                                                        {combo.sessionName}
                                                    </Badge>
                                                    <span className="text-[10px] text-neutral-400">
                                                        ({combo.columnKey}_*)
                                                    </span>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="size-6 p-0 text-neutral-400 hover:text-red-500"
                                                    onClick={() => handleRemoveCombination(index)}
                                                >
                                                    <X className="size-3" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>
                            )}
                        </div>

                        {/* Course Type */}
                        <div className="space-y-2">
                            <Label className="text-xs">Default Course Type</Label>
                            <Select
                                value={selectedCourseType}
                                onValueChange={(val) => setSelectedCourseType(val as CourseType)}
                            >
                                <SelectTrigger className="h-9">
                                    <SelectValue placeholder="Select Course Type" />
                                </SelectTrigger>
                                <SelectContent>
                                    {COURSE_TYPES.map((type) => (
                                        <SelectItem key={type.value} value={type.value}>
                                            {type.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                )}

                {/* Step 2: Download Template */}
                {step === 2 && (
                    <div className="space-y-4 py-4">
                        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
                            <h4 className="mb-2 text-sm font-medium text-neutral-800">
                                Template Summary
                            </h4>
                            <ul className="space-y-1 text-xs text-neutral-600">
                                <li>
                                    • <strong>{selectedCombinations.length}</strong> batch
                                    combination(s) selected
                                </li>
                                <li>
                                    • <strong>{csvHeaders.length}</strong> total columns in CSV
                                </li>
                                <li>
                                    • Each row = 1 package with{' '}
                                    <strong>{selectedCombinations.length}</strong> package
                                    session(s)
                                </li>
                            </ul>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs text-neutral-500">
                                Batch Columns Preview
                            </Label>
                            <ScrollArea className="max-h-[120px]">
                                <div className="flex flex-wrap gap-1">
                                    {selectedCombinations.map((combo) =>
                                        BATCH_CSV_FIELDS.map((field) => (
                                            <Badge
                                                key={`${combo.columnKey}_${field}`}
                                                variant="outline"
                                                className="text-[10px]"
                                            >
                                                {combo.columnKey}_{field}
                                            </Badge>
                                        ))
                                    )}
                                </div>
                            </ScrollArea>
                        </div>

                        <Button
                            variant="default"
                            className="w-full"
                            onClick={handleDownloadTemplate}
                        >
                            <DownloadSimple className="mr-2 size-4" />
                            Download CSV Template
                        </Button>
                    </div>
                )}

                {/* Step 3: Upload & Import */}
                {step === 3 && (
                    <div className="space-y-4 py-4">
                        {!importStats ? (
                            <div className="relative flex flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed border-neutral-200 p-8">
                                <UploadSimple className="size-10 text-neutral-400" />
                                <div className="text-center text-sm text-neutral-500">
                                    <p className="font-medium text-neutral-900">
                                        Click to upload CSV
                                    </p>
                                    <p>or drag and drop here</p>
                                </div>
                                <Input
                                    type="file"
                                    accept=".csv"
                                    className="absolute inset-0 h-full scale-110 cursor-pointer opacity-0"
                                    onChange={handleFileUpload}
                                />
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    className="pointer-events-none"
                                >
                                    Select File
                                </Button>
                            </div>
                        ) : (
                            <div className="rounded-lg bg-neutral-50 p-4">
                                <div className="mb-2 flex items-center gap-2">
                                    <CheckCircle className="size-5 text-green-600" weight="fill" />
                                    <h4 className="font-medium text-neutral-900">File Parsed</h4>
                                </div>
                                <ul className="space-y-1 text-sm text-neutral-600">
                                    <li>Total Rows: {importStats.total}</li>
                                    <li>Valid Courses: {importStats.valid}</li>
                                    <li>Batches per course: {selectedCombinations.length}</li>
                                    <li>
                                        Total Package Sessions:{' '}
                                        {importStats.valid * selectedCombinations.length}
                                    </li>
                                </ul>
                                {importStats.valid === 0 && (
                                    <div className="mt-3 flex items-start gap-2 text-xs text-red-600">
                                        <Warning className="size-4 shrink-0" />
                                        <p>
                                            No valid courses found. Please check column headers
                                            match the template.
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                <DialogFooter>
                    {step === 1 && (
                        <Button
                            onClick={() => setStep(2)}
                            disabled={!canProceedToDownload}
                            className="w-full sm:w-auto"
                        >
                            Next
                            <ArrowRight className="ml-2 size-4" />
                        </Button>
                    )}

                    {step === 2 && (
                        <div className="flex w-full justify-between gap-2">
                            <Button variant="ghost" onClick={() => setStep(1)}>
                                <ArrowLeft className="mr-2 size-4" />
                                Back
                            </Button>
                            <Button onClick={() => setStep(3)} disabled={!canProceedToUpload}>
                                Next
                                <ArrowRight className="ml-2 size-4" />
                            </Button>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="flex w-full justify-between gap-2">
                            <Button variant="ghost" onClick={() => setStep(2)}>
                                <ArrowLeft className="mr-2 size-4" />
                                Back
                            </Button>
                            <Button
                                onClick={handleImport}
                                disabled={!importStats || importStats.valid === 0}
                            >
                                Import {importStats?.valid || 0} Courses
                            </Button>
                        </div>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
