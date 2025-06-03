import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import React from 'react';



interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

const Pagination: React.FC<PaginationProps> = ({ currentPage, totalPages, onPageChange }) => {
  const renderPageNumbers = (): (number | string)[] => {
    const pageNumbers: (number | string)[] = [];
    const displayPages = 4; 

    if (totalPages <= displayPages) {
      for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(i);
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

  if (totalPages <=1 && pagesToDisplay.length <=1) return null;

  return (
    <div className="flex items-center justify-center mt-8 mb-4">
      <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 transition-opacity"
        >
          <span className="sr-only">Previous</span>
          <ChevronLeftIcon className="h-5 w-5" aria-hidden="true" />
        </button>

        {pagesToDisplay.map((page, index) => (
          <button
            key={index} 
            onClick={() => typeof page === 'number' && onPageChange(page)}
            aria-current={page === currentPage ? 'page' : undefined}
            className={`relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium
              ${page === currentPage 
                ? 'z-10 bg-blue-600 text-white border-blue-600' 
                : 'bg-white text-gray-700 hover:bg-gray-50'}
              ${typeof page !== 'number' ? 'text-gray-500 cursor-default' : ''}`
            }
            disabled={typeof page !== 'number'}
          >
            {page}
          </button>
        ))}

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 transition-opacity"
        >
          <span className="sr-only">Next</span>
          <ChevronRightIcon className="h-5 w-5" aria-hidden="true" />
        </button>
      </nav>
    </div>
  );
};

export default Pagination; 