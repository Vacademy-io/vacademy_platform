import { useState, useEffect } from 'react';
import {
    UploadSimple,
    Link,
    Note,
    FilePdf,
    FileDoc,
    FileVideo,
    FileAudio,
    FileImage,
    File,
    DownloadSimple,
    Trash,
    ArrowSquareOut,
    CalendarBlank,
    User,
    X,
    Spinner,
    FolderOpen,
    Eye,
    Gear,
    ArrowClockwise,
    Plus,
    UserCheck,
    UserMinus,
    type Icon as PhosphorIcon,
} from '@phosphor-icons/react';
import { MyButton } from '@/components/design-system/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RichTextEditor } from '@/components/editor/RichTextEditor';
import { useStudentSidebar } from '../../../../-context/selected-student-sidebar-context';
import { toast } from 'sonner';
import { getPublicUrl } from '@/services/upload_file';
import {
    addFileForStudent,
    getStudentFiles,
    deleteSystemFile,
    createHtmlSystemFile,
    detectMediaTypeFromFile,
    grantUserAccess,
    revokeUserAccess,
    getFileAccessDetails,
    type SystemFile,
    type MediaType,
    type FileType,
} from '@/services/system-files';
import { getTerminology } from '@/components/common/layout-container/sidebar/utils';
import { RoleTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';
import { cn } from '@/lib/utils';
import {
    ProfileSectionCard,
    ProfileSkeleton,
    ProfileEmpty,
    ProfileError,
    ProfileHeroStat,
    ProfileActionBar,
} from '../profile-ui';

// ── Media type config ─────────────────────────────────────────────────────────

type MediaTypeConfig = {
    value: MediaType;
    label: string;
    icon: PhosphorIcon;
    /** Token classes for the icon chip */
    chipClass: string;
};

const MEDIA_TYPES: MediaTypeConfig[] = [
    {
        value: 'video',
        label: 'Video',
        icon: FileVideo,
        chipClass: 'bg-primary-50 border-primary-200 text-primary-700',
    },
    {
        value: 'audio',
        label: 'Audio',
        icon: FileAudio,
        chipClass: 'bg-info-50 border-info-200 text-info-700',
    },
    {
        value: 'pdf',
        label: 'PDF Document',
        icon: FilePdf,
        chipClass: 'bg-danger-50 border-danger-200 text-danger-700',
    },
    {
        value: 'doc',
        label: 'Word Document',
        icon: FileDoc,
        chipClass: 'bg-primary-50 border-primary-200 text-primary-700',
    },
    {
        value: 'image',
        label: 'Image',
        icon: FileImage,
        chipClass: 'bg-warning-50 border-warning-200 text-warning-700',
    },
    {
        value: 'note',
        label: 'Note',
        icon: Note,
        chipClass: 'bg-warning-50 border-warning-100 text-warning-700',
    },
    {
        value: 'unknown',
        label: 'Other',
        icon: File,
        chipClass: 'bg-neutral-100 border-neutral-200 text-neutral-600',
    },
];

const mediaTypeMap = Object.fromEntries(
    MEDIA_TYPES.map((m) => [m.value, m])
) as Record<MediaType, MediaTypeConfig>;

// ── File type tabs ─────────────────────────────────────────────────────────────

type FileTypeTab = 'File' | 'Url' | 'Note';

// ── Grouped files by folder ────────────────────────────────────────────────────

type GroupedFiles = {
    [folderName: string]: SystemFile[];
};

// ── Helper: icon for media type ────────────────────────────────────────────────

const MediaIcon = ({
    mediaType,
    className,
}: {
    mediaType: MediaType;
    className?: string;
}) => {
    const cfg = mediaTypeMap[mediaType] ?? mediaTypeMap.unknown;
    const Icon = cfg.icon;
    return <Icon className={className ?? 'size-5'} />;
};

// ── Helper: format date ────────────────────────────────────────────────────────

const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
};

// ── Helper: group files by folder (case-insensitive) ──────────────────────────

const groupFilesByFolder = (files: SystemFile[]): GroupedFiles => {
    const grouped: GroupedFiles = {};
    files.forEach((file) => {
        const folder = file.folder_name || 'Uncategorized';
        const folderKey = folder.toLowerCase();
        if (!grouped[folderKey]) {
            grouped[folderKey] = [];
        }
        grouped[folderKey]?.push(file);
    });
    return grouped;
};

// ── File row ───────────────────────────────────────────────────────────────────

