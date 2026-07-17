import { CaretLeft, CaretRight } from '@phosphor-icons/react';
import React from 'react';
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";


interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

const Pagination: React.FC<PaginationProps> = ({ currentPage, totalPages, onPageChange }) => {
  const { t } = useTranslation("study");

  const renderPageNumbers = (): (number | string)[] => {
    // ... (logic remains same, just ensuring we don't break it)
    const pageNumbers: (number | string)[] = [];
    const smallTotalPagesThreshold = 4;

    if (totalPages <= smallTotalPagesThreshold) {
      for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(i);
      }
    } else if (totalPages > 10) {
      pageNumbers.push(1);
      if (totalPages >= 2) pageNumbers.push(2);
      if (totalPages >= 3) pageNumbers.push(3);

      const dynamicBlockStart = Math.max(4, currentPage - 2);
      const dynamicBlockEnd = Math.min(totalPages - 1, currentPage + 2);

      if (dynamicBlockStart > 4) {
        pageNumbers.push('...');
      }

      for (let i = dynamicBlockStart; i <= dynamicBlockEnd; i++) {
        pageNumbers.push(i);
      }

      if (dynamicBlockEnd < totalPages - 1) {
        pageNumbers.push('...');
      }

      if (totalPages > 3) {
        pageNumbers.push(totalPages);
      }

    } else {
      pageNumbers.push(1);
      let startPage: number, endPage: number;

      if (currentPage <= 6) {
        startPage = 2;
        endPage = Math.min(totalPages - 1, 7);
      } else if (currentPage > totalPages - 5) {
        startPage = Math.max(2, totalPages - 6);
        endPage = totalPages - 1;
      } else {
        startPage = currentPage - 2;
        endPage = currentPage + 2;
      }

      if (startPage > 2) {
        pageNumbers.push('...');
      }

      for (let i = startPage; i <= endPage; i++) {
        if (i > 1 && i < totalPages) {
          pageNumbers.push(i);
        }
      }

      if (endPage < totalPages - 1) {
        pageNumbers.push('...');
      }
      if (totalPages > 1) {
        pageNumbers.push(totalPages);
      }
    }
    return [...new Set(pageNumbers)].filter(p => p !== 0 && p !== null && p !== undefined) as (number | string)[];
  };

  const pagesToDisplay = renderPageNumbers();

  if (totalPages <= 1 && pagesToDisplay.length <= 1) return null;

  return (
    <div className="flex items-center justify-center mt-8 mb-4">
      <nav className="flex items-center gap-1.5" aria-label={t("pagination.ariaLabel")}>
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className={cn(
            "inline-flex items-center justify-center h-9 px-3 rounded-full border border-input bg-background text-sm font-medium text-muted-foreground hover:bg-primary-50 hover:text-primary hover:border-primary-200 disabled:opacity-40 disabled:hover:bg-background disabled:hover:text-muted-foreground disabled:hover:border-input transition-all",
            "[.ui-vibrant_&]:border-primary/20 [.ui-vibrant_&]:text-primary/70 [.ui-vibrant_&]:hover:bg-primary/5 [.ui-vibrant_&]:hover:text-primary"
          )}
        >
          <CaretLeft className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only">{t("pagination.previous")}</span>
        </button>

        {pagesToDisplay.map((page, index) => (
          <button
            key={index}
            onClick={() => typeof page === 'number' && onPageChange(page)}
            aria-current={page === currentPage ? 'page' : undefined}
            className={cn(
              "inline-flex items-center justify-center h-9 min-w-9 px-2 rounded-full text-sm font-medium transition-all",
              page === currentPage
                ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
                : "bg-background text-muted-foreground border border-transparent hover:bg-primary-50 hover:text-primary",
              typeof page !== 'number' && "cursor-default hover:bg-background hover:text-muted-foreground",
              page === currentPage && "[.ui-vibrant_&]:bg-gradient-to-br [.ui-vibrant_&]:from-primary [.ui-vibrant_&]:to-primary/90 [.ui-vibrant_&]:shadow-md",
              page !== currentPage && typeof page === 'number' && "[.ui-vibrant_&]:text-primary/70 [.ui-vibrant_&]:hover:bg-primary/5 [.ui-vibrant_&]:hover:text-primary"
            )}
            disabled={typeof page !== 'number'}
          >
            {page}
          </button>
        ))}

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className={cn(
            "inline-flex items-center justify-center h-9 px-3 rounded-full border border-input bg-background text-sm font-medium text-muted-foreground hover:bg-primary-50 hover:text-primary hover:border-primary-200 disabled:opacity-40 disabled:hover:bg-background disabled:hover:text-muted-foreground disabled:hover:border-input transition-all",
            "[.ui-vibrant_&]:border-primary/20 [.ui-vibrant_&]:text-primary/70 [.ui-vibrant_&]:hover:bg-primary/5 [.ui-vibrant_&]:hover:text-primary"
          )}
        >
          <CaretRight className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only">{t("pagination.next")}</span>
        </button>
      </nav>
    </div>
  );
};

export default Pagination; 