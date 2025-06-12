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
import { FilePlus } from 'phosphor-react';

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
                toast('File uploaded successfully');
            }
        } catch (error) {
            console.error('Error uploading file:', error);
            toast.error('Upload failed');
        } finally {
            setIsUploading(false);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !enrollId || !pdfId) {
            toast.warning('Please fill in all fields and upload a file.');
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

                toast.success('Student updated successfully!');
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
                toast.success('Student enrolled successfully!');
            }

            localStorage.setItem('students', JSON.stringify(updatedStudents));
            setStudents(updatedStudents);

            // Reset form and close dialog
            resetForm();
            setOpen(false);
        } catch (error) {
            console.error('Error saving to localStorage:', error);
            toast.error(isEditMode ? 'Failed to update student' : 'Failed to enroll student');
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

        toast.success('Student deleted successfully!');

        // If we deleted the last item on the current page, go to previous page
        if (paginatedStudents.length === 1 && currentPage > 1) {
            setCurrentPage(currentPage - 1);
        }
    };

    const handleViewPdf = async (studentIndex: number) => {
        const actualIndex = (currentPage - 1) * itemsPerPage + studentIndex;
        const student = students[actualIndex];

        if (!student || student.attempts.length === 0) {
            toast.error('No file available');
            return;
        }

        const currentAttempt = student.attempts[student.currentAttemptIndex];
        const fileId = currentAttempt?.fileId;

        if (!fileId) {
            toast.error('No file ID available');
            return;
        }

        try {
            setLoadingPdf({ ...loadingPdf, [fileId]: true });
            const url = await getPublicUrl(fileId);

            if (url) {
                // Open in new tab
                window.open(url, '_blank');
            } else {
                toast.error('Could not retrieve PDF URL');
            }
        } catch (error) {
            console.error('Error fetching PDF URL:', error);
            toast.error('Failed to retrieve PDF');
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
            toast.warning('Please upload a file.');
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

            toast.success('New attempt added successfully!');
            setAttemptDialogOpen(false);
            resetForm();
        } catch (error) {
            console.error('Error adding attempt:', error);
            toast.error('Failed to add attempt');
        }
    };

    const handleDeleteAttempt = (studentIndex: number, attemptIndex: number) => {
        const actualIndex = (currentPage - 1) * itemsPerPage + studentIndex;
        const updatedStudents = [...students];
        const student = updatedStudents[actualIndex];

        if (!student) {
            toast.error('Student not found.');
            return;
        }

        if (student.attempts.length <= 1) {
            toast.warning('Cannot delete the only attempt. Delete the student instead.');
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

        toast.success('Attempt deleted successfully!');
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
            toast.warning('Please select at least one student');
            return;
        }

        const selectedStudents = selected.map((index) => students[index]);
        console.log('Selected students:', selectedStudents);

        // Here you would typically send this data to your backend
        toast.success(`Submitted ${selected.length} student(s)`);
    };

    const goToPage = (page: number) => {
        if (page > 0 && page <= totalPages) {
            setCurrentPage(page);
        }
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
        <div className="w-full">
            <div className="flex items-center justify-between">
                <h1 className="text-xl font-semibold">Student List</h1>

                <MyDialog
                    heading={isEditMode ? 'Edit Student' : 'Student Enrollment'}
                    open={open}
                    onOpenChange={(newOpen) => {
                        if (!newOpen) {
                            resetForm();
                        }
                        setOpen(newOpen);
                    }}
                    trigger={
                        <MyButton scale="large" buttonType="primary" type="button">
                            Enroll Learner
                        </MyButton>
                    }
                >
                    <form onSubmit={handleSubmit}>
                        <div className="flex flex-col gap-4 py-4">
                            <div className="flex flex-col items-start gap-2">
                                <Label htmlFor="name">Name</Label>
                                <Input
                                    id="name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Learner name"
                                    required
                                />
                            </div>
                            <div className="flex flex-col items-start gap-2">
                                <Label htmlFor="enrollId">Enrollment ID</Label>
                                <Input
                                    id="enrollId"
                                    value={enrollId}
                                    onChange={(e) => setEnrollId(e.target.value)}
                                    placeholder="Enrollment ID"
                                    required
                                />
                            </div>
                            <div className="flex flex-col items-start gap-2">
                                <Label htmlFor="file">
                                    {isEditMode && pdfId
                                        ? 'Replace Response (optional)'
                                        : 'Upload Response (optional)'}
                                </Label>
                                <div className="w-full space-y-2">
                                    {isEditMode && pdfId && (
                                        <div className="text-sm">Current PDF ID: {pdfId}</div>
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
                                                    <Loader2 className="mr-2 size-4 animate-spin" />
                                                    Uploading...
                                                </>
                                            ) : (
                                                'Upload file'
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
                                {isEditMode ? 'Update' : 'Enroll'}
                            </MyButton>
                        </DialogFooter>
                    </form>
                </MyDialog>

                {/* Add Attempt Dialog */}
                <MyDialog
                    heading="Add New Attempt"
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
                                <Label htmlFor="file">Upload Response PDF</Label>
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
                                                    <Loader2 className="mr-2 size-4 animate-spin" />
                                                    Uploading...
                                                </>
                                            ) : (
                                                'Upload file'
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
                                Add Attempt
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
                                    <TableHead className="sticky left-12 z-10 bg-primary-50">
                                        Learner Name
                                    </TableHead>
                                    <TableHead>Enrollment ID</TableHead>
                                    <TableHead>Attempt Count</TableHead>
                                    <TableHead>View PDF</TableHead>
                                    <TableHead className="w-10 text-right">Actions</TableHead>
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
                                                            {student.attempts.length} Attempts
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
                                                                        Attempt {attemptIndex + 1}
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
                                                        View PDF
                                                    </Button>
                                                ) : (
                                                    <span className="text-sm text-muted-foreground">
                                                        No file
                                                    </span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <button className="rounded-full p-1">
                                                            <MoreVertical className="size-4" />
                                                            <span className="sr-only">
                                                                Open menu
                                                            </span>
                                                        </button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem
                                                            onClick={() => handleEdit(index)}
                                                            className="cursor-pointer"
                                                        >
                                                            <Pencil className="mr-2 size-4" />
                                                            Edit
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            onClick={() =>
                                                                openAddAttemptDialog(index)
                                                            }
                                                            className="cursor-pointer"
                                                        >
                                                            <Plus className="mr-2 size-4" />
                                                            Add Attempt
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
                                                                <Trash2 className="mr-2 size-4" />
                                                                Delete Current Attempt
                                                            </DropdownMenuItem>
                                                        )}
                                                        <DropdownMenuItem
                                                            onClick={() => handleDelete(index)}
                                                            className="cursor-pointer text-destructive focus:text-destructive"
                                                        >
                                                            <Trash2 className="mr-2 size-4" />
                                                            Delete Student
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
                        No enrolled students found.
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
                            Submit Selected ({selected.length})
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
