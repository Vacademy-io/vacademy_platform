import {
    Star,
    ChatCircle,
    TrendUp,
} from "phosphor-react";
import { useState, useEffect, useRef } from "react";
import { MyPagination } from "@/components/design-system/pagination";
import { AxiosError } from "axios";
import { toast } from "sonner";
import {
    useMutation,
    useQueryClient,
    useSuspenseQuery,
} from "@tanstack/react-query";
import {
    handleGetOverAllRatingDetails,
    handleGetRatingDetails,
    handleUpdateRating,
    handleSubmitRating,
} from "../-services/rating-services";
import { StarRatingComponent } from "@/components/common/star-rating-component";
import { DashboardLoader } from "@/components/core/dashboard-loader";
import { ProgressBar } from "@/components/ui/custom-progress-bar";
import { useRouter } from "@tanstack/react-router";
import { MyButton } from "@/components/design-system/button";
import { Textarea } from "@/components/ui/textarea";
import { getPublicUrl } from "@/services/upload_file";
import { ReviewItem, type Review } from "@/components/common/review-item";
import { getUserId } from "@/constants/getUserId";


// Types for API Response
interface User {
    id: string;
    username: string;
    email: string;
    full_name: string;
    profile_pic_file_id: string | null;
}

interface Rating {
    id: string;
    points: number;
    likes: number;
    dislikes: number;
    text: string;
    user: User;
    created_at: string;
}

interface PaginatedResponse {
    content: Rating[];
    totalPages: number;
    totalElements: number;
    number: number;
    size: number;
}

// Helper function to transform API data to Review format
const transformRatingToReview = (rating: Rating): Review => {
    return {
        id: rating.id,
        user: {
            id: rating.user.id, // Include user ID for ownership check
            name: rating.user.full_name || rating.user.username,
            avatarUrl: rating.user.profile_pic_file_id || "",
        },
        createdAt: rating.created_at,
        rating: rating.points,
        description: rating.text || "No review text provided",
        likes: rating.likes,
        dislikes: rating.dislikes,
    };
};



