import React, { useState, Dispatch, SetStateAction } from 'react';

// Define props for FilterSection internal component
interface FilterSectionProps {
  title: string;
  items: string[];
  selectedItems: string[];
  handleChange: (item: string) => void;
}

const FilterSection: React.FC<FilterSectionProps> = ({ title, items, selectedItems, handleChange }) => (
  <div className="mb-6">
    <h3 className="text-lg font-semibold text-gray-700 mb-3">{title}</h3>
    <div className="space-y-2">
      {items.map(item => (
        <label key={item} className="flex items-center text-gray-600 hover:text-gray-800 cursor-pointer">
          <input 
            type="checkbox" 
            className="form-checkbox h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mr-2"
            checked={selectedItems.includes(item)}
            onChange={() => handleChange(item)}
          />
          {item}
        </label>
      ))}
    </div>
  </div>
);

const FilterPanel: React.FC = () => {
  const [selectedLevels, setSelectedLevels] = useState<string[]>([]);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [selectedInstructors, setSelectedInstructors] = useState<string[]>([]);

  const levels: string[] = ['Beginner', 'Intermediate', 'Advanced'];
  const popularTopics: string[] = ['Agents', 'AI Frameworks', 'AI in Software Development', 'AI Safety'];
  const instructors: string[] = ['Predibase', 'Anthropic', 'DeepLearning.AI', 'LiveKit', 'RealAvatar'];

  const handleCheckboxChange = (setter: Dispatch<SetStateAction<string[]>>, value: string) => {
    setter(prev => 
      prev.includes(value) ? prev.filter(item => item !== value) : [...prev, value]
    );
  };

  const clearAllFilters = () => {
    setSelectedLevels([]);
    setSelectedTopics([]);
    setSelectedInstructors([]);
  };

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
        items={levels}
        selectedItems={selectedLevels}
        handleChange={(item: string) => handleCheckboxChange(setSelectedLevels, item)}
      />

      <FilterSection 
        title="Popular Topics"
        items={popularTopics}
        selectedItems={selectedTopics}
        handleChange={(item: string) => handleCheckboxChange(setSelectedTopics, item)}
      />

      <FilterSection 
        title="Instructors"
        items={instructors}
        selectedItems={selectedInstructors}
        handleChange={(item: string) => handleCheckboxChange(setSelectedInstructors, item)}
      />
    </div>
  );
};

export default FilterPanel; 