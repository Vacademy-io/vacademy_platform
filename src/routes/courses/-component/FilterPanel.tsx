import React, { useState } from 'react';

// Define props for FilterSection internal component
interface FilterSectionProps {
  title: string;
  items: { id: string; name: string }[];
  selectedItems: string[];
  handleChange: (itemId: string) => void;
  disabled?: boolean;
}

const FilterSection: React.FC<FilterSectionProps> = ({ title, items, selectedItems, handleChange, disabled }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const initialDisplayCount = 3;
  const canExpand = items.length > initialDisplayCount;

  const itemsToDisplay = canExpand && !isExpanded ? items.slice(0, initialDisplayCount) : items;

  return (
    <div className="mb-6">
      <h3 className="text-lg font-semibold text-gray-700 mb-3">{title}</h3>
      <div className="space-y-2">
        {items.length === 0 && !disabled && <p className='text-sm text-gray-500'>No {title.toLowerCase()} available.</p>}
        {disabled && <p className='text-sm text-gray-500'>{title} filters are currently unavailable.</p>}
        {itemsToDisplay.map(item => (
          <label key={item.id} className={`flex items-center text-gray-600 hover:text-gray-800 ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
            <input 
              type="checkbox" 
              className="form-checkbox h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mr-2"
              checked={selectedItems.includes(item.id)}
              onChange={() => handleChange(item.id)}
              disabled={disabled}
            />
            {item.name}
          </label>
        ))}
      </div>
      {canExpand && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          disabled={disabled}
          className={`text-sm mt-2 ${disabled ? 'text-gray-400 cursor-not-allowed' : 'text-blue-600 hover:text-blue-800'}`}
        >
          {isExpanded ? 'Show Less' : 'Show More'}
        </button>
      )}
    </div>
  );
};

// Props for FilterPanel itself, now receiving selected values and handlers from CoursesPage
interface FilterPanelProps {
  levels: { id: string; name: string }[];         // Now expects levels as a prop
  tags: { id: string; name: string }[];           // Changed from topics to tags
  instructors: { id: string; name: string }[];   // Now expects instructors as a prop
  
  selectedLevels: string[];
  onLevelChange: (levelId: string) => void;
  selectedTags: string[];                         // Changed from selectedTopics
  onTagChange: (tagId: string) => void;        // Changed from onTopicChange and topic to tagId
  selectedInstructors: string[];
  onInstructorChange: (instructorName: string) => void;
  clearAllFilters: () => void;

  // Optional: Add disabled flags for each section if needed externally
  levelsDisabled?: boolean;
  tagsDisabled?: boolean;                          // Changed from topicsDisabled
  instructorsDisabled?: boolean;
}

const FilterPanel: React.FC<FilterPanelProps> = ({ 
  levels,         // Use prop
  tags,           // Changed from topics
  instructors,    // Use prop
  selectedLevels,
  onLevelChange,
  selectedTags,   // Changed from selectedTopics
  onTagChange,    // Changed from onTopicChange
  selectedInstructors, 
  onInstructorChange,
  clearAllFilters,
  levelsDisabled = false,      // Default to false
  tagsDisabled = false,        // Changed from topicsDisabled
  instructorsDisabled = false, // Default to false
}) => {
  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-800">Filters</h2>
        <button 
          onClick={clearAllFilters}
          className="text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          Clear All
        </button>
      </div>

      <FilterSection 
        title="Level"
        items={levels} // Use prop
        selectedItems={selectedLevels}
        handleChange={onLevelChange}
        disabled={levelsDisabled || levels.length === 0} // Disable if explicitly told or no items
      />

      <FilterSection 
        title="Popular Topics"
        items={tags}
        selectedItems={selectedTags}
        handleChange={onTagChange}
        disabled={tagsDisabled || tags.length === 0}
      />

      <FilterSection 
        title="Instructors"
        items={instructors} // Use prop
        selectedItems={selectedInstructors}
        handleChange={onInstructorChange}
        disabled={instructorsDisabled || instructors.length === 0} // Disable if explicitly told or no items
      />
    </div>
  );
};

export default FilterPanel; 