export function CourseDetailsRatingsComponent({
    packageSessionId,
}: {
    packageSessionId: string | null;
}) {
    const router = useRouter();
    const searchParams = router.state.location.search;
    const queryClient = useQueryClient();
    const [page, setPage] = useState(0);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);

    // Get current user ID on component mount
    useEffect(() => {
        const fetchCurrentUserId = async () => {
            try {
                const userId = await getUserId();
                setCurrentUserId(userId);
            } catch (error) {
                console.error("Failed to get current user ID:", error);
                setCurrentUserId(null);
            }
        };

        fetchCurrentUserId();
    }, []);

    const { data: ratingData, isLoading } = useSuspenseQuery<PaginatedResponse>(
        handleGetRatingDetails({
            pageNo: page,
            pageSize: 10,
            data: {
                source_id: packageSessionId || "",
                source_type: "PACKAGE_SESSION",
            },
        })
    );

    const { data: overallRatingData } = useSuspenseQuery(
        handleGetOverAllRatingDetails({
            source_id: packageSessionId || "",
        })
    );

    // Transform API data to reviews format
    const reviews = ratingData?.content.map(transformRatingToReview) || [];
    const totalPages = ratingData?.totalPages || 0;
    


    // State to store avatar URLs
    const [avatarUrls, setAvatarUrls] = useState<Record<string, string>>({});
    const fetchedUrlsRef = useRef<Set<string>>(new Set());

    // Fetch avatar URLs when reviews change (only for new reviews)
    useEffect(() => {
        const fetchAvatarUrls = async () => {
            // Only fetch URLs for reviews that we haven't fetched before
            const reviewsNeedingUrls = reviews.filter(
                review => review.user.avatarUrl && !fetchedUrlsRef.current.has(review.id)
            );

            if (reviewsNeedingUrls.length === 0) return;

            const urlPromises = reviewsNeedingUrls.map(async (review) => {
                try {
                    const url = await getPublicUrl(review.user.avatarUrl);
                    // Mark this review as fetched
                    fetchedUrlsRef.current.add(review.id);
                    return { reviewId: review.id, url };
                } catch {
                    // Mark this review as fetched even if it failed
                    fetchedUrlsRef.current.add(review.id);
                    return { reviewId: review.id, url: "" };
                }
            });

            const results = await Promise.all(urlPromises);
            const newUrls: Record<string, string> = {};
            
            results.forEach(({ reviewId, url }) => {
                if (url) {
                    newUrls[reviewId] = url;
                }
            });
            
            // Merge with existing URLs instead of replacing
            setAvatarUrls(prev => ({ ...prev, ...newUrls }));
        };

        if (reviews.length > 0) {
            fetchAvatarUrls();
        }
    }, [reviews]);

    const [feedbackText, setFeedbackText] = useState("");
    const [selectedRating, setSelectedRating] = useState<number | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const handleUpdateRatingMutation = useMutation({
        mutationFn: async ({
            id,
            rating,
            source_id,
            status,
            likes,
            dislikes,
            text,
        }: {
            id: string;
            rating: number;
            source_id: string;
            status: string;
            likes: number;
            dislikes: number;
            text?: string;
        }) => {
            return handleUpdateRating(
                id,
                rating,
                source_id,
                status,
                likes,
                dislikes,
                text
            );
        },
        onSuccess: () => {
            // No need to invalidate queries since we're using optimistic updates
            // The UI is already updated optimistically
        },
        onError: (error: unknown, variables) => {
            // Revert optimistic updates on error
            queryClient.setQueryData(
                ["GET_ALL_USER_COURSE_RATINGS", page, 10, { source_id: packageSessionId || "", source_type: "PACKAGE_SESSION" }],
                (oldData: PaginatedResponse | undefined) => {
                    if (!oldData) return oldData;
                    
                    // Find the original review to revert changes
                    const originalReview = reviews.find(r => r.id === variables.id);
                    if (!originalReview) return oldData;

                    return {
                        ...oldData,
                        content: oldData.content.map((rating: Rating) => 
                            rating.id === variables.id 
                                ? { 
                                    ...rating, 
                                    likes: originalReview.likes,
                                    dislikes: originalReview.dislikes,
                                    status: "ACTIVE" // Revert status if it was deleted
                                }
                                : rating
                        ),
                        totalElements: oldData.totalElements + (variables.status === "DELETED" ? 1 : 0) // Revert total count if deleted
                    };
                }
            );

            if (error instanceof AxiosError) {
                toast.error(
                    error?.response?.data?.ex || "Failed to submit rating",
                    {
                        className: "error-toast",
                        duration: 2000,
                    }
                );
            } else {
                toast.error("An unexpected error occurred", {
                    className: "error-toast",
                    duration: 2000,
                });
                console.error("Unexpected error:", error);
            }
        },
    });

    const handlePageChange = (pageNo: number) => {
        setPage(pageNo);
    };

    const handleStarClick = (rating: number) => {
        setSelectedRating(rating);
    };

    // Handler functions for ReviewItem with optimistic updates
    const handleLike = (reviewId: string) => {
        const review = reviews.find(r => r.id === reviewId);
        if (review) {
            // Update the query cache optimistically
            queryClient.setQueryData(
                ["GET_ALL_USER_COURSE_RATINGS", page, 10, { source_id: packageSessionId || "", source_type: "PACKAGE_SESSION" }],
                (oldData: PaginatedResponse | undefined) => {
                    if (!oldData) return oldData;
                    return {
                        ...oldData,
                        content: oldData.content.map((rating: Rating) => 
                            rating.id === reviewId 
                                ? { ...rating, likes: rating.likes + 1 }
                                : rating
                        )
                    };
                }
            );

            handleUpdateRatingMutation.mutate({
                id: review.id,
                rating: review.rating,
                source_id: packageSessionId || "",
                status: "ACTIVE",
                likes: review.likes + 1,
                dislikes: review.dislikes,
                text: review.description,
            });
        }
    };

    const handleDislike = (reviewId: string) => {
        const review = reviews.find(r => r.id === reviewId);
        if (review) {
            // Update the query cache optimistically
            queryClient.setQueryData(
                ["GET_ALL_USER_COURSE_RATINGS", page, 10, { source_id: packageSessionId || "", source_type: "PACKAGE_SESSION" }],
                (oldData: PaginatedResponse | undefined) => {
                    if (!oldData) return oldData;
                    return {
                        ...oldData,
                        content: oldData.content.map((rating: Rating) => 
                            rating.id === reviewId 
                                ? { ...rating, dislikes: rating.dislikes + 1 }
                                : rating
                        )
                    };
                }
            );

            handleUpdateRatingMutation.mutate({
                id: review.id,
                rating: review.rating,
                source_id: packageSessionId || "",
                status: "ACTIVE",
                likes: review.likes,
                dislikes: review.dislikes + 1,
                text: review.description,
            });
        }
    };

    const handleDelete = (reviewId: string) => {
        const review = reviews.find(r => r.id === reviewId);
        if (review) {
            // Update the query cache optimistically
            queryClient.setQueryData(
                ["GET_ALL_USER_COURSE_RATINGS", page, 10, { source_id: packageSessionId || "", source_type: "PACKAGE_SESSION" }],
                (oldData: PaginatedResponse | undefined) => {
                    if (!oldData) return oldData;
                    return {
                        ...oldData,
                        content: oldData.content.filter((rating: Rating) => rating.id !== reviewId),
                        totalElements: oldData.totalElements - 1
                    };
                }
            );

            handleUpdateRatingMutation.mutate({
                id: review.id,
                rating: review.rating,
                source_id: packageSessionId || "",
                status: "DELETED",
                likes: review.likes,
                dislikes: review.dislikes,
                text: review.description,
            });
        }
    };

    const handleSubmitRatingMutation = useMutation({
        mutationFn: async ({
            rating,
            desc,
            source_id,
        }: {
            rating: number;
            desc: string;
            source_id: string;
        }) => {
            return handleSubmitRating(rating, desc, source_id);
        },
        onSuccess: () => {
            toast.success("Thank you for your feedback!", {
                className: "success-toast",
                duration: 2000,
            });
            // Reset form
            setFeedbackText("");
            setSelectedRating(null);
            setSubmitting(false);
            queryClient.invalidateQueries({
                queryKey: ["GET_ALL_USER_COURSE_RATINGS"],
            });
            queryClient.invalidateQueries({
                queryKey: ["GET_ALL_USER_COURSE_RATINGS_OVERALL"],
            });
        },
        onError: (error: unknown) => {
            if (error instanceof AxiosError) {
                toast.error(
                    error?.response?.data?.ex || "Failed to submit rating",
                    {
                        className: "error-toast",
                        duration: 2000,
                    }
                );
            } else {
                toast.error("An unexpected error occurred", {
                    className: "error-toast",
                    duration: 2000,
                });
                console.error("Unexpected error:", error);
            }
            setSubmitting(false);
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchParams.courseId) return;
        
        // Ensure rating is selected
        if (!selectedRating) {
            toast.error("Please select a rating before submitting", {
                className: "error-toast",
                duration: 2000,
            });
            return;
        }

        setSubmitting(true);
        handleSubmitRatingMutation.mutate({
            rating: selectedRating,
            desc: feedbackText.trim(),
            source_id: packageSessionId || "",
        });
    };

    if (isLoading || !packageSessionId) return <DashboardLoader />;

    return (
        <div className="relative bg-white/80 backdrop-blur-sm border border-gray-200/60 rounded-xl shadow-sm hover:shadow-lg transition-all duration-500 p-3 sm:p-4 lg:p-6 group overflow-hidden">
            {/* Background gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-xl"></div>

            {/* Floating orb effects */}
            <div className="absolute top-0 right-0 w-16 h-16 bg-primary-100/20 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 -translate-y-3 translate-x-6"></div>
            <div className="absolute bottom-0 left-0 w-20 h-20 bg-yellow-100/20 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 translate-y-3 -translate-x-6"></div>

            <div className="relative space-y-4 lg:space-y-6">
                {/* Enhanced Header */}
                <div className="flex items-center space-x-2 sm:space-x-3 animate-fade-in-down">
                    <div className="p-1.5 sm:p-2 bg-gradient-to-br from-yellow-100 to-yellow-200 rounded-lg shadow-sm">
                        <Star
                            size={20}
                            className="text-yellow-600"
                            weight="duotone"
                        />
                    </div>
                    <div>
                        <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 tracking-tight">
                            Ratings & Reviews
                        </h1>
                        <p className="text-xs sm:text-sm text-gray-600 mt-0.5 flex items-center space-x-1.5">
                            <ChatCircle
                                size={12}
                                className="text-primary-500"
                                weight="duotone"
                            />
                            <span>Community feedback and ratings</span>
                        </p>
                    </div>
                </div>

                <form className="mb-8 flex flex-col gap-4 rounded-xl border bg-gray-50 p-5">
                    <label className="font-semibold text-neutral-700">
                        Your Feedback
                    </label>
                    <Textarea
                        value={feedbackText}
                        onChange={(e) => setFeedbackText(e.target.value)}
                        placeholder="Write your feedback..."
                        rows={3}
                        className="resize-none"
                    />
                    <label className="font-semibold text-neutral-700">
                        Rating <span className="text-red-500">*</span>
                    </label>
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                    type="button"
                                    key={star}
                                    onClick={() => handleStarClick(star)}
                                    className="focus:outline-none"
                                >
                                    <Star
                                        size={28}
                                        weight={
                                            selectedRating && selectedRating >= star
                                                ? "fill"
                                                : "regular"
                                        }
                                        className={
                                            selectedRating && selectedRating >= star
                                                ? "text-yellow-400"
                                                : "text-gray-300"
                                        }
                                    />
                                </button>
                            ))}
                            <span className="ml-2 text-sm text-neutral-500">
                                {selectedRating
                                    ? `${selectedRating} Star${selectedRating > 1 ? "s" : ""}`
                                    : ""}
                            </span>
                        </div>

                    </div>
                    <MyButton
                        type="button"
                        buttonType="primary"
                        disable={
                            submitting ||
                            !selectedRating
                        }
                        className="w-fit"
                        onClick={handleSubmit}
                    >
                        {submitting ? "Submitting..." : "Submit Feedback"}
                    </MyButton>
                </form>

                {reviews.length > 0 && (
                    <div
                        className="animate-fade-in-up"
                        style={{ animationDelay: "0.1s" }}
                    >
                        {/* Enhanced Overall Rating Section */}
                        <div className="relative bg-gradient-to-br from-yellow-50/80 to-orange-50/80 backdrop-blur-sm border border-yellow-200/60 rounded-xl p-3 sm:p-4 lg:p-6 overflow-hidden group/rating">
                            {/* Background pattern */}
                            <div className="absolute inset-0 bg-gradient-to-br from-yellow-100/20 via-transparent to-orange-100/20 opacity-0 group-hover/rating:opacity-100 transition-opacity duration-500"></div>

                            <div className="relative grid grid-cols-1 lg:grid-cols-5 gap-4 lg:gap-6">
                                {/* Rating Score */}
                                <div className="lg:col-span-2 text-center lg:text-left space-y-3">
                                    <div className="inline-flex flex-col items-center lg:items-start space-y-2">
                                        <div className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900">
                                            {overallRatingData?.average_rating !==
                                                null &&
                                            overallRatingData?.average_rating !==
                                                undefined
                                                ? Number(
                                                      overallRatingData.average_rating
                                                  ).toFixed(1)
                                                : "N/A"}
                                        </div>
                                        <div className="flex items-center space-x-1.5">
                                            <StarRatingComponent
                                                score={
                                                    overallRatingData?.average_rating !==
                                                        null &&
                                                    overallRatingData?.average_rating !==
                                                        undefined
                                                        ? Number(
                                                              overallRatingData.average_rating
                                                          ) * 20
                                                        : 0
                                                }
                                                starColor={true}
                                            />
                                        </div>
                                        <div className="flex items-center space-x-1.5 text-gray-600">
                                            <TrendUp
                                                size={14}
                                                className="text-success-600"
                                                weight="duotone"
                                            />
                                            <span className="text-xs font-medium">
                                                {overallRatingData?.total_reviews !==
                                                    null &&
                                                overallRatingData?.total_reviews !==
                                                    undefined
                                                    ? overallRatingData.total_reviews
                                                    : 0}{" "}
                                                reviews
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Rating Breakdown */}
                                <div className="lg:col-span-3 space-y-2 sm:space-y-3">
                                    {[5, 4, 3, 2, 1].map((stars) => {
                                        const percentKey =
                                            `percent_${stars === 5 ? "five" : stars === 4 ? "four" : stars === 3 ? "three" : stars === 2 ? "two" : "one"}_star` as keyof typeof overallRatingData;
                                        const percent =
                                            overallRatingData?.[percentKey] ??
                                            0;

                                        return (
                                            <div
                                                key={stars}
                                                className="flex items-center gap-2 sm:gap-3 group/bar"
                                            >
                                                <div className="flex items-center space-x-1 text-xs font-medium text-gray-700 min-w-[50px]">
                                                    <Star
                                                        size={12}
                                                        className="text-yellow-500"
                                                        weight="fill"
                                                    />
                                                    <span>{stars}</span>
                                                </div>
                                                <div className="flex-1 relative">
                                                    <ProgressBar
                                                        value={percent}
                                                        className="h-1.5 bg-gray-200 rounded-full overflow-hidden group-hover/bar:h-2 transition-all duration-300"
                                                    />
                                                </div>
                                                <span className="text-xs font-bold text-gray-900 min-w-[40px] text-right">
                                                    {percent}%
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Reviews List */}
                <div
                    className={`${reviews.length === 0 ? "mt-0" : "mt-4 lg:mt-6"} space-y-3 sm:space-y-4 animate-fade-in-up`}
                    style={{ animationDelay: "0.2s" }}
                >
                    {isLoading ? (
                        <div className="space-y-3">
                            {[1, 2, 3].map((i) => (
                                <div
                                    key={i}
                                    className="bg-white/60 rounded-xl p-3 sm:p-4 animate-pulse"
                                >
                                    <div className="flex items-center space-x-3 mb-3">
                                        <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                                        <div className="flex-1 space-y-1.5">
                                            <div className="h-3 bg-gray-200 rounded w-1/4"></div>
                                            <div className="h-2.5 bg-gray-200 rounded w-1/6"></div>
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <div className="h-3 bg-gray-200 rounded w-full"></div>
                                        <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : reviews.length === 0 ? (
                        <div className="relative bg-white/60 backdrop-blur-sm border border-gray-200/60 rounded-xl p-6 sm:p-8 text-center overflow-hidden">
                            {/* Background pattern */}
                            <div className="absolute inset-0 bg-gradient-to-br from-gray-50/30 via-transparent to-primary-50/20 pointer-events-none"></div>

                            <div className="relative">
                                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl mx-auto mb-3 sm:mb-4 flex items-center justify-center">
                                    <ChatCircle
                                        size={24}
                                        className="text-gray-500"
                                        weight="duotone"
                                    />
                                </div>
                                <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-1">
                                    No reviews yet
                                </h3>
                                <p className="text-gray-600 text-xs sm:text-sm">
                                    Be the first to share your experience with
                                    this course
                                </p>
                            </div>
                        </div>
                    ) : (
                        reviews.map((review, index) => (
                            <div
                                key={review.id}
                                className="animate-fade-in-up"
                                style={{
                                    animationDelay: `${0.3 + index * 0.1}s`,
                                }}
                            >
                                <ReviewItem
                                    review={review}
                                    avatarUrl={avatarUrls[review.id]}
                                    onLike={handleLike}
                                    onDislike={handleDislike}
                                    onDelete={handleDelete}
                                    showActions={true}
                                    variant="default"
                                    currentUserId={currentUserId}
                                />
                            </div>
                        ))
                    )}

                    {/* Enhanced Pagination */}
                    {totalPages > 1 && (
                        <div
                            className="flex justify-center mt-4 lg:mt-6 animate-fade-in-up"
                            style={{ animationDelay: "0.5s" }}
                        >
                            <div className="bg-white/80 backdrop-blur-sm border border-gray-200/60 rounded-xl shadow-sm p-2">
                                <MyPagination
                                    currentPage={page}
                                    totalPages={totalPages}
                                    onPageChange={handlePageChange}
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