const FileRow = ({
    file,
    onView,
    onDownload,
    onManageAccess,
    onDelete,
}: {
    file: SystemFile;
    onView: (f: SystemFile) => void;
    onDownload: (f: SystemFile) => void;
    onManageAccess: (f: SystemFile) => void;
    onDelete: (id: string) => void;
}) => {
    const cfg = mediaTypeMap[file.media_type] ?? mediaTypeMap.unknown;

    return (
        <div className="group flex items-center gap-3 rounded-lg border border-neutral-200 bg-white p-3 transition-shadow hover:shadow-sm">
            {/* Type chip */}
            <span
                className={cn(
                    'flex size-9 shrink-0 items-center justify-center rounded-md border',
                    cfg.chipClass
                )}
            >
                <MediaIcon mediaType={file.media_type} className="size-4" />
            </span>

            {/* Name + meta */}
            <div className="min-w-0 flex-1">
                <p
                    className="truncate text-sm font-medium text-neutral-800"
                    title={file.name}
                >
                    {file.name}
                </p>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-neutral-500">
                    <span className="capitalize">{file.media_type}</span>
                    <span aria-hidden>·</span>
                    <span className="flex items-center gap-1">
                        <User className="size-3" />
                        {file.created_by}
                    </span>
                    <span aria-hidden>·</span>
                    <span className="flex items-center gap-1">
                        <CalendarBlank className="size-3" />
                        {formatDate(file.created_at_iso)}
                    </span>
                </div>
            </div>

            {/* Row actions — visible on hover, always accessible via keyboard */}
            <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                {file.file_type === 'Html' ? (
                    <MyButton
                        buttonType="text"
                        scale="small"
                        onClick={(e) => {
                            e.stopPropagation();
                            onView(file);
                        }}
                        title="View Note"
                    >
                        <Eye className="size-3.5" />
                    </MyButton>
                ) : (
                    <MyButton
                        buttonType="text"
                        scale="small"
                        onClick={(e) => {
                            e.stopPropagation();
                            onDownload(file);
                        }}
                        title={file.file_type === 'File' ? 'Download' : 'Open Link'}
                    >
                        {file.file_type === 'File' ? (
                            <DownloadSimple className="size-3.5" />
                        ) : (
                            <ArrowSquareOut className="size-3.5" />
                        )}
                    </MyButton>
                )}
                <MyButton
                    buttonType="text"
                    scale="small"
                    onClick={(e) => {
                        e.stopPropagation();
                        onManageAccess(file);
                    }}
                    title="Manage Access"
                >
                    <Gear className="size-3.5" />
                </MyButton>
                <MyButton
                    buttonType="text"
                    scale="small"
                    onClick={(e) => {
                        e.stopPropagation();
                        onDelete(file.id);
                    }}
                    title="Delete"
                >
                    <Trash className="size-3.5 text-danger-500" />
                </MyButton>
            </div>
        </div>
    );
};

// ── Main component ─────────────────────────────────────────────────────────────

