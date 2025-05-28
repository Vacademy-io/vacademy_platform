import { useState } from "react";

interface UsePaginationStateProps {
    initialPage?: number;
    initialPageSize?: number;
}

interface PaginationState {
    page: number;
    pageSize: number;
    handlePageChange: (newPage: number) => void;
}

export const usePaginationState = ({
    initialPage = 0,
    initialPageSize = 10,
}: UsePaginationStateProps = {}): PaginationState => {
    const [page, setPage] = useState(initialPage);
    const [pageSize] = useState(initialPageSize);

    const handlePageChange = (newPage: number) => {
        setPage(newPage);
    };

    return {
        page,
        pageSize,
        handlePageChange,
    };
};
