import { useState, useEffect } from 'react';
import {
    Plus,
    Upload,
    Link2,
    FileText,
    Video,
    Music,
    Image as ImageIcon,
    File,
    Download,
    Trash2,
    ExternalLink,
    Calendar,
    User,
    X,
    Loader2,
    StickyNote,
    Folder,
    Eye,
    RefreshCw,
    Settings,
    UserCheck,
    UserX,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { Card } from '@/components/ui/card';
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

// Media type options for manual selection
const MEDIA_TYPES: {
    value: MediaType;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
}[] = [
    { value: 'video', label: 'Video', icon: Video },
    { value: 'audio', label: 'Audio', icon: Music },
    { value: 'pdf', label: 'PDF Document', icon: FileText },
    { value: 'doc', label: 'Word Document', icon: FileText },
    { value: 'image', label: 'Image', icon: ImageIcon },
    { value: 'note', label: 'Note', icon: StickyNote },
    { value: 'unknown', label: 'Other', icon: File },
];

// File type tabs
type FileTypeTab = 'File' | 'Url' | 'Note';

// Grouped files by folder
type GroupedFiles = {
    [folderName: string]: SystemFile[];
};

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

    // Loading states
    const [isUploading, setIsUploading] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

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

    // Helper function to get media icon
    const getMediaIcon = (mediaType: MediaType) => {
        const iconMap: Record<MediaType, React.ComponentType<{ className?: string }>> = {
            video: Video,
            audio: Music,
            pdf: FileText,
            doc: FileText,
            image: ImageIcon,
            note: StickyNote,
            unknown: File,
        };
        const Icon = iconMap[mediaType] || File;
        return <Icon className="size-5" />;
    };

    // Helper function to get media type color
    const getMediaTypeColor = (mediaType: MediaType) => {
        const colorMap: Record<MediaType, string> = {
            video: 'bg-purple-50 border-purple-200 text-purple-700',
            audio: 'bg-green-50 border-green-200 text-green-700',
            pdf: 'bg-red-50 border-red-200 text-red-700',
            doc: 'bg-blue-50 border-blue-200 text-blue-700',
            image: 'bg-yellow-50 border-yellow-200 text-yellow-700',
            note: 'bg-orange-50 border-orange-200 text-orange-700',
            unknown: 'bg-gray-50 border-gray-200 text-gray-700',
        };
        return colorMap[mediaType] || colorMap.unknown;
    };

    // Format date helper
    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    // Group files by folder (case-insensitive)
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

    // Load student files
    const loadStudentFiles = async () => {
        if (!selectedStudent?.user_id || !selectedStudent?.institute_id) {
            return;
        }

        try {
            setIsLoading(true);
            console.log('selectedStudent:', selectedStudent);
            const response = await getStudentFiles(
                selectedStudent.user_id,
                selectedStudent.institute_id
            );
            setFiles(response);
        } catch (error) {
            console.error('Error loading student files:', error);
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
            // Auto-detect media type from file
            const detectedType = detectMediaTypeFromFile(file);
            setMediaType(detectedType);

            // Auto-fill filename if empty
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

            // Prepare file data based on tab type
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
                // File upload
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
                // URL upload
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
                // HTML note creation - use direct API call instead of addFileForStudent
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
                    selectedStudent.user_id // Pass studentId for notification
                );

                toast.success('Note created successfully');
            }

            // Reload files and close dialog
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

    // Handle delete click (show confirmation)
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

            // Get file access details
            const fileDetails = await getFileAccessDetails(file.id, selectedStudent.institute_id);

            // Check if student has view or edit access
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
                // For uploaded files, get public URL from S3 using file ID
                const publicUrl = await getPublicUrl(file.data);
                if (publicUrl) {
                    window.open(publicUrl, '_blank');
                } else {
                    toast.error('Failed to get file URL');
                }
            } else if (file.file_type === 'Url') {
                // For URL type, directly open the URL stored in data field
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

    // Group files by folder
    const groupedFiles = groupFilesByFolder(files);
    const folderNames = Object.keys(groupedFiles).sort();

    return (
        <div className="space-y-4 p-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <MyButton
                        onClick={(e) => {
                            e.stopPropagation();
                            setFileTypeTab('File');
                            setShowAddDialog(true);
                        }}
                        buttonType="primary"
                    >
                        <Upload className="mr-2 size-4" />
                        File
                    </MyButton>
                    <MyButton
                        onClick={(e) => {
                            e.stopPropagation();
                            setFileTypeTab('Url');
                            setShowAddDialog(true);
                        }}
                        buttonType="secondary"
                    >
                        <Link2 className="mr-2 size-4" />
                        URL
                    </MyButton>
                    <MyButton
                        onClick={(e) => {
                            e.stopPropagation();
                            setFileTypeTab('Note');
                            setShowAddDialog(true);
                        }}
                        buttonType="secondary"
                    >
                        <StickyNote className="mr-2 size-4" />
                        Note
                    </MyButton>
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={handleRefresh}
                        disabled={isRefreshing || isLoading}
                        className="gap-2"
                    >
                        <RefreshCw className={`size-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                    </Button>
                </div>
            </div>

            {/* Loading State */}
            {isLoading ? (
                <Card className="p-12">
                    <div className="flex flex-col items-center justify-center text-center">
                        <Loader2 className="mb-4 size-8 animate-spin text-gray-400" />
                        <p className="text-sm text-gray-600">Loading files...</p>
                    </div>
                </Card>
            ) : files.length === 0 ? (
                /* Empty State */
                <Card className="border-2 border-dashed border-gray-300 bg-gray-50 p-12">
                    <div className="flex flex-col items-center justify-center text-center">
                        <div className="mb-4 rounded-full bg-gray-200 p-4">
                            <FileText className="size-8 text-gray-400" />
                        </div>
                        <h4 className="mb-2 text-lg font-medium text-gray-900">No files yet</h4>
                        <p className="mb-4 text-sm text-gray-600">
                            Start by adding files, documents, or links for this student
                        </p>
                        <MyButton
                            onClick={(e) => {
                                e.stopPropagation();
                                setFileTypeTab('File');
                                setShowAddDialog(true);
                            }}
                            buttonType="secondary"
                        >
                            <Plus className="mr-2 size-4" />
                            Add First File
                        </MyButton>
                    </div>
                </Card>
            ) : (
                /* Files List Grouped by Folder */
                <div className="space-y-6">
                    {folderNames.map((folderKey) => {
                        const folderFiles = groupedFiles[folderKey];
                        // @ts-expect-error : Ignore TS error for folder_name
                        const displayFolderName = folderFiles[0]?.folder_name || 'Uncategorized';

                        return (
                            <div key={folderKey} className="space-y-3">
                                {/* Folder Header */}
                                <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                                    <div className="flex items-center gap-2">
                                        <Folder className="size-5 text-gray-600" />
                                        <h4 className="font-semibold text-gray-900">
                                            {displayFolderName}
                                        </h4>
                                        <Badge variant="secondary" className="ml-2">
                                            {folderFiles?.length}{' '}
                                            {folderFiles?.length === 1 ? 'file' : 'files'}
                                        </Badge>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setFolderName(displayFolderName);
                                            setIsFolderNameReadonly(true);
                                            setFileTypeTab('File');
                                            setShowAddDialog(true);
                                        }}
                                        className="gap-1 text-gray-600 hover:text-blue-600"
                                    >
                                        <Plus className="size-4" />
                                        <span className="text-xs">Add to folder</span>
                                    </Button>
                                </div>

                                {/* Files in Folder */}
                                <div className="space-y-3">
                                    {folderFiles?.map((file) => (
                                        <Card
                                            key={file.id}
                                            className="p-4 transition-shadow hover:shadow-md"
                                        >
                                            <div className="flex items-start gap-4">
                                                {/* File Icon */}
                                                <div
                                                    className={`flex size-12 items-center justify-center rounded-lg border ${getMediaTypeColor(file.media_type)}`}
                                                >
                                                    {getMediaIcon(file.media_type)}
                                                </div>

                                                {/* File Info */}
                                                <div className="flex-1 space-y-2">
                                                    <div className="flex items-start justify-between">
                                                        <div className="space-y-1">
                                                            <h4 className="font-semibold text-gray-900">
                                                                {file.name}
                                                            </h4>
                                                            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
                                                                <Badge
                                                                    variant="outline"
                                                                    className={getMediaTypeColor(
                                                                        file.media_type
                                                                    )}
                                                                >
                                                                    {file.media_type.toUpperCase()}
                                                                </Badge>

                                                                <span>•</span>
                                                                <span className="flex items-center gap-1">
                                                                    {file.file_type === 'File' ? (
                                                                        <>
                                                                            <Upload className="size-3" />
                                                                            File
                                                                        </>
                                                                    ) : file.file_type === 'Url' ? (
                                                                        <>
                                                                            <Link2 className="size-3" />
                                                                            URL
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <StickyNote className="size-3" />
                                                                            Note
                                                                        </>
                                                                    )}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        {/* Actions */}
                                                        <div className="flex items-center gap-2">
                                                            {file.file_type === 'Html' ? (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleViewNote(file);
                                                                    }}
                                                                    className="text-gray-600 hover:text-blue-600"
                                                                    title="View Note"
                                                                >
                                                                    <Eye className="size-4" />
                                                                </Button>
                                                            ) : (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleFileDownload(file);
                                                                    }}
                                                                    className="text-gray-600 hover:text-blue-600"
                                                                    title={
                                                                        file.file_type === 'File'
                                                                            ? 'Download'
                                                                            : 'Open Link'
                                                                    }
                                                                >
                                                                    {file.file_type === 'File' ? (
                                                                        <Download className="size-4" />
                                                                    ) : (
                                                                        <ExternalLink className="size-4" />
                                                                    )}
                                                                </Button>
                                                            )}
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleManageAccess(file);
                                                                }}
                                                                className="text-gray-600 hover:text-blue-600"
                                                                title="Manage Access"
                                                            >
                                                                <Settings className="size-4" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleDeleteClick(file.id);
                                                                }}
                                                                className="text-gray-600 hover:text-red-600"
                                                                title="Delete"
                                                            >
                                                                <Trash2 className="size-4" />
                                                            </Button>
                                                        </div>
                                                    </div>

                                                    {/* Metadata */}
                                                    <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                                                        <span className="flex items-center gap-1">
                                                            <User className="size-3" />
                                                            Added By - {file.created_by}
                                                        </span>
                                                        <span>•</span>
                                                        <span className="flex items-center gap-1">
                                                            <Calendar className="size-3" />
                                                            {formatDate(file.created_at_iso)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </Card>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Add File Dialog */}
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                <DialogContent className="max-h-[90vh] min-w-[600px] overflow-y-auto ">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-semibold">
                            Add File for {getTerminology(RoleTerms.Learner, SystemTerms.Learner)}
                        </DialogTitle>
                        <DialogDescription>
                            Upload a file, add a URL, or create a note for this{' '}
                            {getTerminology(
                                RoleTerms.Learner,
                                SystemTerms.Learner
                            ).toLocaleLowerCase()}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6 py-4">
                        {/* File Type Tabs */}
                        <Tabs
                            value={fileTypeTab}
                            onValueChange={(v) => setFileTypeTab(v as FileTypeTab)}
                        >
                            <TabsList className="grid w-full grid-cols-3">
                                <TabsTrigger value="File">
                                    <Upload className="mr-2 size-4" />
                                    File
                                </TabsTrigger>
                                <TabsTrigger value="Url">
                                    <Link2 className="mr-2 size-4" />
                                    URL
                                </TabsTrigger>
                                <TabsTrigger value="Note">
                                    <StickyNote className="mr-2 size-4" />
                                    Note
                                </TabsTrigger>
                            </TabsList>

                            {/* File Upload Tab */}
                            <TabsContent value="File" className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="file-upload" className="text-sm font-medium">
                                        Select File *
                                    </Label>
                                    <div className="flex items-center gap-3">
                                        <Input
                                            id="file-upload"
                                            type="file"
                                            onChange={handleFileSelect}
                                            className="flex-1"
                                        />
                                        {selectedFile && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => {
                                                    setSelectedFile(null);
                                                    setMediaType('unknown');
                                                }}
                                            >
                                                <X className="size-4" />
                                            </Button>
                                        )}
                                    </div>
                                    {selectedFile && (
                                        <p className="text-xs text-gray-600">
                                            Selected: {selectedFile.name} (
                                            {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)
                                        </p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="media-type" className="text-sm font-medium">
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
                            <TabsContent value="Url" className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="file-url" className="text-sm font-medium">
                                        URL *
                                    </Label>
                                    <Input
                                        id="file-url"
                                        type="url"
                                        placeholder="https://example.com/resource"
                                        value={fileUrl}
                                        onChange={(e) => setFileUrl(e.target.value)}
                                    />
                                    <p className="text-xs text-gray-500">
                                        Enter a valid URL to an external resource
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="url-media-type" className="text-sm font-medium">
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
                            <TabsContent value="Note" className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="note-content" className="text-sm font-medium">
                                        Note Content *
                                    </Label>
                                    <div className="rounded-lg border border-gray-200">
                                        <RichTextEditor
                                            value={htmlContent}
                                            onChange={setHtmlContent}
                                            placeholder="Write your note here..."
                                        />
                                    </div>
                                    <p className="text-xs text-gray-500">
                                        Create a rich text note for this student
                                    </p>
                                </div>
                            </TabsContent>
                        </Tabs>

                        {/* Common Fields */}
                        <div className="space-y-4 border-t pt-4">
                            <div className="space-y-2">
                                <Label htmlFor="file-name" className="text-sm font-medium">
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

                            <div className="space-y-2">
                                <Label htmlFor="folder-name" className="text-sm font-medium">
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
                                    className={
                                        isFolderNameReadonly ? 'cursor-not-allowed bg-gray-100' : ''
                                    }
                                />
                                <p className="text-xs text-gray-500">
                                    {isFolderNameReadonly
                                        ? 'Adding file to selected folder'
                                        : 'Optional: Organize files into folders (case-insensitive)'}
                                </p>
                            </div>

                            {/* Access Permissions */}

                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="edit-access"
                                    checked={grantEditAccess}
                                    onCheckedChange={(checked) =>
                                        setGrantEditAccess(checked as boolean)
                                    }
                                />
                                <label
                                    htmlFor="edit-access"
                                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                >
                                    Also grant edit access to the student
                                </label>
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="gap-2">
                        <Button
                            variant="outline"
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowAddDialog(false);
                                resetForm();
                            }}
                            disabled={isUploading}
                        >
                            Cancel
                        </Button>
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
                                    <Loader2 className="mr-2 size-4 animate-spin" />
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

            {/* View Note Dialog */}
            <Dialog open={showViewNoteDialog} onOpenChange={setShowViewNoteDialog}>
                <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-xl font-semibold">
                            <StickyNote className="size-5" />
                            {viewingNote?.name || 'View Note'}
                        </DialogTitle>
                        <DialogDescription>
                            View the note content for this student
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="rounded-lg border border-gray-200 bg-white">
                            <div className="p-4">
                                {viewingNote ? (
                                    <div
                                        className="prose prose-sm max-w-none"
                                        dangerouslySetInnerHTML={{ __html: viewingNote.data }}
                                    />
                                ) : (
                                    <p className="text-sm text-gray-500">No content available</p>
                                )}
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowViewNoteDialog(false);
                                setViewingNote(null);
                            }}
                        >
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-xl font-semibold">
                            <Trash2 className="size-5 text-red-600" />
                            Delete File
                        </DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete this file? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>

                    <DialogFooter className="gap-2">
                        <Button
                            variant="outline"
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowDeleteDialog(false);
                                setFileToDelete(null);
                            }}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={(e) => {
                                e.stopPropagation();
                                fileToDelete && handleDeleteFile(fileToDelete);
                            }}
                        >
                            <Trash2 className="mr-2 size-4" />
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Manage Access Dialog */}
            <Dialog open={showAccessDialog} onOpenChange={setShowAccessDialog}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-xl font-semibold">
                            <Settings className="size-5 text-blue-600" />
                            Manage {getTerminology(RoleTerms.Learner, SystemTerms.Learner)} Access
                        </DialogTitle>
                        <DialogDescription>
                            Control what access the student has to this file
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6 py-4">
                        {isLoadingAccess ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="size-8 animate-spin text-gray-400" />
                            </div>
                        ) : (
                            <>
                                {/* File Info */}
                                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                                    <div className="flex items-center gap-3">
                                        <div
                                            className={`flex size-10 items-center justify-center rounded-lg border ${editingFile ? getMediaTypeColor(editingFile.media_type) : ''}`}
                                        >
                                            {editingFile && getMediaIcon(editingFile.media_type)}
                                        </div>
                                        <div className="flex-1">
                                            <h4 className="font-medium text-gray-900">
                                                {editingFile?.name}
                                            </h4>
                                            <p className="text-xs text-gray-600">
                                                {editingFile?.file_type} •{' '}
                                                {editingFile?.media_type.toUpperCase()}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Student Info */}
                                <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
                                    <div className="flex items-center gap-2">
                                        <User className="size-4 text-blue-600" />
                                        <span className="font-medium text-blue-900">
                                            {selectedStudent?.full_name}
                                        </span>
                                    </div>
                                </div>

                                {/* Access Controls */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4 hover:bg-gray-50">
                                        <div className="flex items-center gap-3">
                                            <UserCheck className="size-5 text-green-600" />
                                            <div>
                                                <h5 className="font-medium text-gray-900">
                                                    View Access
                                                </h5>
                                                <p className="text-xs text-gray-600">
                                                    {getTerminology(
                                                        RoleTerms.Learner,
                                                        SystemTerms.Learner
                                                    )}{' '}
                                                    can view this file
                                                </p>
                                            </div>
                                        </div>
                                        <Button
                                            variant={hasViewAccess ? 'default' : 'outline'}
                                            size="sm"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleToggleViewAccess();
                                            }}
                                            disabled={isLoadingAccess}
                                            className={
                                                hasViewAccess
                                                    ? 'bg-green-600 hover:bg-green-700'
                                                    : ''
                                            }
                                        >
                                            {hasViewAccess ? 'Granted' : 'Grant'}
                                        </Button>
                                    </div>

                                    <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4 hover:bg-gray-50">
                                        <div className="flex items-center gap-3">
                                            <UserX className="size-5 text-orange-600" />
                                            <div>
                                                <h5 className="font-medium text-gray-900">
                                                    Edit Access
                                                </h5>
                                                <p className="text-xs text-gray-600">
                                                    {getTerminology(
                                                        RoleTerms.Learner,
                                                        SystemTerms.Learner
                                                    )}{' '}
                                                    can edit this file
                                                </p>
                                            </div>
                                        </div>
                                        <Button
                                            variant={hasEditAccess ? 'default' : 'outline'}
                                            size="sm"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleToggleEditAccess();
                                            }}
                                            disabled={isLoadingAccess}
                                            className={
                                                hasEditAccess
                                                    ? 'bg-orange-600 hover:bg-orange-700'
                                                    : ''
                                            }
                                        >
                                            {hasEditAccess ? 'Granted' : 'Grant'}
                                        </Button>
                                    </div>
                                </div>

                                {/* Help Text */}
                                <div className="rounded-lg bg-gray-50 p-3 text-xs">
                                    <p className="mt-1">
                                        Edit access will allow student to modify the file.
                                    </p>
                                </div>
                            </>
                        )}
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowAccessDialog(false);
                                setEditingFile(null);
                            }}
                        >
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};
