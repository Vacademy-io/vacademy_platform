import {
    Pagination,
    PaginationContent,
    PaginationEllipsis,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
} from "@/components/ui/pagination";
import { MyInput } from "./input";
import { useState } from "react";
import { KeyReturn, XCircle } from "@phosphor-icons/react";

interface PaginationProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
}

export function MyPagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
    const [pageInput, setPageInput] = useState("");
    const [submittedPage, setSubmittedPage] = useState("");

    const handlePageInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const input = event.target.value;
        const numericValue = input.replace(/[^0-9]/g, ""); // Remove non-numeric characters
        setPageInput(numericValue);
    };

    const handlePageInputSubmit = () => {
        const newPage = parseInt(pageInput);
        if (!isNaN(newPage) && newPage >= 1 && newPage <= totalPages) {
            onPageChange(newPage - 1);
            setSubmittedPage(pageInput);
        }
    };

    const handleClearPageInput = () => {
        setPageInput("");
        setSubmittedPage("");
    };

    const handlePreviousPage = () => {
        if (currentPage > 0) {
            onPageChange(currentPage - 1);
        }
    };

    const handleNextPage = () => {
        if (currentPage < totalPages - 1) {
            onPageChange(currentPage + 1);
        }
    };

    return (
        <div className="flex w-full items-center justify-center gap-16 text-body text-neutral-600">
            <Pagination className="mx-0 w-fit">
                <PaginationContent className="w-fit">
                    <PaginationItem>
                        <PaginationPrevious
                            onClick={handlePreviousPage}
                            className={
                                currentPage === 0
                                    ? "pointer-events-none opacity-50"
                                    : "cursor-pointer"
                            }
                        />
                    </PaginationItem>

                    <PaginationItem>
                        <PaginationLink
                            onClick={() => onPageChange(0)}
                            isActive={currentPage === 0}
                            className="cursor-pointer"
                        >
                            1
                        </PaginationLink>
                    </PaginationItem>

                    {totalPages < 2 ? (
                        <></>
                    ) : totalPages > 1 && (currentPage === 0 || currentPage === totalPages - 1) ? (
                        <>
                            <PaginationItem>
                                <PaginationEllipsis />
                            </PaginationItem>
                            <PaginationItem>
                                <PaginationLink
                                    onClick={() => onPageChange(totalPages - 1)}
                                    isActive={currentPage === totalPages - 1}
                                    className="cursor-pointer"
                                >
                                    {totalPages}
                                </PaginationLink>
                            </PaginationItem>
                        </>
                    ) : (
                        <>
                            <PaginationItem className="flex flex-row">
                                <PaginationEllipsis />
                                <PaginationLink
                                    // onClick={() => onPageChange(0)}
                                    isActive={true}
                                    className="cursor-pointer"
                                >
                                    {currentPage + 1}
                                </PaginationLink>
                                <PaginationEllipsis />
                            </PaginationItem>
                            <PaginationItem>
                                <PaginationLink
                                    onClick={() => onPageChange(totalPages - 1)}
                                    isActive={currentPage === totalPages - 1}
                                    className="cursor-pointer"
                                >
                                    {totalPages}
                                </PaginationLink>
                            </PaginationItem>
                        </>
                    )}

                    <PaginationItem>
                        <PaginationNext
                            onClick={handleNextPage}
                            className={
                                currentPage === totalPages - 1
                                    ? "pointer-events-none opacity-50"
                                    : "cursor-pointer"
                            }
                        />
                    </PaginationItem>
                </PaginationContent>
            </Pagination>

            {totalPages > 1 && (
                <div className="flex items-center gap-2">
                    <div>Go to</div>
                    <div className="relative">
                        <MyInput
                            inputType="text"
                            input={pageInput}
                            onChangeFunction={handlePageInputChange}
                            className="h-7 w-[50px] pr-7"
                        />
                        <KeyReturn
                            weight="fill"
                            className={`absolute right-2 top-1/4 size-[18px] cursor-pointer text-primary-500 ${
                                (pageInput.length || (submittedPage.length && !pageInput.length)) &&
                                submittedPage !== pageInput
                                    ? "visible"
                                    : "hidden"
                            }`}
                            onClick={handlePageInputSubmit}
                        />
                        <XCircle
                            className={`absolute right-2 top-1/4 size-[18px] cursor-pointer text-neutral-400 ${
                                pageInput === submittedPage && pageInput !== ""
                                    ? "visible"
                                    : "hidden"
                            }`}
                            onClick={handleClearPageInput}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
