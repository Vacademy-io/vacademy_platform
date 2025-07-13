import React, { useState, ChangeEvent } from 'react';
import { Search, ChevronDown } from 'lucide-react';

interface SearchAndSortBarProps {
   searchTerm: string;
  onSearchChange: (value: string) => void;
  sortOption: string;
  onSortChange: (value: string) => void;
}

const SearchAndSortBar: React.FC<SearchAndSortBarProps> = ({ 
  searchTerm,
  onSearchChange,
  sortOption,
  onSortChange 
}) => {
   const [inputValue, setInputValue] = useState(searchTerm);

   const handleKeyDown = (e: React.KeyboardEvent) => {
     if (e.key === 'Enter') {
       onSearchChange(inputValue);
     }
   };

   const handleSearch = () => {
     onSearchChange(inputValue);
   };
  
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 mb-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {/* Search Section */}
        <div className="flex-1 max-w-lg">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search courses..." 
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-colors"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleSearch}
            />
          </div>
        </div>

        {/* Sort Section */}
        <div className="flex items-center space-x-3">
          <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Sort by:</label>
          <div className="relative">
            <select 
              value={sortOption}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => onSortChange(e.target.value)}
              className="appearance-none bg-gray-50 border border-gray-200 rounded-md px-3 py-2.5 pr-8 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-colors cursor-pointer min-w-[140px]"
            >
              <option value="Newest">Newest First</option>
              <option value="Oldest">Oldest First</option>
              <option value="Popularity">Most Popular</option>
              <option value="Rating">Highest Rated</option>
            </select>
            <ChevronDown size={16} className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SearchAndSortBar; 