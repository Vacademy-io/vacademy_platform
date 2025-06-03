import React, { ChangeEvent } from 'react';
import { ChevronDownIcon } from 'lucide-react';
import { MagnifyingGlassIcon } from '@radix-ui/react-icons';

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
  return (
    <div className="flex flex-col md:flex-row justify-between items-center mb-6 bg-white p-4 rounded-lg shadow">
      <div className="relative w-full md:w-2/3 lg:w-1/2 mb-4 md:mb-0">
        <input 
          type="text" 
          placeholder="Search courses by title or instructor..." 
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          value={searchTerm}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onSearchChange(e.target.value)}
        />
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
      </div>

      <div className="relative w-full md:w-auto">
        <select 
          value={sortOption}
          onChange={(e: ChangeEvent<HTMLSelectElement>) => onSortChange(e.target.value)}
          className="appearance-none w-full md:w-auto bg-white border border-gray-300 text-gray-700 py-2 px-4 pr-8 rounded-md leading-tight focus:outline-none focus:bg-white focus:border-blue-500 hover:border-gray-400"
        >
          <option value="Newest">Sort by: Newest</option>
          <option value="Oldest">Sort by: Oldest</option>
          <option value="Popularity">Sort by: Popularity</option>
          <option value="Rating">Sort by: Rating</option>
        </select>
        <ChevronDownIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
      </div>
    </div>
  );
};

export default SearchAndSortBar; 