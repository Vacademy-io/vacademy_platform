'use client';

import { useState, useEffect } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Loader2, ChevronDown } from 'lucide-react';
import { useLoaderStore } from '../-hooks/loader';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface AttemptData {
    id: string;
    pdfId: string;
    fileId: string;
    date: string;
}

export interface StudentData {
    name: string;
    enrollId: string;
    attempts: AttemptData[];
    currentAttemptIndex: number;
}

interface StudentSelectionDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (selectedStudents: StudentData[], selectedAssessment?: string) => void;
    title?: string;
    itemsPerPage?: number;
}

export function StudentSelectionDialog({
    isOpen,
    onOpenChange,
    onSubmit,
    itemsPerPage = 10,
}: StudentSelectionDialogProps) {
    const [selected, setSelected] = useState<number[]>([]);
    const [isAssessmentModalOpen, setIsAssessmentModalOpen] = useState(false);
    const [selectedAssessment, setSelectedAssessment] = useState<string>('');
    const [isEvaluating, setIsEvaluating] = useState(false);
    const [attemptDropdownOpen, setAttemptDropdownOpen] = useState<Record<number, boolean>>({});

    const { setLoading } = useLoaderStore();
    const studentData = JSON.parse(localStorage.getItem('students') || '[]') as StudentData[];
    const assessments = JSON.parse(localStorage.getItem('assessments') || '[]') as {
        assessmentId: string;
        title: string;
    }[];

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const totalPages = Math.ceil(studentData.length / itemsPerPage);
    const paginatedStudents = studentData.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    useEffect(() => {
        if (isOpen) {
            setSelected([]);
            setCurrentPage(1);
            setSelectedAssessment('');
        }
    }, [isOpen]);

    const toggleSelect = (index: number) => {
        setSelected((prev) =>
            prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
        );
    };

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            const allIndices = paginatedStudents.map(
                (_, index) => (currentPage - 1) * itemsPerPage + index
            );
            setSelected(allIndices);
        } else {
            setSelected([]);
        }
    };

    const handleOpenAssessmentModal = () => {
        if (selected.length === 0) {
            toast.warning('Please select at least one student');
            return;
        }
        setIsAssessmentModalOpen(true);
    };

    const handleEvaluate = async () => {
        if (!selectedAssessment) {
            toast.warning('Please select an assessment');
            return;
        }
        setIsEvaluating(true);
        try {
            const selectedStudents = selected.map((index) => studentData[index]) ?? [];
            setLoading(true);
            // @ts-expect-error : //FIXME this error
            onSubmit(selectedStudents, selectedAssessment);
        } catch (error) {
            toast.error('Evaluation failed. Please try again.');
        } finally {
            setIsEvaluating(false);
            setIsAssessmentModalOpen(false);
            onOpenChange(false);
        }
    };

    const goToPage = (page: number) => {
        if (page > 0 && page <= totalPages) {
            setCurrentPage(page);
        }
    };

    const handleSelectAttempt = (studentIndex: number, attemptIndex: number) => {
        const actualIndex = (currentPage - 1) * itemsPerPage + studentIndex;

        // Create a copy of the student data to modify
        const updatedStudentData = [...studentData];
        const studentToUpdate = updatedStudentData[actualIndex];
        if (studentToUpdate) {
            studentToUpdate.currentAttemptIndex = attemptIndex;
        }
        // Update localStorage
        localStorage.setItem('students', JSON.stringify(updatedStudentData));

        // Close the dropdown
        setAttemptDropdownOpen({ ...attemptDropdownOpen, [studentIndex]: false });

        // Force a re-render by updating a state
        setSelected([...selected]);
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    return (
        <>
            <Dialog open={isOpen} onOpenChange={onOpenChange}>
                <DialogContent className="w-[60vw]">
                    <DialogHeader className="mb-2">
                        <DialogTitle className="font-bold">
                            {'Select Students for Evaluation'}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="mx-auto mb-4 w-full max-w-4xl">
                        <div className="mt-4 rounded-md border">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader className="bg-primary-50">
                                        <TableRow>
                                            <TableHead className="sticky left-0 z-10 w-12 bg-primary-50 text-center">
                                                <Checkbox
                                                    checked={
                                                        paginatedStudents.length > 0 &&
                                                        selected.length === paginatedStudents.length
                                                    }
                                                    onCheckedChange={(checked) =>
                                                        handleSelectAll(!!checked)
                                                    }
                                                />
                                            </TableHead>
                                            <TableHead className="sticky left-12 z-10 bg-primary-50">
                                                Learner Name
                                            </TableHead>
                                            <TableHead>Enrollment ID</TableHead>
                                            <TableHead>Attempt Count</TableHead>
                                            <TableHead>Current PDF ID</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {isEvaluating ? (
                                            // Shimmer loading effect
                                            <>
                                                {Array.from({ length: 3 }).map((_, index) => (
                                                    <TableRow key={index}>
                                                        <TableCell className="sticky left-0 z-10 bg-white text-center">
                                                            <div className="size-4 animate-pulse rounded bg-gray-200"></div>
                                                        </TableCell>
                                                        <TableCell className="sticky left-12 z-10 bg-white">
                                                            <div className="h-4 w-3/4 animate-pulse rounded bg-gray-200"></div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="h-4 w-1/2 animate-pulse rounded bg-gray-200"></div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="h-4 w-1/2 animate-pulse rounded bg-gray-200"></div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="h-4 w-1/2 animate-pulse rounded bg-gray-200"></div>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                                <TableRow>
                                                    <TableCell
                                                        colSpan={5}
                                                        className="py-4 text-center"
                                                    >
                                                        <div className="flex items-center justify-center gap-2">
                                                            <Loader2 className="size-4 animate-spin" />
                                                            <span>
                                                                Evaluating students with{' '}
                                                                {selectedAssessment}...
                                                            </span>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            </>
                                        ) : (
                                            // Normal student rows
                                            paginatedStudents.map((student, index) => {
                                                const actualIndex =
                                                    (currentPage - 1) * itemsPerPage + index;
                                                const currentAttempt: AttemptData | undefined =
                                                    student.attempts[student?.currentAttemptIndex];
                                                return (
                                                    <TableRow key={index}>
                                                        <TableCell className="sticky left-0 z-10 bg-white text-center">
                                                            <Checkbox
                                                                checked={selected.includes(
                                                                    actualIndex
                                                                )}
                                                                onCheckedChange={() =>
                                                                    toggleSelect(actualIndex)
                                                                }
                                                            />
                                                        </TableCell>
                                                        <TableCell className="sticky left-12 z-10 bg-white">
                                                            {student.name}
                                                        </TableCell>
                                                        <TableCell>{student.enrollId}</TableCell>
                                                        <TableCell>
                                                            <DropdownMenu
                                                                open={attemptDropdownOpen[index]}
                                                                onOpenChange={(open) =>
                                                                    setAttemptDropdownOpen({
                                                                        ...attemptDropdownOpen,
                                                                        [index]: open,
                                                                    })
                                                                }
                                                            >
                                                                <DropdownMenuTrigger asChild>
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        className="flex items-center gap-1"
                                                                    >
                                                                        {student.attempts.length}{' '}
                                                                        Attempts
                                                                        <ChevronDown className="size-4" />
                                                                    </Button>
                                                                </DropdownMenuTrigger>
                                                                <DropdownMenuContent
                                                                    align="start"
                                                                    className="w-56"
                                                                >
                                                                    {student.attempts.map(
                                                                        (attempt, attemptIndex) => (
                                                                            <DropdownMenuItem
                                                                                key={attempt.id}
                                                                                className={cn(
                                                                                    'flex cursor-pointer justify-between',
                                                                                    student.currentAttemptIndex ===
                                                                                        attemptIndex &&
                                                                                        'bg-muted'
                                                                                )}
                                                                                onClick={() =>
                                                                                    handleSelectAttempt(
                                                                                        index,
                                                                                        attemptIndex
                                                                                    )
                                                                                }
                                                                            >
                                                                                <span>
                                                                                    Attempt{' '}
                                                                                    {attemptIndex +
                                                                                        1}
                                                                                </span>
                                                                                <span className="text-xs text-muted-foreground">
                                                                                    {formatDate(
                                                                                        attempt.date
                                                                                    )}
                                                                                </span>
                                                                            </DropdownMenuItem>
                                                                        )
                                                                    )}
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                        </TableCell>
                                                        <TableCell>
                                                            {currentAttempt?.pdfId || 'N/A'}
                                                            {/* {currentAttempt ? currentAttempt.pdfId : "N/A"} */}
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })
                                        )}
                                    </TableBody>
                                </Table>
                            </div>

                            {studentData.length === 0 && !isEvaluating ? (
                                <div className="p-4 text-center text-sm text-muted-foreground">
                                    No enrolled students found.
                                </div>
                            ) : (
                                !isEvaluating && (
                                    <div className="flex items-center justify-between p-4">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm text-muted-foreground">
                                                Page {currentPage} of {totalPages}
                                            </span>
                                            <div className="flex gap-1">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => goToPage(currentPage - 1)}
                                                    disabled={currentPage === 1}
                                                >
                                                    Previous
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => goToPage(currentPage + 1)}
                                                    disabled={currentPage === totalPages}
                                                >
                                                    Next
                                                </Button>
                                            </div>
                                        </div>
                                        <div>
                                            <span className="mr-2 text-sm text-muted-foreground">
                                                {selected.length} selected
                                            </span>
                                        </div>
                                    </div>
                                )
                            )}
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleOpenAssessmentModal}
                            disabled={selected.length === 0 || isEvaluating}
                        >
                            Submit Selected ({selected.length})
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Assessment Selection Dialog */}
            <Dialog open={isAssessmentModalOpen} onOpenChange={setIsAssessmentModalOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle className="font-bold">Select Assessment</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="assessment" className="text-right">
                                Assessment
                            </Label>
                            <Select onValueChange={(value) => setSelectedAssessment(value)}>
                                <SelectTrigger className="col-span-3">
                                    <SelectValue placeholder="Select an assessment" />
                                </SelectTrigger>
                                <SelectContent>
                                    {assessments.map((assessment) => (
                                        <SelectItem
                                            key={assessment.assessmentId}
                                            value={assessment.assessmentId}
                                        >
                                            {assessment.title}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setIsAssessmentModalOpen(false)}
                            disabled={isEvaluating}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleEvaluate}
                            disabled={!selectedAssessment || isEvaluating}
                        >
                            {isEvaluating ? (
                                <>
                                    <Loader2 className="mr-2 size-4 animate-spin" />
                                    Evaluating...
                                </>
                            ) : (
                                'Evaluate'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
