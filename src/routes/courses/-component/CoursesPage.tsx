import React, { useState, useCallback } from 'react';
import FilterPanel from './FilterPanel.tsx'; // Assuming .tsx or will be converted
import SearchAndSortBar from './SearchAndSortBar.tsx';
import CourseCards from './CourseCards.tsx';
import Pagination from './Pagination.tsx';

const CoursesPage: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sortOption, setSortOption] = useState<string>('Newest'); // Added sortOption state

  const handlePageChange = useCallback((page: number) => {
    if (page > 0 && page <= totalPages) {
      setCurrentPage(page);
    }
  }, [totalPages]);

  const handleTotalPagesDetermined = useCallback((calculatedTotalPages: number) => {
    setTotalPages(calculatedTotalPages > 0 ? calculatedTotalPages : 1);
    if (currentPage > calculatedTotalPages && calculatedTotalPages > 0) {
      setCurrentPage(calculatedTotalPages);
    } else if (currentPage === 0 && calculatedTotalPages > 0) {
      setCurrentPage(1);
    }
  }, [currentPage]);

  const handleSearchChange = useCallback((term: string) => {
    setSearchTerm(term);
    setCurrentPage(1);
  }, []);

  const handleSortChange = useCallback((option: string) => { // Added handleSortChange
    setSortOption(option);
    setCurrentPage(1); // Reset to first page on sort change
  }, []);

  return (
    <div className="flex flex-col lg:flex-row p-4 lg:p-8 bg-gray-50 min-h-screen">
      <div className="w-full lg:w-1/4 lg:pr-8 mb-8 lg:mb-0">
        <div className="lg:sticky lg:top-8">
          <FilterPanel />
        </div>
      </div>

      <div className="w-full lg:w-3/4">
        <SearchAndSortBar 
          searchTerm={searchTerm} 
          onSearchChange={handleSearchChange}
          sortOption={sortOption} // Pass sortOption
          onSortChange={handleSortChange} // Pass handleSortChange
        />
        <CourseCards 
          currentPage={currentPage} 
          onTotalPagesDetermined={handleTotalPagesDetermined} 
          searchTerm={searchTerm}
          // sortOption={sortOption} // If CourseCards needs to sort, pass it here
        />
        <Pagination 
          currentPage={currentPage} 
          totalPages={totalPages} 
          onPageChange={handlePageChange} 
        />
      </div>
    </div>
  );
};

export default CoursesPage; 