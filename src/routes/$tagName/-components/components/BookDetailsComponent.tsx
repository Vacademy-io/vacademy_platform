import React, { useState, useEffect } from "react";
import { getPublicUrlWithoutLogin } from "@/services/upload_file";
import { User, ShoppingCart, Plus, Minus } from "lucide-react";
import { useCartStore } from "../../-stores/cart-store";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface BookDetailsProps {
    fields?: {
        title: string;
        description: string;
        whyLearn: string;
        whoShouldLearn: string;
        duration: string;
        level: string;
        tags: string;
        previewImage: string;
        banner: string;
        rating: string;
        price: string;
        cover?: string;
    };
    showEnquiry?: boolean;
    showPayment?: boolean;
    showAddToCart?: boolean;
    courseData?: any; // The real data fetched from CourseDetailsPage
}

export const BookDetailsComponent: React.FC<BookDetailsProps> = ({
    courseData
}) => {
    // If courseData is missing, we can't do much (it usually comes from the parent page fetching it)
    if (!courseData) return null;

    const [coverUrl, setCoverUrl] = useState("");
    const { addItem, getItemByEnrollInviteId, updateQuantity, getCartMode, syncCart } = useCartStore();

    // Get current cart mode
    const [cartMode, setCartMode] = useState<'buy' | 'rent'>(() => getCartMode());

    // Sync cart when levelFilter changes
    useEffect(() => {
        const checkLevelFilter = () => {
            const levelFilter = sessionStorage.getItem('levelFilter') || '';
            const newMode = levelFilter.includes('Rent') ? 'rent' : 'buy';
            if (newMode !== cartMode) {
                setCartMode(newMode);
                syncCart();
            }
        };

        checkLevelFilter();
        const interval = setInterval(checkLevelFilter, 500);

        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === 'levelFilter') {
                checkLevelFilter();
            }
        };
        window.addEventListener('storage', handleStorageChange);

        const handleLevelFilterChange = () => {
            checkLevelFilter();
        };
        window.addEventListener('levelFilterChanged', handleLevelFilterChange);

        return () => {
            clearInterval(interval);
            window.removeEventListener('storage', handleStorageChange);
            window.removeEventListener('levelFilterChanged', handleLevelFilterChange);
        };
    }, [cartMode, syncCart]);

    // Use the cover field from props if available, otherwise fall back to previewImage or thumbnail
    const coverMediaId = courseData.course_banner_media_id;

    useEffect(() => {
        let mounted = true;
        if (coverMediaId && coverMediaId.trim() !== "") {
            getPublicUrlWithoutLogin(coverMediaId)
                .then(url => {
                    if (mounted) {
                        if (url) setCoverUrl(url);
                        else setCoverUrl("/api/placeholder/300/400");
                    }
                })
                .catch(() => {
                    if (mounted) setCoverUrl("/api/placeholder/300/400");
                });
        } else {
            setCoverUrl("/api/placeholder/300/400");
        }
        return () => {
            mounted = false;
        };
    }, [coverMediaId]);

    // Helper function to extract text from HTML
    const extractTextFromHtml = (htmlString: string | undefined | null): string => {
        if (!htmlString) return "";
        return htmlString
            .replace(/<[^>]*>/g, "")
            .replace(/&nbsp;/g, " ")
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .trim();
    };

    // Get author name from course_html_description_html (extract text from HTML)
    const authorName = extractTextFromHtml(courseData.course_html_description_html) || "Unknown Author";

    // Get about book content from about_the_course_html
    const aboutBook = courseData.about_the_course_html || courseData.aboutCourse || "";

    // Parse comma-separated tags from comma_separeted_tags
    const parseCommaSeparatedTags = (tagsString: string | undefined | null): string[] => {
        if (!tagsString) return [];
        return tagsString
            .split(',')
            .map(tag => tag.trim())
            .filter(tag => tag.length > 0);
    };

    // Get tags from comma_separeted_tags or fallback to tags array
    const tags = courseData.comma_separeted_tags
        ? parseCommaSeparatedTags(courseData.comma_separeted_tags)
        : (courseData.tags || []);

    return (
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 pt-20 pb-8">
            {/* Mobile-First Layout */}
            <div className="flex flex-col md:flex-row md:gap-6 lg:gap-8">
                {/* Book Image Section - Larger on Mobile */}
                <div className="w-full md:w-2/5 lg:w-1/3 mb-4 md:mb-0">
                    <div className="md:sticky md:top-24">
                        <div className="aspect-[9/16] w-full max-w-[280px] mx-auto md:max-w-none rounded-xl overflow-hidden shadow-2xl bg-gray-100 transition-transform duration-300 hover:shadow-3xl">
                            {coverUrl ? (
                                <img
                                    src={coverUrl}
                                    alt={courseData.title || "Book"}
                                    className="w-full h-full object-cover transition-transform duration-300 hover:scale-[1.02]"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">Loading Cover...</div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Details Section */}
                <div className="flex-1 space-y-4 md:space-y-5">
                    {/* Book Title */}
                    <div>
                        <h1 className="text-xl sm:text-2xl md:text-2xl font-semibold text-gray-900 leading-snug mb-3">
                            {courseData.title}
                        </h1>
                    </div>

                    {/* Author Name */}
                    <div className="flex items-center gap-2 text-gray-700 pb-2 border-b border-gray-200">
                        <User className="h-4 w-4 text-gray-500 flex-shrink-0" />
                        <span className="text-sm sm:text-base font-medium">{authorName}</span>
                    </div>

                    {/* Tags Section */}
                    {tags && tags.length > 0 && (
                        <div className="pb-3 border-b border-gray-200">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs sm:text-sm font-medium text-gray-600">Genre:</span>
                                {tags.map((tag: string, index: number) => (
                                    <span
                                        key={index}
                                        className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium rounded-full transition-colors duration-200 cursor-default"
                                    >
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Price / Add to Cart Section */}
                    <div className="p-4 sm:p-5">
                        {/* Show Price for Buy mode */}
                        {cartMode === 'buy' && (
                            <div className="mb-4 pb-3 border-b border-gray-200">
                                <p className="text-sm text-gray-500 mb-1">Price</p>
                                <div className="text-2xl sm:text-3xl font-bold text-gray-900">
                                    {courseData.price === 0 ? "Free" : `₹${courseData.price}`}
                                </div>
                            </div>
                        )}

                        {/* Add to Cart Button or Counter */}
                        {(() => {
                            const existingItem = courseData.enrollInviteId ? getItemByEnrollInviteId(courseData.enrollInviteId) : null;
                            const isBuyMode = cartMode === 'buy';

                            // Show counter for Buy mode if item exists
                            if (isBuyMode && existingItem) {
                                return (
                                    <div className="flex items-center gap-2">
                                        <div className="flex items-center gap-1 border border-gray-200 rounded-lg bg-gray-50 shadow-sm hover:bg-gray-100 transition-colors">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-9 w-9 hover:bg-white active:bg-gray-200 rounded-l-lg transition-all duration-150"
                                                onClick={async () => {
                                                    if (courseData.enrollInviteId) {
                                                        await updateQuantity(courseData.enrollInviteId, existingItem.quantity - 1);
                                                        window.dispatchEvent(new CustomEvent('cartUpdated'));
                                                    }
                                                }}
                                                disabled={!courseData.enrollInviteId}
                                            >
                                                <Minus className="h-4 w-4" />
                                            </Button>
                                            <span className="w-10 text-center text-sm font-semibold text-gray-700">{existingItem.quantity}</span>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-9 w-9 hover:bg-white active:bg-gray-200 rounded-r-lg transition-all duration-150"
                                                onClick={async () => {
                                                    if (courseData.enrollInviteId) {
                                                        await updateQuantity(courseData.enrollInviteId, existingItem.quantity + 1);
                                                        window.dispatchEvent(new CustomEvent('cartUpdated'));
                                                    }
                                                }}
                                                disabled={!courseData.enrollInviteId}
                                            >
                                                <Plus className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                );
                            }

                            // Show Add to Cart button
                            return (
                                <Button
                                    className="w-min-[40px] sm:w-auto bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-sm sm:text-base py-2.5 px-6 rounded-lg shadow-md transform transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
                                    onClick={async () => {
                                        if (courseData.enrollInviteId) {
                                            const existing = getItemByEnrollInviteId(courseData.enrollInviteId);
                                            if (existing && !isBuyMode) {
                                                toast.info("This item is already in the cart", { duration: 2000 });
                                            } else {
                                                await addItem({
                                                    id: courseData.courseId || courseData.id,
                                                    title: courseData.title,
                                                    price: courseData.price,
                                                    image: coverUrl,
                                                    level: courseData.level_name,
                                                    packageSessionId: courseData.packageSessionId,
                                                    enrollInviteId: courseData.enrollInviteId,
                                                    levelId: courseData.levelId,
                                                    courseId: courseData.courseId
                                                });
                                                // Dispatch event to update cart count in header
                                                window.dispatchEvent(new CustomEvent('cartUpdated'));
                                                toast.success("Added to cart", { duration: 2000 });
                                            }
                                        } else {
                                            toast.error("Cannot add to cart: Missing enrollment info", { duration: 2000 });
                                        }
                                    }}
                                >
                                    <ShoppingCart className="h-4 w-4" />
                                    Add to Cart
                                </Button>
                            );
                        })()}
                    </div>

                    {/* About Book Section */}
                    <div className="pt-2">
                        <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 pb-2 border-b border-gray-200">
                            About this Book
                        </h3>
                        <div
                            className="prose prose-sm sm:prose-base max-w-none text-gray-700 leading-relaxed text-sm sm:text-base"
                            style={{
                                fontSize: '0.875rem',
                                lineHeight: '1.625rem'
                            }}
                            dangerouslySetInnerHTML={{ __html: aboutBook }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
