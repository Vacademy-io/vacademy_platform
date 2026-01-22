import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getInstituteId } from "@/constants/helper";
import { urlPublicCourseDetails } from "@/constants/urls";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { cn } from "@/lib/utils";
import { BookOpen, ChevronLeft, ChevronRight } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";

interface MyBooksWidgetProps {
    className?: string;
}

export const MyBooksWidget: React.FC<MyBooksWidgetProps> = ({ className }) => {
    const [loading, setLoading] = useState(true);
    const [allBooks, setAllBooks] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState("purchased");
    const [page, setPage] = useState(0);
    const pageSize = 10;

    useEffect(() => {
        const fetchBooks = async () => {
            try {
                const instituteId = await getInstituteId();
                const response = await authenticatedAxiosInstance.post(
                    urlPublicCourseDetails,
                    {
                        status: [],
                        level_ids: [],
                        faculty_ids: [],
                        search_by_name: "",
                        tag: [],
                        min_percentage_completed: 0,
                        max_percentage_completed: 0,
                        type: "PROGRESS",
                        sort_columns: { createdAt: "DESC" },
                    },
                    {
                        params: { instituteId, page: 0, size: 100 },
                    }
                );

                const allContent = response.data?.content || [];
                setAllBooks(allContent);
            } catch (error) {
                // Silently skip
            } finally {
                setLoading(false);
            }
        };

        fetchBooks();
    }, []);

    const filteredBooks = allBooks.filter((pkg: any) => {
        const packageType = (pkg.package_type || "").trim().toUpperCase();
        const levelName = (pkg.level_name || "").trim().toLowerCase();

        if (activeTab === "purchased") {
            return packageType === "COURSE" && levelName === "buy";
        } else {
            return packageType === "COURSE" && levelName === "rent";
        }
    });

    const uniqueBooks = filteredBooks.filter((pkg: any, index: number, self: any[]) =>
        index === self.findIndex((p) => p.package_name === pkg.package_name)
    );

    const totalPages = Math.ceil(uniqueBooks.length / pageSize);
    const paginatedBooks = uniqueBooks.slice(page * pageSize, (page + 1) * pageSize);

    if (loading) {
        return (
            <Card className={cn("border border-border shadow-sm bg-card", className)}>
                <CardHeader className="p-4 pb-2">
                    <Skeleton className="h-5 w-32" />
                </CardHeader>
                <CardContent className="p-4">
                    <Skeleton className="h-16 w-full rounded-lg" />
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className={cn("border border-border shadow-sm bg-card", className)}>
            <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-primary uppercase">
                    <BookOpen className="w-5 h-5" />
                    COURSES
                </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
                <Tabs defaultValue="purchased" className="w-full" onValueChange={(v) => { setActiveTab(v); setPage(0); }}>
                    <TabsList className="grid w-full grid-cols-2 mb-3 bg-secondary/30 h-8 p-1">
                        <TabsTrigger value="purchased" className="text-xs py-1 h-6">Purchased</TabsTrigger>
                        <TabsTrigger value="rented" className="text-xs py-1 h-6">Rented</TabsTrigger>
                    </TabsList>

                    <div className="space-y-2 transition-all duration-300">
                        {paginatedBooks.length > 0 ? (
                            <div className="grid grid-cols-1 gap-2">
                                {paginatedBooks.map((book, idx) => (
                                    <div
                                        key={book.id || idx}
                                        className="flex items-center gap-3 p-2.5 rounded-lg border border-border bg-card hover:bg-secondary/20 transition-colors shadow-sm"
                                    >
                                        <div className="w-7 h-7 rounded-md bg-primary/5 flex items-center justify-center flex-shrink-0">
                                            <BookOpen className="w-3.5 h-3.5 text-primary" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-xs font-bold text-foreground truncate leading-tight">
                                                {book.package_name}
                                            </p>
                                            {book.instructors?.[0] && (
                                                <p className="text-[9px] font-medium text-muted-foreground truncate leading-none mt-0.5">
                                                    {book.instructors[0].full_name}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="py-4 px-3 rounded-lg border border-dashed border-border flex flex-col items-center justify-center text-center bg-secondary/10">
                                <p className="text-[11px] text-muted-foreground italic font-medium">No {activeTab} books available.</p>
                            </div>
                        )}
                    </div>

                    {totalPages > 1 && (
                        <div className="flex items-center justify-between mt-3 pt-2 border-t border-border">
                            <span className="text-[9px] text-muted-foreground font-black uppercase tracking-tighter">
                                {page + 1} / {totalPages}
                            </span>
                            <div className="flex gap-1">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 hover:bg-secondary"
                                    disabled={page === 0}
                                    onClick={() => setPage(prev => Math.max(0, prev - 1))}
                                >
                                    <ChevronLeft className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 hover:bg-secondary"
                                    disabled={page === totalPages - 1}
                                    onClick={() => setPage(prev => Math.min(totalPages - 1, prev + 1))}
                                >
                                    <ChevronRight className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                        </div>
                    )}
                </Tabs>
            </CardContent>
        </Card>
    );
};
