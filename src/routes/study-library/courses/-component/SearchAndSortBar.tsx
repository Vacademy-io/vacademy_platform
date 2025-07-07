import React, { useState, ChangeEvent } from 'react';
import { ChevronDown, Search, SortAsc, Sparkles } from 'lucide-react';
import { MagnifyingGlass, SortAscending, Funnel } from 'phosphor-react';

interface SearchAndSortBarProps {
   searchTerm:string;
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

   const handleKeyDown = () => {
         onSearchChange(inputValue);
   }

   const getSortIcon = () => {
    switch (sortOption) {
      case "Newest":
        return <Sparkles size={16} className="text-primary-600" />;
      case "Rating":
        return <SortAscending size={16} className="text-primary-600" weight="duotone" />;
      default:
        return <Funnel size={16} className="text-primary-600" weight="duotone" />;
    }
  };
  
  return (
    <div className="relative bg-white/80 backdrop-blur-sm border border-gray-200/60 rounded-2xl shadow-sm hover:shadow-lg transition-all duration-500 p-2 sm:p-3 mb-3 sm:mb-4 overflow-hidden w-full max-w-full animate-fade-in-up">
      {/* Background gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-50/30 via-transparent to-primary-50/20 pointer-events-none"></div>
      
      {/* Floating orb effect */}
      <div className="absolute top-0 right-0 w-16 h-16 bg-primary-100/20 rounded-full blur-2xl opacity-70 -translate-y-2 translate-x-4"></div>
      
              <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 lg:gap-4">
        {/* Search Section */}
        <div className="flex-1 lg:max-w-2xl">
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-primary-500/10 to-primary-600/10 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
            
            <div className="relative bg-white/80 backdrop-blur-sm border border-gray-200/60 rounded-xl shadow-sm hover:shadow-md transition-all duration-300 group-hover:border-primary-300">
              <div className="absolute left-4 top-1/2 -translate-y-1/2">
                <MagnifyingGlass size={20} className="text-gray-400 group-hover:text-primary-500 transition-colors duration-300" weight="duotone" />
              </div>
              
              <input 
                type="text" 
                placeholder="Search courses, topics, or instructors..." 
                className="w-full pl-12 pr-4 py-2.5 sm:py-3 bg-transparent border-0 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-0 text-sm sm:text-base font-medium rounded-xl"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleKeyDown()}
              />
              
              {/* Search highlight effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-primary-400/5 to-primary-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl pointer-events-none"></div>
            </div>
          </div>
        </div>

        {/* Sort Section */}
        <div className="flex items-center space-x-3 lg:space-x-4">
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <SortAscending size={16} weight="duotone" className="text-primary-600" />
            <span className="font-medium hidden sm:inline">Sort by:</span>
          </div>
          
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-primary-500/10 to-primary-600/10 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
            
            <select 
              value={sortOption}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => onSortChange(e.target.value)}
              className="appearance-none bg-white/80 backdrop-blur-sm border border-gray-200/60 rounded-xl px-3 py-2 sm:py-2.5 pr-8 text-sm sm:text-base font-medium text-gray-900 hover:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-300 cursor-pointer min-w-[130px] sm:min-w-[150px]"
            >
              <option value="Newest">Newest First</option>
              <option value="Oldest">Oldest First</option>
              <option value="Popularity">Most Popular</option>
              <option value="Rating">Highest Rated</option>
            </select>
            
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center space-x-1 pointer-events-none">
              {getSortIcon()}
              <ChevronDown size={14} className="text-gray-500 group-hover:text-primary-600 transition-colors duration-300" />
            </div>
            
            {/* Sort highlight effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-primary-400/5 to-primary-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl pointer-events-none"></div>
          </div>
        </div>
      </div>

      {/* Results count or search suggestions (if needed) */}
      {inputValue && (
        <div className="mt-4 pt-4 border-t border-gray-200/60">
          <div className="flex items-center space-x-2 text-xs sm:text-sm text-gray-600">
            <Search size={14} className="text-primary-500" />
            <span>Searching for: <span className="font-semibold text-gray-900">"{inputValue}"</span></span>
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchAndSortBar; 