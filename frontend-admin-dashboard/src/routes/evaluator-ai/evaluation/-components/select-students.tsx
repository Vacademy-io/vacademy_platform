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
import { RoleTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';
import { getTerminologyPlural } from '@/components/common/layout-container/sidebar/utils';
import { useTranslation } from 'react-i18next';

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
    const { t, i18n } = useTranslation('evaluatorAiEvaluationSelectStudents');
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
            toast.warning(t('toast.selectAtLeastOneStudent'));
            return;
        }
        setIsAssessmentModalOpen(true);
    };

    const handleEvaluate = async () => {
        if (!selectedAssessment) {
            toast.warning(t('toast.selectAssessment'));
            return;
        }
        setIsEvaluating(true);
        try {
            const selectedStudents = selected.map((index) => studentData[index]) ?? [];
            setLoading(true);
            // @ts-expect-error : //FIXME this error
            onSubmit(selectedStudents, selectedAssessment);
        } catch (error) {
            toast.error(t('toast.evaluationFailed'));
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
        return date.toLocaleDateString(i18n.language, {
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
                            {t('dialog.title', {
                                term: getTerminologyPlural(RoleTerms.Learner, SystemTerms.Learner),
                            })}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="mx-auto mb-4 w-full max-w-4xl">
                        <div className="mt-4 rounded-md border">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader className="bg-primary-50">
                                        <TableRow>
                                            <TableHead className="sticky start-0 z-10 w-12 bg-primary-50 text-center">
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
                                            <TableHead className="sticky start-12 z-10 bg-primary-50">
                                                {t('table.name')}
                                            </TableHead>
                                            <TableHead>{t('table.enrollmentId')}</TableHead>
                                            <TableHead>{t('table.attemptCount')}</TableHead>
                                            <TableHead>{t('table.currentPdfId')}</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {isEvaluating ? (
                                            // Shimmer loading effect
                                            <>
                                                {Array.from({ length: 3 }).map((_, index) => (
                                                    <TableRow key={index}>
                                                        <TableCell className="sticky start-0 z-10 bg-white text-center">
                                                            <div className="size-4 animate-pulse rounded bg-gray-200"></div>
                                                        </TableCell>
                                                        <TableCell className="sticky start-12 z-10 bg-white">
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
                                                                {t('table.evaluatingWithAssessment', {
                                                                    term: getTerminologyPlural(
                                                                        RoleTerms.Learner,
                                                                        SystemTerms.Learner
                                                                    ).toLocaleLowerCase(),
                                                                    assessment: selectedAssessment,
                                                                })}
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
                                                        <TableCell className="sticky start-0 z-10 bg-white text-center">
                                                            <Checkbox
                                                                checked={selected.includes(
                                                                    actualIndex
                                                                )}
                                                                onCheckedChange={() =>
                                                                    toggleSelect(actualIndex)
                                                                }
                                                            />
                                                        </TableCell>
                                                        <TableCell className="sticky start-12 z-10 bg-white">
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
                                                                        {t('table.attemptsCount', {
                                                                            count: student.attempts
                                                                                .length,
                                                                        })}
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
                                                                                    {t(
                                                                                        'table.attemptLabel',
                                                                                        {
                                                                                            number:
                                                                                                attemptIndex +
                                                                                                1,
                                                                                        }
                                                                                    )}
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
                                                            {currentAttempt?.pdfId ||
                                                                t('table.notAvailable')}
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
                                    {t('table.emptyState', {
                                        term: getTerminologyPlural(
                                            RoleTerms.Learner,
                                            SystemTerms.Learner
                                        ).toLocaleLowerCase(),
                                    })}
                                </div>
                            ) : (
                                !isEvaluating && (
                                    <div className="flex items-center justify-between p-4">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm text-muted-foreground">
                                                {t('pagination.pageInfo', {
                                                    current: currentPage,
                                                    total: totalPages,
                                                })}
                                            </span>
                                            <div className="flex gap-1">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => goToPage(currentPage - 1)}
                                                    disabled={currentPage === 1}
                                                >
                                                    {t('pagination.previous')}
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => goToPage(currentPage + 1)}
                                                    disabled={currentPage === totalPages}
                                                >
                                                    {t('pagination.next')}
                                                </Button>
                                            </div>
                                        </div>
                                        <div>
                                            <span className="me-2 text-sm text-muted-foreground">
                                                {t('pagination.selectedCount', {
                                                    count: selected.length,
                                                })}
                                            </span>
                                        </div>
                                    </div>
                                )
                            )}
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => onOpenChange(false)}>
                            {t('common.cancel')}
                        </Button>
                        <Button
                            onClick={handleOpenAssessmentModal}
                            disabled={selected.length === 0 || isEvaluating}
                        >
                            {t('table.submitSelected', { count: selected.length })}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Assessment Selection Dialog */}
            <Dialog open={isAssessmentModalOpen} onOpenChange={setIsAssessmentModalOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle className="font-bold">
                            {t('assessmentDialog.title')}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="assessment" className="text-end">
                                {t('assessmentDialog.assessmentLabel')}
                            </Label>
                            <Select onValueChange={(value) => setSelectedAssessment(value)}>
                                <SelectTrigger className="col-span-3">
                                    <SelectValue
                                        placeholder={t('assessmentDialog.selectPlaceholder')}
                                    />
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
                            {t('common.cancel')}
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleEvaluate}
                            disabled={!selectedAssessment || isEvaluating}
                        >
                            {isEvaluating ? (
                                <>
                                    <Loader2 className="me-2 size-4 animate-spin" />
                                    {t('assessmentDialog.evaluating')}
                                </>
                            ) : (
                                t('assessmentDialog.evaluateButton')
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
