import React, { useState, useEffect } from "react";
import { getPublicUrlWithoutLogin } from "@/services/upload_file";
import { User } from "lucide-react";

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

    // Use the cover field from props if available, otherwise fall back to previewImage or thumbnail
    const coverMediaId = courseData.previewImage || courseData.thumbnail;

    useEffect(() => {
        if (coverMediaId) {
            getPublicUrlWithoutLogin(coverMediaId).then(url => url && setCoverUrl(url));
        }
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
    const authorName = extractTextFromHtml(courseData.course_html_description_html) || 
                       courseData.instructor || 
                       courseData.instructors?.[0]?.name || 
                       "Unknown Author";

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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-12">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-12">
                {/* Left Column: Book Image */}
                <div className="md:col-span-4 lg:col-span-3">
                    <div className="sticky top-24">
                        <div className="aspect-[9/16] rounded-lg overflow-hidden shadow-2xl bg-gray-100">
                            {coverUrl ? (
                                <img src={coverUrl} alt={courseData.title || "Book"} className="w-full h-full min-w-[50px] min-h-[100px] object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-400">Loading Cover...</div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Column: Details */}
                <div className="md:col-span-8 lg:col-span-9 space-y-8">
                    {/* Author Name */}
                    <div className="flex items-center gap-2 text-gray-700">
                        <User className="h-5 w-5 text-gray-500" />
                        <span className="text-lg font-medium">{authorName}</span>
                    </div>

                    {/* Tags */}
                    {tags && tags.length > 0 && (
                        <div>
                            <div className="flex flex-wrap gap-2">
                                <span className="text-sm font-medium text-gray-600">Tags :</span>
                                {tags.map((tag: string, index: number) => (
                                    <span 
                                        key={index} 
                                        className="px-3 py-1 bg-gray-100 text-gray-600 text-sm font-medium rounded-full"
                                    >
                                       {tag}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Price */}
                    <div className="bg-gray-50 rounded-xl p-6">
                        <p className="text-sm text-gray-500 mb-1">Price</p>
                        <div className="text-3xl font-bold text-gray-900">
                            {courseData.price === 0 ? "Free" : `₹${courseData.price}`}
                        </div>
                    </div>

                    {/* About Book */}
                    <div>
                        <h3 className="text-xl font-bold text-gray-900 mb-4">About this Book</h3>
                        <div
                            className="prose prose-gray max-w-none text-gray-600 leading-relaxed"
                            dangerouslySetInnerHTML={{ __html: aboutBook }}
                        />
                    </div>

                   
                </div>
            </div>
        </div>
    );
};