export const StudentFiles = () => {
    const { selectedStudent } = useStudentSidebar();

    // Dialog state
    const [showAddDialog, setShowAddDialog] = useState(false);
    const [fileTypeTab, setFileTypeTab] = useState<FileTypeTab>('File');

    // Form state
    const [fileName, setFileName] = useState('');
    const [fileUrl, setFileUrl] = useState('');
    const [folderName, setFolderName] = useState('');
    const [isFolderNameReadonly, setIsFolderNameReadonly] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [mediaType, setMediaType] = useState<MediaType>('unknown');
    const [htmlContent, setHtmlContent] = useState('');
    const [grantEditAccess, setGrantEditAccess] = useState(false);

    // Loading / error states
    const [isUploading, setIsUploading] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [loadError, setLoadError] = useState(false);

    // Files data
    const [files, setFiles] = useState<SystemFile[]>([]);

    // View note dialog state
    const [showViewNoteDialog, setShowViewNoteDialog] = useState(false);
    const [viewingNote, setViewingNote] = useState<SystemFile | null>(null);

    // Delete confirmation dialog state
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [fileToDelete, setFileToDelete] = useState<string | null>(null);

    // Access management dialog state
    const [showAccessDialog, setShowAccessDialog] = useState(false);
    const [editingFile, setEditingFile] = useState<SystemFile | null>(null);
    const [hasViewAccess, setHasViewAccess] = useState(false);
    const [hasEditAccess, setHasEditAccess] = useState(false);
    const [isLoadingAccess, setIsLoadingAccess] = useState(false);

    // Load student files
    const loadStudentFiles = async () => {
        if (!selectedStudent?.user_id || !selectedStudent?.institute_id) {
            return;
        }

        try {
            setIsLoading(true);
            setLoadError(false);
            console.log('selectedStudent:', selectedStudent);
            const response = await getStudentFiles(
                selectedStudent.user_id,
                selectedStudent.institute_id
            );
            setFiles(response);
        } catch (error) {
            console.error('Error loading student files:', error);
            setLoadError(true);
            toast.error('Failed to load student files');
        } finally {
            setIsLoading(false);
        }
    };

    // Load files on mount and when student changes
    useEffect(() => {
        loadStudentFiles();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedStudent?.user_id, selectedStudent?.institute_id]);

    // Handle file selection with auto-detect media type
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedFile(file);
            const detectedType = detectMediaTypeFromFile(file);
            setMediaType(detectedType);
            if (!fileName) {
                const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
                setFileName(nameWithoutExt);
            }
        }
    };

    // Handle add file submission
    const handleAddFile = async () => {
        if (!selectedStudent?.user_id || !selectedStudent?.institute_id) {
            toast.error('No student selected');
            return;
        }

        if (!fileName.trim()) {
            toast.error('Please enter a file name');
            return;
        }

        try {
            setIsUploading(true);

            const fileData: {
                name: string;
                folder_name?: string;
                media_type: MediaType;
                url?: string;
                file_type?: FileType;
            } = {
                name: fileName,
                folder_name: folderName || undefined,
                media_type: fileTypeTab === 'Note' ? 'note' : mediaType,
            };

            if (fileTypeTab === 'File') {
                if (!selectedFile) {
                    toast.error('Please select a file');
                    return;
                }
                fileData.file_type = 'File';
                await addFileForStudent(
                    selectedFile,
                    selectedStudent.user_id,
                    selectedStudent.institute_id,
                    fileData,
                    setIsUploading
                );
                toast.success('File uploaded successfully');
            } else if (fileTypeTab === 'Url') {
                if (!fileUrl.trim()) {
                    toast.error('Please enter a URL');
                    return;
                }
                fileData.file_type = 'Url';
                fileData.url = fileUrl;
                await addFileForStudent(
                    null,
                    selectedStudent.user_id,
                    selectedStudent.institute_id,
                    fileData,
                    setIsUploading
                );
                toast.success('URL added successfully');
            } else if (fileTypeTab === 'Note') {
                if (!htmlContent.trim()) {
                    toast.error('Please enter note content');
                    return;
                }
                await createHtmlSystemFile(
                    selectedStudent.institute_id,
                    {
                        html: htmlContent,
                        name: fileName,
                        folder_name: folderName || undefined,
                        view_access: [
                            {
                                level: 'user',
                                level_id: selectedStudent.user_id,
                            },
                        ],
                        edit_access: grantEditAccess
                            ? [
                                  {
                                      level: 'user',
                                      level_id: selectedStudent.user_id,
                                  },
                                  {
                                      level: 'role',
                                      level_id: 'Admin',
                                  },
                              ]
                            : [
                                  {
                                      level: 'role',
                                      level_id: 'Admin',
                                  },
                              ],
                    },
                    selectedStudent.user_id
                );
                toast.success('Note created successfully');
            }

            await loadStudentFiles();
            setShowAddDialog(false);
            resetForm();
        } catch (error) {
            console.error('Error adding file:', error);
            toast.error('Failed to add file');
        } finally {
            setIsUploading(false);
        }
    };

    // Handle delete file
    const handleDeleteFile = async (fileId: string) => {
        if (!selectedStudent?.institute_id) return;
        try {
            await deleteSystemFile(fileId, selectedStudent.institute_id);
            toast.success('File deleted successfully');
            await loadStudentFiles();
        } catch (error) {
            console.error('Error deleting file:', error);
            toast.error('Failed to delete file');
        } finally {
            setShowDeleteDialog(false);
            setFileToDelete(null);
        }
    };

    // Handle delete click
    const handleDeleteClick = (fileId: string) => {
        setFileToDelete(fileId);
        setShowDeleteDialog(true);
    };

    // Handle refresh files
    const handleRefresh = async () => {
        setIsRefreshing(true);
        await loadStudentFiles();
        setIsRefreshing(false);
        toast.success('Files refreshed');
    };

    // Handle view note
    const handleViewNote = (file: SystemFile) => {
        setViewingNote(file);
        setShowViewNoteDialog(true);
    };

    // Handle manage access
    const handleManageAccess = async (file: SystemFile) => {
        if (!selectedStudent?.user_id || !selectedStudent?.institute_id) return;
        try {
            setIsLoadingAccess(true);
            setEditingFile(file);
            setShowAccessDialog(true);
            const fileDetails = await getFileAccessDetails(file.id, selectedStudent.institute_id);
            const studentViewAccess = fileDetails.access_list.some(
                (access) =>
                    access.level === 'user' &&
                    access.level_id === selectedStudent.user_id &&
                    access.access_type === 'view'
            );
            const studentEditAccess = fileDetails.access_list.some(
                (access) =>
                    access.level === 'user' &&
                    access.level_id === selectedStudent.user_id &&
                    access.access_type === 'edit'
            );
            setHasViewAccess(studentViewAccess);
            setHasEditAccess(studentEditAccess);
        } catch (error) {
            console.error('Error loading file access:', error);
            toast.error('Failed to load file access details');
            setShowAccessDialog(false);
        } finally {
            setIsLoadingAccess(false);
        }
    };

    // Handle toggle view access
    const handleToggleViewAccess = async () => {
        if (!editingFile || !selectedStudent?.user_id || !selectedStudent?.institute_id) return;
        try {
            setIsLoadingAccess(true);
            if (hasViewAccess) {
                await revokeUserAccess(
                    editingFile.id,
                    selectedStudent.user_id,
                    'view',
                    selectedStudent.institute_id
                );
                setHasViewAccess(false);
                toast.success('View access revoked');
            } else {
                await grantUserAccess(
                    editingFile.id,
                    selectedStudent.user_id,
                    'view',
                    selectedStudent.institute_id
                );
                setHasViewAccess(true);
                toast.success('View access granted');
            }
            await loadStudentFiles();
        } catch (error) {
            console.error('Error toggling view access:', error);
            toast.error('Failed to update view access');
        } finally {
            setIsLoadingAccess(false);
        }
    };

    // Handle toggle edit access
    const handleToggleEditAccess = async () => {
        if (!editingFile || !selectedStudent?.user_id || !selectedStudent?.institute_id) return;
        try {
            setIsLoadingAccess(true);
            if (hasEditAccess) {
                await revokeUserAccess(
                    editingFile.id,
                    selectedStudent.user_id,
                    'edit',
                    selectedStudent.institute_id
                );
                setHasEditAccess(false);
                toast.success('Edit access revoked');
            } else {
                await grantUserAccess(
                    editingFile.id,
                    selectedStudent.user_id,
                    'edit',
                    selectedStudent.institute_id
                );
                setHasEditAccess(true);
                toast.success('Edit access granted');
            }
            await loadStudentFiles();
        } catch (error) {
            console.error('Error toggling edit access:', error);
            toast.error('Failed to update edit access');
        } finally {
            setIsLoadingAccess(false);
        }
    };

    // Handle file download/open
    const handleFileDownload = async (file: SystemFile) => {
        try {
            if (file.file_type === 'File') {
                const publicUrl = await getPublicUrl(file.data);
                if (publicUrl) {
                    window.open(publicUrl, '_blank');
                } else {
                    toast.error('Failed to get file URL');
                }
            } else if (file.file_type === 'Url') {
                window.open(file.data, '_blank');
            }
        } catch (error) {
            console.error('Error opening file:', error);
            toast.error('Failed to open file');
        }
    };

    // Reset form
    const resetForm = () => {
        setFileName('');
        setFileUrl('');
        setFolderName('');
        setIsFolderNameReadonly(false);
        setHtmlContent('');
        setSelectedFile(null);
        setMediaType('unknown');
        setFileTypeTab('File');
        setGrantEditAccess(false);
    };

    // Open add dialog (used by empty-state CTA and header buttons)
    const openAddDialog = (tab: FileTypeTab, preset?: { folderName: string }) => {
        setFileTypeTab(tab);
        if (preset?.folderName) {
            setFolderName(preset.folderName);
            setIsFolderNameReadonly(true);
        }
        setShowAddDialog(true);
    };

    const groupedFiles = groupFilesByFolder(files);
    const folderNames = Object.keys(groupedFiles).sort();

    // ── Derived stats ──────────────────────────────────────────────────────────

    const totalFiles = files.length;
    const totalFolders = folderNames.length;
    // "Recent uploads" = files created in the last 7 days
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recentCount = files.filter(
        (f) => new Date(f.created_at_iso).getTime() >= sevenDaysAgo
    ).length;

    // ── Body content ───────────────────────────────────────────────────────────

    let body: React.ReactNode;

    if (isLoading) {
        body = <ProfileSkeleton blocks={3} />;
    } else if (loadError) {
        body = (
            <ProfileError
                title="Couldn't load files"
                hint="Something went wrong while fetching the student's files."
                onRetry={loadStudentFiles}
            />
        );
    } else if (files.length === 0) {
        body = (
            <ProfileEmpty
                icon={File}
                title="No files yet"
                hint="Upload a file, add a URL, or create a note for this student."
                action={
                    <MyButton
                        buttonType="secondary"
                        scale="small"
                        onClick={(e) => {
                            e.stopPropagation();
                            openAddDialog('File');
                        }}
                    >
                        <Plus className="size-3.5" />
                        Add First File
                    </MyButton>
                }
            />
        );
    } else {
        body = (
            <div className="flex flex-col gap-4">
                {folderNames.map((folderKey) => {
                    const folderFiles = groupedFiles[folderKey];
                    // @ts-expect-error : Ignore TS error for folder_name
                    const displayFolderName = folderFiles[0]?.folder_name || 'Uncategorized';

                    return (
                        <ProfileSectionCard
                            key={folderKey}
                            icon={FolderOpen}
                            heading={displayFolderName}
                            action={
                                <MyButton
                                    buttonType="text"
                                    scale="small"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        openAddDialog('File', {
                                            folderName: displayFolderName,
                                        });
                                    }}
                                >
                                    <Plus className="size-3.5" />
                                    <span className="text-xs">Add to folder</span>
                                </MyButton>
                            }
                            bodyClassName="flex flex-col gap-2"
                        >
                            {/* File count badge */}
                            <p className="mb-1 text-xs text-neutral-500">
                                {folderFiles?.length}{' '}
                                {folderFiles?.length === 1 ? 'file' : 'files'}
                            </p>

                            {folderFiles?.map((file) => (
                                <FileRow
                                    key={file.id}
                                    file={file}
                                    onView={handleViewNote}
                                    onDownload={handleFileDownload}
                                    onManageAccess={handleManageAccess}
                                    onDelete={handleDeleteClick}
                                />
                            ))}
                        </ProfileSectionCard>
                    );
                })}
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4 p-4">
            {/* ── Hero stats row ─────────────────────────────────────────────── */}
            <div className="flex gap-3">
                <ProfileHeroStat
                    label="Total Files"
                    value={totalFiles}
                    tone="primary"
                    icon={File}
                />
                <ProfileHeroStat
                    label="Folders"
                    value={totalFolders}
                    tone="neutral"
                    icon={FolderOpen}
                />
                <ProfileHeroStat
                    label="Recent (7d)"
                    value={recentCount}
                    tone={recentCount > 0 ? 'success' : 'neutral'}
                    icon={CalendarBlank}
                />
            </div>

            {/* ── Primary action bar ─────────────────────────────────────────── */}
            <ProfileActionBar>
                <MyButton
                    buttonType="primary"
                    scale="small"
                    onClick={(e) => {
                        e.stopPropagation();
                        openAddDialog('File');
                    }}
                >
                    <UploadSimple className="size-3.5" />
                    Upload File
                </MyButton>
                <MyButton
                    buttonType="secondary"
                    scale="small"
                    onClick={(e) => {
                        e.stopPropagation();
                        openAddDialog('Url');
                    }}
                >
                    <Link className="size-3.5" />
                    Add Link
                </MyButton>
                <MyButton
                    buttonType="secondary"
                    scale="small"
                    onClick={(e) => {
                        e.stopPropagation();
                        openAddDialog('Note');
                    }}
                >
                    <Note className="size-3.5" />
                    Add Note
                </MyButton>
                <MyButton
                    buttonType="text"
                    scale="small"
                    onClick={handleRefresh}
                    disable={isRefreshing || isLoading}
                    title="Refresh files"
                >
                    <ArrowClockwise className={cn('size-3.5', isRefreshing && 'animate-spin')} />
                </MyButton>
            </ProfileActionBar>

            {body}

            {/* ── Add File Dialog ──────────────────────────────────────────── */}
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                <DialogContent className="overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-sm font-semibold">
                            Add File for{' '}
                            {getTerminology(RoleTerms.Learner, SystemTerms.Learner)}
                        </DialogTitle>
                        <DialogDescription>
                            Upload a file, add a URL, or create a note for this{' '}
                            {getTerminology(
                                RoleTerms.Learner,
                                SystemTerms.Learner
                            ).toLocaleLowerCase()}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex flex-col gap-4 py-2">
                        {/* File Type Tabs */}
                        <Tabs
                            value={fileTypeTab}
                            onValueChange={(v) => setFileTypeTab(v as FileTypeTab)}
                        >
                            <TabsList className="grid w-full grid-cols-3">
                                <TabsTrigger value="File">
                                    <UploadSimple className="mr-2 size-4" />
                                    File
                                </TabsTrigger>
                                <TabsTrigger value="Url">
                                    <Link className="mr-2 size-4" />
                                    URL
                                </TabsTrigger>
                                <TabsTrigger value="Note">
                                    <Note className="mr-2 size-4" />
                                    Note
                                </TabsTrigger>
                            </TabsList>

                            {/* File Upload Tab */}
                            <TabsContent value="File" className="flex flex-col gap-3">
                                <div className="flex flex-col gap-1.5">
                                    <Label htmlFor="file-upload" className="text-xs font-medium text-neutral-700">
                                        Select File *
                                    </Label>
                                    <div className="flex items-center gap-2">
                                        <Input
                                            id="file-upload"
                                            type="file"
                                            onChange={handleFileSelect}
                                            className="flex-1"
                                        />
                                        {selectedFile && (
                                            <MyButton
                                                buttonType="text"
                                                scale="small"
                                                onClick={() => {
                                                    setSelectedFile(null);
                                                    setMediaType('unknown');
                                                }}
                                            >
                                                <X className="size-4" />
                                            </MyButton>
                                        )}
                                    </div>
                                    {selectedFile && (
                                        <p className="text-xs text-neutral-500">
                                            Selected: {selectedFile.name} (
                                            {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)
                                        </p>
                                    )}
                                </div>

                                <div className="flex flex-col gap-1.5">
                                    <Label htmlFor="media-type" className="text-xs font-medium text-neutral-700">
                                        Media Type *
                                    </Label>
                                    <Select
                                        value={mediaType}
                                        onValueChange={(v) => setMediaType(v as MediaType)}
                                    >
                                        <SelectTrigger id="media-type">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {MEDIA_TYPES.map((type) => {
                                                const Icon = type.icon;
                                                return (
                                                    <SelectItem key={type.value} value={type.value}>
                                                        <div className="flex items-center gap-2">
                                                            <Icon className="size-4" />
                                                            {type.label}
                                                        </div>
                                                    </SelectItem>
                                                );
                                            })}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </TabsContent>

                            {/* URL Tab */}
                            <TabsContent value="Url" className="flex flex-col gap-3">
                                <div className="flex flex-col gap-1.5">
                                    <Label htmlFor="file-url" className="text-xs font-medium text-neutral-700">
                                        URL *
                                    </Label>
                                    <Input
                                        id="file-url"
                                        type="url"
                                        placeholder="https://example.com/resource"
                                        value={fileUrl}
                                        onChange={(e) => setFileUrl(e.target.value)}
                                    />
                                    <p className="text-xs text-neutral-500">
                                        Enter a valid URL to an external resource
                                    </p>
                                </div>

                                <div className="flex flex-col gap-1.5">
                                    <Label htmlFor="url-media-type" className="text-xs font-medium text-neutral-700">
                                        Media Type *
                                    </Label>
                                    <Select
                                        value={mediaType}
                                        onValueChange={(v) => setMediaType(v as MediaType)}
                                    >
                                        <SelectTrigger id="url-media-type">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {MEDIA_TYPES.map((type) => {
                                                const Icon = type.icon;
                                                return (
                                                    <SelectItem key={type.value} value={type.value}>
                                                        <div className="flex items-center gap-2">
                                                            <Icon className="size-4" />
                                                            {type.label}
                                                        </div>
                                                    </SelectItem>
                                                );
                                            })}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </TabsContent>

                            {/* Note Tab */}
                            <TabsContent value="Note" className="flex flex-col gap-3">
                                <div className="flex flex-col gap-1.5">
                                    <Label htmlFor="note-content" className="text-xs font-medium text-neutral-700">
                                        Note Content *
                                    </Label>
                                    <div className="rounded-lg border border-neutral-200">
                                        <RichTextEditor
                                            value={htmlContent}
                                            onChange={setHtmlContent}
                                            placeholder="Write your note here..."
                                        />
                                    </div>
                                    <p className="text-xs text-neutral-500">
                                        Create a rich text note for this student
                                    </p>
                                </div>
                            </TabsContent>
                        </Tabs>

                        {/* Common Fields */}
                        <div className="flex flex-col gap-3 border-t border-neutral-200 pt-4">
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="file-name" className="text-xs font-medium text-neutral-700">
                                    File Name *
                                </Label>
                                <Input
                                    id="file-name"
                                    type="text"
                                    placeholder="e.g., Tutorial Video - React Basics"
                                    value={fileName}
                                    onChange={(e) => setFileName(e.target.value)}
                                />
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="folder-name" className="text-xs font-medium text-neutral-700">
                                    Folder Name
                                    {isFolderNameReadonly && (
                                        <Badge variant="secondary" className="ml-2 text-xs">
                                            Pre-selected
                                        </Badge>
                                    )}
                                </Label>
                                <Input
                                    id="folder-name"
                                    type="text"
                                    placeholder="e.g., Assignments, Certificates, Resources"
                                    value={folderName}
                                    onChange={(e) => setFolderName(e.target.value)}
                                    readOnly={isFolderNameReadonly}
                                    className={cn(
                                        isFolderNameReadonly &&
                                            'cursor-not-allowed bg-neutral-100'
                                    )}
                                />
                                <p className="text-xs text-neutral-500">
                                    {isFolderNameReadonly
                                        ? 'Adding file to selected folder'
                                        : 'Optional: Organize files into folders (case-insensitive)'}
                                </p>
                            </div>

                            {/* Access Permissions */}
                            <div className="flex items-center gap-2">
                                <Checkbox
                                    id="edit-access"
                                    checked={grantEditAccess}
                                    onCheckedChange={(checked) =>
                                        setGrantEditAccess(checked as boolean)
                                    }
                                />
                                <label
                                    htmlFor="edit-access"
                                    className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                >
                                    Also grant edit access to the student
                                </label>
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="gap-2">
                        <MyButton
                            buttonType="secondary"
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowAddDialog(false);
                                resetForm();
                            }}
                            disable={isUploading}
                        >
                            Cancel
                        </MyButton>
                        <MyButton
                            onClick={(e) => {
                                e.stopPropagation();
                                handleAddFile();
                            }}
                            disable={
                                isUploading ||
                                !fileName.trim() ||
                                (fileTypeTab === 'File' && !selectedFile) ||
                                (fileTypeTab === 'Url' && !fileUrl.trim()) ||
                                (fileTypeTab === 'Note' && !htmlContent.trim())
                            }
                        >
                            {isUploading ? (
                                <>
                                    <Spinner className="mr-2 size-4 animate-spin" />
                                    {fileTypeTab === 'File' ? 'Uploading...' : 'Adding...'}
                                </>
                            ) : (
                                <>
                                    <Plus className="mr-2 size-4" />
                                    Add {fileTypeTab}
                                </>
                            )}
                        </MyButton>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── View Note Dialog ─────────────────────────────────────────── */}
            <Dialog open={showViewNoteDialog} onOpenChange={setShowViewNoteDialog}>
                <DialogContent className="overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
                            <Note className="size-4" />
                            {viewingNote?.name || 'View Note'}
                        </DialogTitle>
                        <DialogDescription>
                            View the note content for this student
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex flex-col gap-3 py-2">
                        <div className="rounded-lg border border-neutral-200 bg-white p-4">
                            {viewingNote ? (
                                <div
                                    className="prose prose-sm max-w-none"
                                    dangerouslySetInnerHTML={{ __html: viewingNote.data }}
                                />
                            ) : (
                                <p className="text-sm text-neutral-500">No content available</p>
                            )}
                        </div>
                    </div>

                    <DialogFooter>
                        <MyButton
                            buttonType="secondary"
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowViewNoteDialog(false);
                                setViewingNote(null);
                            }}
                        >
                            Close
                        </MyButton>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Delete Confirmation Dialog ───────────────────────────────── */}
            <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
                            <Trash className="size-4 text-danger-600" />
                            Delete File
                        </DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete this file? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>

                    <DialogFooter className="gap-2">
                        <MyButton
                            buttonType="secondary"
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowDeleteDialog(false);
                                setFileToDelete(null);
                            }}
                        >
                            Cancel
                        </MyButton>
                        <MyButton
                            buttonType="primary"
                            onClick={(e) => {
                                e.stopPropagation();
                                fileToDelete && handleDeleteFile(fileToDelete);
                            }}
                        >
                            <Trash className="mr-2 size-4" />
                            Delete
                        </MyButton>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Manage Access Dialog ─────────────────────────────────────── */}
            <Dialog open={showAccessDialog} onOpenChange={setShowAccessDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
                            <Gear className="size-4 text-primary-600" />
                            Manage{' '}
                            {getTerminology(RoleTerms.Learner, SystemTerms.Learner)} Access
                        </DialogTitle>
                        <DialogDescription>
                            Control what access the student has to this file
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex flex-col gap-4 py-2">
                        {isLoadingAccess ? (
                            <div className="flex items-center justify-center py-8">
                                <Spinner className="size-6 animate-spin text-neutral-400" />
                            </div>
                        ) : (
                            <>
                                {/* File Info */}
                                <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
                                    <div className="flex items-center gap-3">
                                        <span
                                            className={cn(
                                                'flex size-9 items-center justify-center rounded-md border',
                                                editingFile
                                                    ? (mediaTypeMap[editingFile.media_type] ??
                                                          mediaTypeMap.unknown).chipClass
                                                    : 'bg-neutral-100 border-neutral-200'
                                            )}
                                        >
                                            {editingFile && (
                                                <MediaIcon
                                                    mediaType={editingFile.media_type}
                                                    className="size-4"
                                                />
                                            )}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <p
                                                className="truncate text-sm font-medium text-neutral-800"
                                                title={editingFile?.name}
                                            >
                                                {editingFile?.name}
                                            </p>
                                            <p className="text-xs text-neutral-500">
                                                {editingFile?.file_type} ·{' '}
                                                {editingFile?.media_type.toUpperCase()}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Student Info */}
                                <div className="rounded-lg border border-primary-100 bg-primary-50 p-3">
                                    <div className="flex items-center gap-2">
                                        <User className="size-4 text-primary-600" />
                                        <span className="text-sm font-medium text-primary-900">
                                            {selectedStudent?.full_name}
                                        </span>
                                    </div>
                                </div>

                                {/* Access Controls */}
                                <div className="flex flex-col gap-2">
                                    {/* View access row */}
                                    <div className="flex items-center justify-between rounded-lg border border-neutral-200 p-3 hover:bg-neutral-50">
                                        <div className="flex items-center gap-3">
                                            <UserCheck className="size-5 text-success-600" />
                                            <div>
                                                <p className="text-sm font-medium text-neutral-800">
                                                    View Access
                                                </p>
                                                <p className="text-xs text-neutral-500">
                                                    {getTerminology(
                                                        RoleTerms.Learner,
                                                        SystemTerms.Learner
                                                    )}{' '}
                                                    can view this file
                                                </p>
                                            </div>
                                        </div>
                                        <MyButton
                                            buttonType={hasViewAccess ? 'primary' : 'secondary'}
                                            scale="small"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleToggleViewAccess();
                                            }}
                                            disable={isLoadingAccess}
                                        >
                                            {hasViewAccess ? 'Revoke' : 'Grant'}
                                        </MyButton>
                                    </div>

                                    {/* Edit access row */}
                                    <div className="flex items-center justify-between rounded-lg border border-neutral-200 p-3 hover:bg-neutral-50">
                                        <div className="flex items-center gap-3">
                                            <UserMinus className="size-5 text-warning-600" />
                                            <div>
                                                <p className="text-sm font-medium text-neutral-800">
                                                    Edit Access
                                                </p>
                                                <p className="text-xs text-neutral-500">
                                                    {getTerminology(
                                                        RoleTerms.Learner,
                                                        SystemTerms.Learner
                                                    )}{' '}
                                                    can edit this file
                                                </p>
                                            </div>
                                        </div>
                                        <MyButton
                                            buttonType={hasEditAccess ? 'primary' : 'secondary'}
                                            scale="small"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleToggleEditAccess();
                                            }}
                                            disable={isLoadingAccess}
                                        >
                                            {hasEditAccess ? 'Revoke' : 'Grant'}
                                        </MyButton>
                                    </div>
                                </div>

                                {/* Help Text */}
                                <div className="rounded-lg bg-neutral-50 p-3 text-xs text-neutral-500">
                                    <p>Edit access will allow the student to modify the file.</p>
                                </div>
                            </>
                        )}
                    </div>

                    <DialogFooter>
                        <MyButton
                            buttonType="secondary"
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowAccessDialog(false);
                                setEditingFile(null);
                            }}
                        >
                            Close
                        </MyButton>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};
