'use client';

import type React from 'react';

import { useEffect, useState } from 'react';
import { DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, MoreVertical, Pencil, Trash2, FileText, Plus, ChevronDown } from 'lucide-react';
import { MyDialog } from '@/components/design-system/dialog';
import { MyButton } from '@/components/design-system/button';
import { handleStartProcessUploadedFile } from '@/routes/ai-center/-services/ai-center-service';
import { UploadFileInS3Public } from '@/routes/signup/-services/signup-services';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Pagination,
    PaginationContent,
    PaginationEllipsis,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
} from '@/components/ui/pagination';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useSearch } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { GET_PUBLIC_URL_PUBLIC } from '@/constants/urls';
import { FilePlus } from '@phosphor-icons/react';
import { getTerminology } from '@/components/common/layout-container/sidebar/utils';
import { RoleTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';

// Helper functions for API calls using axios directly
export const getPublicUrl = async (fileId: string | undefined | null): Promise<string> => {
    const response = await axios.get(GET_PUBLIC_URL_PUBLIC, {
        params: { fileId, expiryDays: 1 },
    });
    return response?.data;
};

interface AttemptData {
    id: string;
    pdfId: string;
    fileId?: string;
    date: string;
}

interface StudentData {
    name: string;
    enrollId: string;
    attempts: AttemptData[];
    currentAttemptIndex: number;
}

export function StudentEnrollment() {
    const { t, i18n } = useTranslation('evaluatorAiStudentsAddStudent');
    const { q } = useSearch({ from: '/evaluator-ai/students/' }) as { q: string };
    const [open, setOpen] = useState(q ? true : false);
    const [name, setName] = useState('');
    const [enrollId, setEnrollId] = useState('');
    const [pdfId, setPdfId] = useState('');
    const [fileId, setFileId] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [students, setStudents] = useState<StudentData[]>([]);
    const [selected, setSelected] = useState<number[]>([]);
    const [editIndex, setEditIndex] = useState<number | null>(null);
    const [isEditMode, setIsEditMode] = useState(false);
    const [loadingPdf, setLoadingPdf] = useState<Record<string, boolean>>({});

    // New state for attempt management
    const [attemptDialogOpen, setAttemptDialogOpen] = useState(false);
    const [currentStudentIndex, setCurrentStudentIndex] = useState<number | null>(null);
    const [attemptDropdownOpen, setAttemptDropdownOpen] = useState<Record<number, boolean>>({});

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    const totalPages = Math.ceil(students.length / itemsPerPage);
    const paginatedStudents = students.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    useEffect(() => {
        // Convert old format to new format with attempts
        const savedStudents = JSON.parse(localStorage.getItem('students') || '[]');
        // eslint-disable-next-line
        const convertedStudents = savedStudents.map((student: any) => {
            // If the student already has attempts array, return as is
            if (student.attempts) return student;

            // Convert old format to new format
            return {
                name: student.name,
                enrollId: student.enrollId,
                attempts: student.pdfId
                    ? [
                          {
                              id: crypto.randomUUID(),
                              pdfId: student.pdfId,
                              fileId: student.fileId,
                              date: new Date().toISOString(),
                          },
                      ]
                    : [],
                currentAttemptIndex: 0,
            };
        });
        setStudents(convertedStudents);
    }, []);

    // Reset form when dialog closes
    useEffect(() => {
        if (!open) {
            resetForm();
        }
    }, [open]);

    const resetForm = () => {
        setName('');
        setEnrollId('');
        setPdfId('');
        setFileId('');
        setFile(null);
        setIsEditMode(false);
        setEditIndex(null);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setPdfId('');
            setFileId('');
        }
    };

    const handleFileUpload = async () => {
        if (!file) return;

        setIsUploading(true);
        try {
            const uploadedFileId = await UploadFileInS3Public(file, setIsUploading, 'RESPONSES');
            if (uploadedFileId) {
                setFileId(uploadedFileId); // Store the fileId
                const response: { pdf_id: string } =
                    await handleStartProcessUploadedFile(uploadedFileId);
                setPdfId(response.pdf_id);
                toast(t('toast.fileUploaded'));
            }
        } catch (error) {
            console.error('Error uploading file:', error);
            toast.error(t('toast.uploadFailed'));
        } finally {
            setIsUploading(false);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !enrollId || !pdfId) {
            toast.warning(t('toast.fillAllFields'));
            return;
        }
        try {
            let updatedStudents: StudentData[];
            if (isEditMode && editIndex !== null) {
                // Edit existing student
                updatedStudents = [...students];

                // Update basic info
                const studentToEdit = updatedStudents[editIndex];
                if (updatedStudents && studentToEdit) {
                    studentToEdit.name = name;
                    studentToEdit.enrollId = enrollId;
                }

                // If a new file was uploaded, update the first attempt or create one
                if (pdfId) {
                    const student = updatedStudents[editIndex];
                    if (student && student.attempts.length === 0) {
                        student.attempts.push({
                            id: crypto.randomUUID(),
                            pdfId,
                            fileId: fileId || '',
                            date: new Date().toISOString(),
                        });
                        student.currentAttemptIndex = 0;
                    } else if (student) {
                        const currentAttemptIndex = student.currentAttemptIndex;
                        const currentAttempt = student.attempts[currentAttemptIndex];
                        if (currentAttempt) {
                            student.attempts[currentAttemptIndex] = {
                                ...currentAttempt,
                                pdfId,
                                fileId: fileId || '',
                            };
                        }
                    }
                }

                toast.success(t('toast.studentUpdated'));
            } else {
                // Add new student
                const newStudent: StudentData = {
                    name,
                    enrollId,
                    attempts: [
                        {
                            id: crypto.randomUUID(),
                            pdfId,
                            fileId,
                            date: new Date().toISOString(),
                        },
                    ],
                    currentAttemptIndex: 0,
                };

                updatedStudents = [...students, newStudent];
                toast.success(t('toast.studentEnrolled'));
            }

            localStorage.setItem('students', JSON.stringify(updatedStudents));
            setStudents(updatedStudents);

            // Reset form and close dialog
            resetForm();
            setOpen(false);
        } catch (error) {
            console.error('Error saving to localStorage:', error);
            toast.error(
                isEditMode ? t('toast.failedUpdateStudent') : t('toast.failedEnrollStudent')
            );
        }
    };

    const handleEdit = (index: number) => {
        const actualIndex = (currentPage - 1) * itemsPerPage + index;
        const student = students[actualIndex];

        // Populate form with student data
        if (student) {
            setName(student.name);
            setEnrollId(student.enrollId);

            // Set PDF ID and file ID from current attempt if available
            if (student.attempts.length > 0) {
                const currentAttempt = student.attempts[student.currentAttemptIndex];
                if (currentAttempt) {
                    setPdfId(currentAttempt.pdfId);
                    setFileId(currentAttempt.fileId || '');
                }
            } else {
                setPdfId('');
                setFileId('');
            }
        }

        // Set edit mode
        setIsEditMode(true);
        setEditIndex(actualIndex);

        // Open dialog
        setOpen(true);
    };

    const handleDelete = (index: number) => {
        const actualIndex = (currentPage - 1) * itemsPerPage + index;

        // Remove from selected if it was selected
        setSelected((prev) =>
            prev
                .filter((i) => i !== actualIndex)
                // Adjust indices for items after the deleted one
                .map((i) => (i > actualIndex ? i - 1 : i))
        );

        // Remove from students array
        const updatedStudents = [...students];
        updatedStudents.splice(actualIndex, 1);
        setStudents(updatedStudents);

        // Update localStorage
        localStorage.setItem('students', JSON.stringify(updatedStudents));

        toast.success(t('toast.studentDeleted'));

        // If we deleted the last item on the current page, go to previous page
        if (paginatedStudents.length === 1 && currentPage > 1) {
            setCurrentPage(currentPage - 1);
        }
    };

    const handleViewPdf = async (studentIndex: number) => {
        const actualIndex = (currentPage - 1) * itemsPerPage + studentIndex;
        const student = students[actualIndex];

        if (!student || student.attempts.length === 0) {
            toast.error(t('toast.noFileAvailable'));
            return;
        }

        const currentAttempt = student.attempts[student.currentAttemptIndex];
        const fileId = currentAttempt?.fileId;

        if (!fileId) {
            toast.error(t('toast.noFileIdAvailable'));
            return;
        }

        try {
            setLoadingPdf({ ...loadingPdf, [fileId]: true });
            const url = await getPublicUrl(fileId);

            if (url) {
                // Open in new tab
                window.open(url, '_blank');
            } else {
                toast.error(t('toast.couldNotRetrievePdfUrl'));
            }
        } catch (error) {
            console.error('Error fetching PDF URL:', error);
            toast.error(t('toast.failedRetrievePdf'));
        } finally {
            setLoadingPdf({ ...loadingPdf, [fileId]: false });
        }
    };

    // New functions for attempt management
    const openAddAttemptDialog = (index: number) => {
        const actualIndex = (currentPage - 1) * itemsPerPage + index;
        setCurrentStudentIndex(actualIndex);
        resetForm(); // Clear form fields
        setAttemptDialogOpen(true);
    };

    const handleAddAttempt = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!pdfId || currentStudentIndex === null) {
            toast.warning(t('toast.uploadRequired'));
            return;
        }

        try {
            const updatedStudents = [...students];
            const student = updatedStudents[currentStudentIndex];

            // Add new attempt
            const newAttempt: AttemptData = {
                id: crypto.randomUUID(),
                pdfId,
                fileId,
                date: new Date().toISOString(),
            };

            if (student) {
                student.attempts.push(newAttempt);
                student.currentAttemptIndex = student.attempts.length - 1; // Set to the new attempt
            }

            // Update state and localStorage
            setStudents(updatedStudents);
            localStorage.setItem('students', JSON.stringify(updatedStudents));

            toast.success(t('toast.attemptAdded'));
            setAttemptDialogOpen(false);
            resetForm();
        } catch (error) {
            console.error('Error adding attempt:', error);
            toast.error(t('toast.failedAddAttempt'));
        }
    };

    const handleDeleteAttempt = (studentIndex: number, attemptIndex: number) => {
        const actualIndex = (currentPage - 1) * itemsPerPage + studentIndex;
        const updatedStudents = [...students];
        const student = updatedStudents[actualIndex];

        if (!student) {
            toast.error(t('toast.studentNotFound'));
            return;
        }

        if (student.attempts.length <= 1) {
            toast.warning(t('toast.cannotDeleteOnlyAttempt'));
            return;
        }

        // Remove the attempt
        student.attempts.splice(attemptIndex, 1);

        // Adjust current attempt index if needed
        if (student.currentAttemptIndex >= student.attempts.length) {
            student.currentAttemptIndex = student.attempts.length - 1;
        }

        // Update state and localStorage
        setStudents(updatedStudents);
        localStorage.setItem('students', JSON.stringify(updatedStudents));

        toast.success(t('toast.attemptDeleted'));
    };

    const handleSelectAttempt = (studentIndex: number, attemptIndex: number) => {
        const actualIndex = (currentPage - 1) * itemsPerPage + studentIndex;
        const updatedStudents = [...students];
        // if (updatedStudents && updatedStudents[actualIndex]) {
        //     // updatedStudents[actualIndex]?.currentAttemptIndex = attemptIndex;
        //     updatedStudents[actualIndex]?.currentAttemptIndex = attemptIndex;
        // }
        const student = updatedStudents[actualIndex];
        if (updatedStudents && student) {
            student.currentAttemptIndex = attemptIndex;
        }

        // Update state and localStorage
        setStudents(updatedStudents);
        localStorage.setItem('students', JSON.stringify(updatedStudents));

        // Close the dropdown
        setAttemptDropdownOpen({ ...attemptDropdownOpen, [studentIndex]: false });
    };

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

    const handleSubmitSelected = () => {
        if (selected.length === 0) {
            toast.warning(t('toast.selectAtLeastOneStudent'));
            return;
        }
        // Here you would typically send this data to your backend
        toast.success(t('toast.submittedStudents', { count: selected.length }));
    };

    const goToPage = (page: number) => {
        if (page > 0 && page <= totalPages) {
            setCurrentPage(page);
        }
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
        <div className="w-full">
            <div className="flex items-center justify-between">
                <h1 className="text-xl font-semibold">{t('title')}</h1>

                <MyDialog
                    heading={isEditMode ? t('dialog.editHeading') : t('dialog.addHeading')}
                    open={open}
                    onOpenChange={(newOpen) => {
                        if (!newOpen) {
                            resetForm();
                        }
                        setOpen(newOpen);
                    }}
                    trigger={
                        <MyButton scale="large" buttonType="primary" type="button">
                            {t('enrollTriggerButton', {
                                term: getTerminology(RoleTerms.Learner, SystemTerms.Learner),
                            })}
                        </MyButton>
                    }
                >
                    <form onSubmit={handleSubmit}>
                        <div className="flex flex-col gap-4 py-4">
                            <div className="flex flex-col items-start gap-2">
                                <Label htmlFor="name">{t('form.nameLabel')}</Label>
                                <Input
                                    id="name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder={t('form.namePlaceholder')}
                                    required
                                />
                            </div>
                            <div className="flex flex-col items-start gap-2">
                                <Label htmlFor="enrollId">{t('form.enrollIdLabel')}</Label>
                                <Input
                                    id="enrollId"
                                    value={enrollId}
                                    onChange={(e) => setEnrollId(e.target.value)}
                                    placeholder={t('form.enrollIdPlaceholder')}
                                    required
                                />
                            </div>
                            <div className="flex flex-col items-start gap-2">
                                <Label htmlFor="file">
                                    {isEditMode && pdfId
                                        ? t('form.replaceResponseLabel')
                                        : t('form.uploadResponseLabel')}
                                </Label>
                                <div className="w-full space-y-2">
                                    {isEditMode && pdfId && (
                                        <div className="text-sm">
                                            {t('form.currentPdfId', { pdfId })}
                                        </div>
                                    )}
                                    <Input
                                        id="file"
                                        type="file"
                                        onChange={handleFileChange}
                                        accept=".pdf"
                                        required={!isEditMode || !pdfId}
                                    />
                                    {file && !pdfId && (
                                        <MyButton
                                            type="button"
                                            buttonType="secondary"
                                            onClick={handleFileUpload}
                                            disabled={isUploading}
                                            size="sm"
                                        >
                                            {isUploading ? (
                                                <>
                                                    <Loader2 className="me-2 size-4 animate-spin" />
                                                    {t('common.uploading')}
                                                </>
                                            ) : (
                                                t('common.uploadFile')
                                            )}
                                        </MyButton>
                                    )}
                                </div>
                            </div>
                        </div>
                        <DialogFooter>
                            <MyButton
                                layoutVariant="default"
                                type="submit"
                                className={cn(
                                    !name || !enrollId || !pdfId
                                        ? 'pointer-events-none opacity-50'
                                        : 'cursor-pointer'
                                )}
                                disabled={!name && !enrollId}
                            >
                                {isEditMode ? t('form.updateButton') : t('form.enrollButton')}
                            </MyButton>
                        </DialogFooter>
                    </form>
                </MyDialog>

                {/* Add Attempt Dialog */}
                <MyDialog
                    heading={t('attemptDialog.heading')}
                    open={attemptDialogOpen}
                    onOpenChange={(newOpen) => {
                        if (!newOpen) {
                            resetForm();
                        }
                        setAttemptDialogOpen(newOpen);
                    }}
                >
                    <form onSubmit={handleAddAttempt}>
                        <div className="flex flex-col gap-4 py-4">
                            <div className="flex flex-col items-start gap-2">
                                <Label htmlFor="file">{t('attemptDialog.fileLabel')}</Label>
                                <div className="w-full space-y-2">
                                    <Input
                                        id="file"
                                        type="file"
                                        onChange={handleFileChange}
                                        accept=".pdf"
                                        required
                                    />
                                    {file && !pdfId && (
                                        <MyButton
                                            type="button"
                                            buttonType="secondary"
                                            onClick={handleFileUpload}
                                            disabled={isUploading}
                                            size="sm"
                                        >
                                            {isUploading ? (
                                                <>
                                                    <Loader2 className="me-2 size-4 animate-spin" />
                                                    {t('common.uploading')}
                                                </>
                                            ) : (
                                                t('common.uploadFile')
                                            )}
                                        </MyButton>
                                    )}
                                </div>
                            </div>
                        </div>
                        <DialogFooter>
                            <MyButton
                                layoutVariant="default"
                                type="submit"
                                className={cn(
                                    !pdfId ? 'pointer-events-none opacity-50' : 'cursor-pointer'
                                )}
                                disabled={!pdfId}
                            >
                                {t('attemptDialog.submitButton')}
                            </MyButton>
                        </DialogFooter>
                    </form>
                </MyDialog>
            </div>
            {/* Table displaying all enrolled students */}
            <div className="mt-6 rounded-md border">
                {students.length !== 0 && (
                    <div className="overflow-hidden">
                        <Table>
                            <TableHeader className="bg-primary-50">
                                <TableRow>
                                    <TableHead className="sticky left-0 z-10 w-12 bg-primary-50 text-center">
                                        <Checkbox
                                            checked={
                                                selected.length > 0 &&
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
                                    <TableHead>{t('table.viewPdf')}</TableHead>
                                    <TableHead className="w-10 text-end">
                                        {t('table.actions')}
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedStudents.map((student, index) => {
                                    const actualIndex = (currentPage - 1) * itemsPerPage + index;
                                    const currentAttempt: AttemptData | null =
                                        student.attempts[student.currentAttemptIndex] || null;
                                    return (
                                        <TableRow key={index}>
                                            <TableCell className="sticky left-0 z-10 bg-white text-center">
                                                <Checkbox
                                                    checked={selected.includes(actualIndex)}
                                                    onCheckedChange={() =>
                                                        toggleSelect(actualIndex)
                                                    }
                                                />
                                            </TableCell>
                                            <TableCell className="sticky left-12 z-10 bg-white">
                                                {student.name}
                                            </TableCell>
                                            <TableCell>{student.enrollId}</TableCell>
                                            <TableCell className="flex items-center gap-x-2">
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
                                                                count: student.attempts.length,
                                                            })}
                                                            <ChevronDown className="size-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <FilePlus
                                                        className="size-6 cursor-pointer hover:text-primary-500"
                                                        onClick={() => openAddAttemptDialog(index)}
                                                    />
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
                                                                        {t('table.attemptLabel', {
                                                                            number:
                                                                                attemptIndex + 1,
                                                                        })}
                                                                    </span>
                                                                    <span className="text-xs text-muted-foreground">
                                                                        {formatDate(attempt.date)}
                                                                    </span>
                                                                </DropdownMenuItem>
                                                            )
                                                        )}
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                            <TableCell>
                                                {currentAttempt?.fileId ? (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleViewPdf(index)}
                                                        disabled={
                                                            loadingPdf[currentAttempt.fileId || '']
                                                        }
                                                        className="flex items-center gap-1"
                                                    >
                                                        {loadingPdf[currentAttempt.fileId || ''] ? (
                                                            <Loader2 className="size-4 animate-spin" />
                                                        ) : (
                                                            <FileText className="size-4" />
                                                        )}
                                                        {t('table.viewPdf')}
                                                    </Button>
                                                ) : (
                                                    <span className="text-sm text-muted-foreground">
                                                        {t('table.noFile')}
                                                    </span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-end">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <button className="rounded-full p-1">
                                                            <MoreVertical className="size-4" />
                                                            <span className="sr-only">
                                                                {t('table.openMenu')}
                                                            </span>
                                                        </button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem
                                                            onClick={() => handleEdit(index)}
                                                            className="cursor-pointer"
                                                        >
                                                            <Pencil className="me-2 size-4" />
                                                            {t('table.edit')}
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            onClick={() =>
                                                                openAddAttemptDialog(index)
                                                            }
                                                            className="cursor-pointer"
                                                        >
                                                            <Plus className="me-2 size-4" />
                                                            {t('table.addAttempt')}
                                                        </DropdownMenuItem>
                                                        {student.attempts.length > 1 && (
                                                            <DropdownMenuItem
                                                                onClick={() =>
                                                                    handleDeleteAttempt(
                                                                        index,
                                                                        student.currentAttemptIndex
                                                                    )
                                                                }
                                                                className="cursor-pointer text-destructive focus:text-destructive"
                                                            >
                                                                <Trash2 className="me-2 size-4" />
                                                                {t('table.deleteCurrentAttempt')}
                                                            </DropdownMenuItem>
                                                        )}
                                                        <DropdownMenuItem
                                                            onClick={() => handleDelete(index)}
                                                            className="cursor-pointer text-destructive focus:text-destructive"
                                                        >
                                                            <Trash2 className="me-2 size-4" />
                                                            {t('table.deleteStudent')}
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                )}

                {students.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                        {t('table.emptyState')}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-between gap-4 p-4 sm:flex-row">
                        <MyButton
                            type="button"
                            scale="medium"
                            buttonType="secondary"
                            onClick={handleSubmitSelected}
                            disabled={selected.length === 0}
                            className="w-full sm:w-auto"
                        >
                            {t('table.submitSelected', { count: selected.length })}
                        </MyButton>

                        <Pagination>
                            <PaginationContent>
                                <PaginationItem>
                                    <PaginationPrevious
                                        onClick={() => goToPage(currentPage - 1)}
                                        className={
                                            currentPage === 1
                                                ? 'pointer-events-none opacity-50'
                                                : ''
                                        }
                                    />
                                </PaginationItem>

                                {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => {
                                    let pageNumber: number;

                                    // Logic to show pages around current page
                                    if (totalPages <= 5) {
                                        pageNumber = i + 1;
                                    } else if (currentPage <= 3) {
                                        pageNumber = i + 1;
                                    } else if (currentPage >= totalPages - 2) {
                                        pageNumber = totalPages - 4 + i;
                                    } else {
                                        pageNumber = currentPage - 2 + i;
                                    }

                                    return (
                                        <PaginationItem key={i}>
                                            <PaginationLink
                                                onClick={() => goToPage(pageNumber)}
                                                isActive={currentPage === pageNumber}
                                            >
                                                {pageNumber}
                                            </PaginationLink>
                                        </PaginationItem>
                                    );
                                })}

                                {totalPages > 5 && currentPage < totalPages - 2 && (
                                    <PaginationItem>
                                        <PaginationEllipsis />
                                    </PaginationItem>
                                )}

                                <PaginationItem>
                                    <PaginationNext
                                        onClick={() => goToPage(currentPage + 1)}
                                        className={
                                            currentPage === totalPages
                                                ? 'pointer-events-none opacity-50'
                                                : ''
                                        }
                                    />
                                </PaginationItem>
                            </PaginationContent>
                        </Pagination>
                    </div>
                )}
            </div>
        </div>
    );
}
