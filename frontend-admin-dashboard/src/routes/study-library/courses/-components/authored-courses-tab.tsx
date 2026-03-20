import React, { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MyButton } from '@/components/design-system/button';
import {
    PaperPlaneTilt,
    Eye,
    Copy,
    CircleNotch,
    TrashSimple,
    ClockCounterClockwise,
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import { useNavigate } from '@tanstack/react-router';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import {
    getMyCourses,
    createEditableCopy,
    submitForReview,
    getMyCourseHistory,
} from '../-services/approval-services';
import { formatDistanceToNow } from 'date-fns';
import { Input } from '@/components/ui/input';
import { getTokenDecodedData, getTokenFromCookie } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';
import { useDeleteCourse } from '@/services/study-library/course-operations/delete-course';
import { useFileUpload } from '@/hooks/use-file-upload';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { MyDialog } from '@/components/design-system/dialog';
import { MyPagination } from '@/components/design-system/pagination';

interface PackageEntity {
    id: string;
    packageName: string;
    updatedAt: string;
    thumbnail_file_id: string | null;
    status: 'DRAFT' | 'IN_REVIEW' | 'ACTIVE';
    createdAt: string;
    isCoursePublishedToCatalaouge: boolean | null;
    course_preview_image_media_id: string | null;
    course_banner_media_id: string | null;
    courseMediaId: string | null;
    whyLearn: string | null;
    whoShouldLearn: string | null;
    aboutTheCourse: string | null;
    tags: string[] | null;
    courseDepth: number | null;
    courseHtmlDescription: string | null;
    originalCourseId: string | null;
    createdByUserId: string | null;
    versionNumber: number | null;
}

interface SessionInfo {
    sessionId: string | null;
    sessionName: string | null;
    sessionStatus: string | null;
    sessionStartDate: string | null;
}

interface LevelInfo {
    levelId: string | null;
    levelName: string | null;
    durationInDays: number | null;
    levelStatus: string | null;
    levelThumbnailFileId: string | null;
    levelCreatedAt: string | null;
    levelUpdatedAt: string | null;
}

interface PackageSessionInfo {
    packageSessionIds: string | null;
    packageSessionCount: number;
    packageSessionStatuses: string | null;
}

interface DetailedCourseResponse {
    packageEntity: PackageEntity;
    relationshipType: 'CREATOR' | 'FACULTY_ASSIGNED';
    facultyAssignmentCount: number;
    assignedSubjects: string | null;
    courseId: string;
    courseName: string;
    courseStatus: 'DRAFT' | 'IN_REVIEW' | 'ACTIVE';
    createdAt: string;
    updatedAt: string;
    sessionInfo: SessionInfo;
    levelInfo: LevelInfo;
    packageSessionInfo: PackageSessionInfo;
    facultyAssigned: boolean;
    creator: boolean;
}

interface PaginatedCoursesResponse {
    content: DetailedCourseResponse[];
    totalElements: number;
    totalPages: number;
    number: number;
    size: number;
    first: boolean;
    last: boolean;
}

// Display course interface - each packageSession entry shown separately
interface DisplayCourse {
    id: string; // Unique identifier for this entry (courseId + sessionId + levelId)
    courseId: string;
    packageId: string; // Package ID for deletion
    packageName: string;
    status: 'DRAFT' | 'IN_REVIEW' | 'ACTIVE';
    updatedAt: string;
    createdAt: string;
    originalCourseId: string | null;
    courseHtmlDescription: string | null;
    relationshipType: 'CREATOR' | 'FACULTY_ASSIGNED';
    facultyAssignmentCount: number;
    creator: boolean;
    facultyAssigned: boolean;
    thumbnail_file_id: string | null;
    course_preview_image_media_id: string | null;
    course_banner_media_id: string | null;
    sessionInfo: SessionInfo;
    levelInfo: LevelInfo;
}

interface AuthoredCoursesTabProps {
    searchValue: string;
    setSearchValue: (value: string) => void;
}

export const AuthoredCoursesTab: React.FC<AuthoredCoursesTabProps> = ({
    searchValue,
    setSearchValue,
}) => {
    const navigate = useNavigate();
    const [filteredCourses, setFilteredCourses] = useState<DisplayCourse[]>([]);
    const [copyingCourseId, setCopyingCourseId] = useState<string | null>(null);
    const [deletingCourseId, setDeletingCourseId] = useState<string | null>(null);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState<string | null>(null);
    const [historyDialogCourseId, setHistoryDialogCourseId] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState<number>(0);
    const [pageSize] = useState<number>(20);
    const [totalPages, setTotalPages] = useState<number>(0);
    const [totalElements, setTotalElements] = useState<number>(0);

    // Delete course mutation
    const deleteCourseMutation = useDeleteCourse();

    // Get current user data
    const accessToken = getTokenFromCookie(TokenKey.accessToken);
    const tokenData = getTokenDecodedData(accessToken);
    const isAdmin =
        tokenData?.authorities &&
        Object.values(tokenData.authorities).some(
            (auth: { roles?: string[] }) =>
                Array.isArray(auth?.roles) && auth.roles.includes('ADMIN')
        );

    // Fetch authored courses
    const {
        data: coursesResponse,
        isLoading,
        refetch,
        error,
    } = useQuery<PaginatedCoursesResponse>({
        queryKey: ['my-courses-authored', currentPage, pageSize],
        queryFn: () => getMyCourses(currentPage, pageSize),
        staleTime: 30000, // Consider data fresh for 30 seconds
        refetchOnWindowFocus: false, // Don't refetch on window focus
    });

    // Extract courses and pagination info from response
    const courses = coursesResponse?.content || [];

    // Update pagination metadata when data changes
    useEffect(() => {
        if (coursesResponse) {
            setTotalPages(coursesResponse.totalPages);
            setTotalElements(coursesResponse.totalElements);
        }
    }, [coursesResponse]);

    // Create editable copy mutation
    const createCopyMutation = useMutation({
        mutationFn: createEditableCopy,
        onSuccess: () => {
            toast.success('Editable copy created successfully');
            refetch();
            setCopyingCourseId(null);
            navigate({ to: '/study-library/courses' });
        },
        onError: (error: Error) => {
            toast.error(error.message || 'Failed to create editable copy');
            setCopyingCourseId(null);
        },
    });

    // Submit for review mutation
    const submitReviewMutation = useMutation({
        mutationFn: submitForReview,
        onSuccess: () => {
            toast.success('Course submitted for review');
            refetch();
        },
        onError: (error: Error) => {
            toast.error(error.message || 'Failed to submit for review');
        },
    });

    // Course History query (teacher)
    interface CourseHistoryLogItem {
        timestamp: number;
        actorUserId: string;
        action: string;
        message: string;
        comment?: string;
    }

    interface CourseHistoryResponse {
        courseId: string;
        courseName: string;
        status: string;
        createdByUserId: string;
        originalCourseId?: string | null;
        originalCourseName?: string | null;
        originalCourseStatus?: string | null;
        versionNumber?: number | null;
        auditLogs: CourseHistoryLogItem[];
    }

    const {
        data: courseHistory,
        isFetching: isHistoryFetching,
        error: historyError,
    } = useQuery<CourseHistoryResponse | undefined>({
        queryKey: ['teacher-course-history', historyDialogCourseId],
        queryFn: () => getMyCourseHistory(historyDialogCourseId as string),
        enabled: Boolean(historyDialogCourseId),
    });

    const sortByTimestampAsc = (a: CourseHistoryLogItem, b: CourseHistoryLogItem): number =>
        a.timestamp - b.timestamp;

    // Filter courses based on search - show each packageSession entry separately
    useEffect(() => {
        if (!courses) return;

        // Map each response to a display course (no grouping)
        const displayCourses: DisplayCourse[] = courses.map((response: DetailedCourseResponse) => {
            const course = response.packageEntity;
            // Create unique ID for each entry
            const uniqueId = `${response.courseId}_${response.sessionInfo.sessionId}_${response.levelInfo.levelId}`;

            return {
                id: uniqueId,
                courseId: response.courseId,
                packageId: course.id,
                packageName: course.packageName,
                status: course.status,
                updatedAt: course.updatedAt,
                createdAt: course.createdAt,
                originalCourseId: course.originalCourseId,
                courseHtmlDescription: course.courseHtmlDescription,
                relationshipType: response.relationshipType,
                facultyAssignmentCount: response.facultyAssignmentCount,
                creator: response.creator,
                facultyAssigned: response.facultyAssigned,
                thumbnail_file_id: course.thumbnail_file_id,
                course_preview_image_media_id: course.course_preview_image_media_id,
                course_banner_media_id: course.course_banner_media_id,
                sessionInfo: response.sessionInfo,
                levelInfo: response.levelInfo,
            };
        });

        // Filter courses
        const filtered = displayCourses.filter((course) => {
            // Show only ACTIVE and DRAFT courses (not IN_REVIEW ones - they go to separate tab)
            const isValidStatus = ['ACTIVE', 'DRAFT'].includes(course.status);

            // Search filter
            const matchesSearch =
                !searchValue ||
                course.packageName.toLowerCase().includes(searchValue.toLowerCase());

            return isValidStatus && matchesSearch;
        });

        setFilteredCourses(filtered);
    }, [courses, searchValue]);

    const handleViewCourse = (courseId: string) => {
        navigate({
            to: '/study-library/courses/course-details',
            search: { courseId: courseId },
        });
    };

    const handleCopyToEdit = (course: DisplayCourse) => {
        setCopyingCourseId(course.courseId);
        createCopyMutation.mutate(course.courseId);
    };

    const handleSubmitForReview = (courseId: string) => {
        submitReviewMutation.mutate(courseId);
    };

    const handleDeleteCourse = (entryId: string) => {
        // Find the course to get the packageId
        const course = filteredCourses.find((c) => c.id === entryId);
        if (!course) {
            toast.error('Course not found');
            return;
        }

        console.log('Deleting course:', { courseId: course.courseId, packageId: course.packageId });

        setDeletingCourseId(entryId);
        setDeleteDialogOpen(null); // Close the dialog
        deleteCourseMutation.mutate(course.packageId, {
            onSuccess: () => {
                toast.success('Course deleted successfully');
                refetch();
                setDeletingCourseId(null);
            },
            onError: (error: unknown) => {
                const errMsg =
                    error && typeof error === 'object' && 'message' in error
                        ? (error as { message?: string }).message
                        : undefined;
                toast.error(errMsg || 'Failed to delete course');
                setDeletingCourseId(null);
            },
        });
    };

    const canCreateCopy = (course: DisplayCourse) => {
        if (!filteredCourses) return false;
        // Prevent multiple draft copies: Check if there's already a draft copy of this published course
        // by looking for any course where originalCourseId matches this course's courseId and status is DRAFT
        const hasDraftCopy = filteredCourses.some(
            (c) => c.originalCourseId === course.courseId && c.status === 'DRAFT'
        );
        return !hasDraftCopy;
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'ACTIVE':
                return <Badge className="bg-green-100 text-green-800">Published</Badge>;
            case 'DRAFT':
                return <Badge>Draft</Badge>;
            case 'IN_REVIEW':
                return <Badge>In Review</Badge>;
            default:
                return <Badge>{status}</Badge>;
        }
    };

    // Thumbnail component that handles async URL fetching
    const CourseThumbnail: React.FC<{ course: DisplayCourse }> = ({ course }) => {
        const { getPublicUrl } = useFileUpload();
        const [imageUrl, setImageUrl] = useState<string>('');
        const [isLoading, setIsLoading] = useState(false);

        // Priority: thumbnail_file_id > course_preview_image_media_id > course_banner_media_id
        const mediaId =
            course.thumbnail_file_id ||
            course.course_preview_image_media_id ||
            course.course_banner_media_id;

        useEffect(() => {
            if (mediaId) {
                setIsLoading(true);
                getPublicUrl(mediaId)
                    .then((url: string | undefined) => {
                        setImageUrl(url || '');
                    })
                    .catch((error: unknown) => {
                        console.error('Failed to get thumbnail URL:', error);
                        setImageUrl('');
                    })
                    .finally(() => {
                        setIsLoading(false);
                    });
            }
        }, [mediaId, getPublicUrl]);

        if (isLoading) {
            return (
                <div className="flex size-full w-full items-center justify-center overflow-hidden rounded-lg px-2 pb-0 pt-2 sm:px-3 sm:pt-4">
                    <div className="flex h-32 w-full items-center justify-center rounded-lg bg-gray-100">
                        <div className="size-8 animate-spin rounded-full border-2 border-gray-300 border-t-transparent"></div>
                    </div>
                </div>
            );
        }

        if (!mediaId || !imageUrl) {
            return null;
        }

        return (
            <div className="flex size-full w-full items-center justify-center overflow-hidden rounded-lg px-2 pb-0 pt-2 sm:px-3 sm:pt-4">
                <img
                    src={imageUrl}
                    alt={course.packageName}
                    className="rounded-lg bg-white object-cover p-1 transition-transform duration-300 group-hover:scale-105 sm:p-2"
                    onError={(e) => {
                        // Hide image if it fails to load
                        (e.target as HTMLImageElement).style.display = 'none';
                    }}
                />
            </div>
        );
    };

    if (isLoading) {
        return <DashboardLoader />;
    }

    if (error) {
        return (
            <div className="flex h-40 flex-col items-center justify-center text-red-500">
                <p>Error loading courses</p>
                <MyButton onClick={() => refetch()} className="mt-2">
                    Retry
                </MyButton>
            </div>
        );
    }

    // Pagination handler
    const handlePageChange = (newPage: number) => {
        setCurrentPage(newPage);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <div className="space-y-4 sm:space-y-6">
            {/* Search Bar - Full width on mobile */}
            <div className="flex items-center gap-4">
                <Input
                    placeholder="Search courses..."
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                    className="w-full sm:max-w-md"
                />
            </div>

            {/* Courses List */}
            {filteredCourses.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <h3 className="mb-2 text-lg font-semibold">No courses found</h3>
                        <p className="text-gray-600">
                            {searchValue
                                ? `No courses match "${searchValue}"`
                                : "You haven't created any courses yet."}
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
                    {filteredCourses.map((course) => (
                        <div
                            key={course.id}
                            className="animate-fade-in group relative flex h-fit flex-col rounded-lg border border-neutral-200 bg-white p-0 shadow-sm transition-transform duration-500 hover:scale-[1.02] hover:shadow-md sm:hover:scale-[1.025]"
                        >
                            {/* Course Banner Image */}
                            <CourseThumbnail course={course} />

                            <div className="flex flex-col gap-1 p-3 sm:p-4">
                                {/* Course Name and Level Badge */}
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0 flex-1 text-base font-extrabold text-neutral-800 sm:text-lg">
                                        {course.packageName}
                                    </div>
                                    <div className="flex-shrink-0 rounded-lg bg-gray-100 p-1 px-2 text-xs font-semibold text-gray-700">
                                        {course.levelInfo.levelName || 'Level'}
                                    </div>
                                </div>

                                {/* Description */}
                                {course.courseHtmlDescription && (
                                    <div className="mt-1 line-clamp-2 text-xs text-neutral-600 sm:mt-2 sm:text-sm">
                                        {(course.courseHtmlDescription || '')
                                            .replace(/<[^>]*>/g, '')
                                            .slice(0, 120)}
                                    </div>
                                )}

                                {/* Session Name - show if not invited */}
                                {course.sessionInfo.sessionName &&
                                 !course.sessionInfo.sessionName.toLowerCase().includes('invited') && (
                                    <div className="mt-2 flex items-center gap-2">
                                        <span className="text-xs text-neutral-600">
                                            Session: {course.sessionInfo.sessionName}
                                        </span>
                                    </div>
                                )}

                                {/* Status and Copy Badges */}
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {getStatusBadge(course.status)}
                                    {course.originalCourseId && (
                                        <Badge className="px-2 text-xs">Copy</Badge>
                                    )}
                                </div>

                                {/* Updated Date */}
                                <span className="mt-2 text-xs text-gray-500">
                                    Updated {formatDistanceToNow(new Date(course.updatedAt))} ago
                                </span>

                                {/* Action Buttons */}
                                <div className="mt-3 flex gap-2 sm:mt-4">
                                    {/* View Course Button */}
                                    <MyButton
                                        className="flex-1 text-sm"
                                        buttonType="primary"
                                        onClick={() => handleViewCourse(course.courseId)}
                                    >
                                        View Course
                                    </MyButton>

                                    {/* Additional Actions for Draft courses */}
                                    {course.status === 'DRAFT' && !isAdmin && (
                                        <>
                                            {/* Submit for Review */}
                                            <MyButton
                                                onClick={() => handleSubmitForReview(course.courseId)}
                                                className="flex size-9 items-center justify-center rounded-md border-2 border-green-500 bg-green-600 text-white transition-colors hover:border-green-600 hover:bg-green-700 active:scale-95 [&_svg]:text-white"
                                                disabled={submitReviewMutation.isPending}
                                                title="Submit for Review"
                                            >
                                                {submitReviewMutation.isPending ? (
                                                    <CircleNotch size={18} className="animate-spin" />
                                                ) : (
                                                    <PaperPlaneTilt size={18} weight="fill" />
                                                )}
                                            </MyButton>

                                            {/* History */}
                                            <MyButton
                                                onClick={() => setHistoryDialogCourseId(course.courseId)}
                                                className="flex size-9 items-center justify-center rounded-md border-2 border-blue-500 bg-blue-600 text-white transition-colors hover:border-blue-600 hover:bg-blue-700 active:scale-95 [&_svg]:text-white"
                                                title="View History"
                                            >
                                                <ClockCounterClockwise size={18} weight="fill" />
                                            </MyButton>
                                        </>
                                    )}

                                    {/* Copy Button for Published courses */}
                                    {course.status === 'ACTIVE' && !isAdmin && canCreateCopy(course) && (
                                        <MyButton
                                            onClick={() => handleCopyToEdit(course)}
                                            className="flex size-9 items-center justify-center rounded-md border border-blue-200 bg-blue-50 text-blue-600 transition-colors hover:border-blue-300 hover:bg-blue-100 active:scale-95"
                                            disabled={copyingCourseId === course.courseId}
                                            title="Copy to Edit"
                                        >
                                            {copyingCourseId === course.courseId ? (
                                                <CircleNotch size={18} className="animate-spin" />
                                            ) : (
                                                <Copy size={18} />
                                            )}
                                        </MyButton>
                                    )}

                                    {/* Delete Button */}
                                    <AlertDialog
                                        open={deleteDialogOpen === course.id}
                                        onOpenChange={(open) => {
                                            if (open) {
                                                setDeleteDialogOpen(course.id);
                                            } else {
                                                setDeleteDialogOpen(null);
                                            }
                                        }}
                                    >
                                        <AlertDialogTrigger className="flex size-9 items-center justify-center rounded-md border border-red-200 bg-red-50 text-red-500 transition-colors hover:border-red-300 hover:bg-red-100 active:scale-95">
                                            <TrashSimple size={18} />
                                        </AlertDialogTrigger>
                                        <AlertDialogContent className="w-[calc(100%-2rem)] max-w-md">
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>
                                                    Are you sure you want to delete this course?
                                                </AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    This action cannot be undone. This will permanently
                                                    delete your course and remove your course data from
                                                    our servers.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
                                                <AlertDialogCancel
                                                    disabled={deletingCourseId === course.id}
                                                    className="w-full sm:w-auto"
                                                >
                                                    Cancel
                                                </AlertDialogCancel>
                                                <AlertDialogAction
                                                    onClick={() => handleDeleteCourse(course.id)}
                                                    disabled={deletingCourseId === course.id}
                                                    className="w-full bg-primary-500 text-white sm:w-auto"
                                                >
                                                    {deletingCourseId === course.id ? (
                                                        <CircleNotch size={18} className="animate-spin" />
                                                    ) : (
                                                        'Delete'
                                                    )}
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
                <MyPagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={handlePageChange}
                />
            )}

            {/* Course History Dialog */}
            <MyDialog
                heading={
                    courseHistory?.courseName
                        ? `Course History · ${courseHistory.courseName}`
                        : 'Course History'
                }
                open={Boolean(historyDialogCourseId)}
                onOpenChange={(open) => {
                    if (!open) setHistoryDialogCourseId(null);
                }}
                dialogWidth="max-w-3xl"
            >
                {isHistoryFetching ? (
                    <div className="flex items-center justify-center py-6 text-gray-600">
                        <CircleNotch size={18} className="mr-2 animate-spin" /> Loading history…
                    </div>
                ) : historyError ? (
                    <div className="rounded-md bg-red-50 p-4 text-red-700">
                        Failed to load course history.
                    </div>
                ) : courseHistory ? (
                    <div className="space-y-4">
                        <div className="grid gap-2 sm:grid-cols-2">
                            <div className="text-sm text-gray-600">
                                <span className="font-medium text-gray-800">Course ID:</span>{' '}
                                {courseHistory.courseId}
                            </div>
                            <div className="text-sm text-gray-600">
                                <span className="font-medium text-gray-800">Status:</span>{' '}
                                {courseHistory.status}
                            </div>
                            {courseHistory.versionNumber != null && (
                                <div className="text-sm text-gray-600">
                                    <span className="font-medium text-gray-800">Version:</span>{' '}
                                    {courseHistory.versionNumber}
                                </div>
                            )}
                            {courseHistory.originalCourseName && (
                                <div className="text-sm text-gray-600">
                                    <span className="font-medium text-gray-800">Original:</span>{' '}
                                    {courseHistory.originalCourseName}{' '}
                                    {courseHistory.originalCourseStatus && (
                                        <span>({courseHistory.originalCourseStatus})</span>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="pt-2">
                            <h4 className="mb-2 text-sm font-semibold text-gray-900">Audit Logs</h4>
                            {courseHistory.auditLogs && courseHistory.auditLogs.length > 0 ? (
                                <ul className="space-y-3">
                                    {courseHistory.auditLogs
                                        .slice()
                                        .sort(sortByTimestampAsc)
                                        .map((log: CourseHistoryLogItem, idx: number) => (
                                            <li
                                                key={`${log.timestamp}-${idx}`}
                                                className="rounded-lg border border-gray-100 bg-gray-50 p-3"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="text-xs font-medium uppercase tracking-wide text-gray-700">
                                                        {log.action}
                                                    </div>
                                                    <div className="text-xs text-gray-500">
                                                        {new Date(log.timestamp).toLocaleString()}
                                                    </div>
                                                </div>
                                                <div className="mt-1 text-sm text-gray-800">
                                                    {log.message}
                                                </div>
                                                <div className="mt-1 text-xs text-gray-600">
                                                    By: {log.actorUserId}
                                                </div>
                                                {log.comment && (
                                                    <div className="mt-2 rounded bg-white p-2 text-xs text-gray-700">
                                                        Comment: {log.comment}
                                                    </div>
                                                )}
                                            </li>
                                        ))}
                                </ul>
                            ) : (
                                <div className="text-sm text-gray-600">No history available.</div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="text-sm text-gray-600">No history available.</div>
                )}
            </MyDialog>
        </div>
    );
};
