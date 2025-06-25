import { PlayCircle } from "@/assets/svgs";
import { Slide } from "@/types/dashbaord/types";

interface DashboardTabsProps {
  title: string;
  count?: number;
  button?: boolean;
  buttonText?: string;
  list?: Slide[];
  icon?: React.ReactNode;
}

// Icon components - Compact Professional Icons
const BookIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
  </svg>
);

const HomeWorkIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const TestIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
  </svg>
);

const getIcon = (title: string) => {
  if (title.toLowerCase().includes('subject')) return <BookIcon />;
  if (title.toLowerCase().includes('homework')) return <HomeWorkIcon />;
  if (title.toLowerCase().includes('test')) return <TestIcon />;
  return <BookIcon />;
};

export function DashboardTabs({
  title,
  count,
  button,
  buttonText,
  list = [],
  icon,
}: DashboardTabsProps) {
  const displayIcon = icon || getIcon(title);
  
  return (
    <div className="relative bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md p-4 transition-all duration-200 hover:border-orange-300 group">
      {/* Compact Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="text-gray-400 group-hover:text-orange-500 transition-colors duration-200 w-5 h-5">
            {displayIcon}
          </div>
          <div className="text-sm font-medium text-gray-900 group-hover:text-gray-700 transition-colors duration-200">
            {title}
          </div>
        </div>
        <div className="bg-gray-100 group-hover:bg-orange-50 text-gray-700 group-hover:text-orange-600 px-2 py-1 rounded text-xs font-semibold min-w-[1.5rem] text-center transition-all duration-200">
          {count}
        </div>
      </div>

      {/* Professional Status Indicator */}
      <div className="mt-2 text-xs text-gray-500">
        {count === 0 ? 'No items' : `${count} ${count === 1 ? 'item' : 'items'} available`}
      </div>

      {/* List Items - Compact */}
      {list?.length > 0 && (
        <div className="mt-3 space-y-1">
          {list?.slice(0, 3).map((item, idx) => (
            <div 
              key={idx} 
              className="flex items-center gap-2 py-1 text-xs text-gray-600 hover:text-gray-800 transition-colors duration-200"
            >
              <div className="w-1 h-1 bg-orange-400 rounded-full"></div>
              <div className="truncate">{item.slide_title}</div>
            </div>
          ))}
          {list.length > 3 && (
            <div className="text-xs text-gray-400 pl-3">
              +{list.length - 3} more
            </div>
          )}
        </div>
      )}

      {/* Compact Action Button */}
      {button && (
        <div className="mt-3">
          <button className="w-full bg-orange-500 hover:bg-orange-600 text-white text-xs font-medium py-2 px-3 rounded transition-colors duration-200">
            {buttonText}
          </button>
        </div>
      )}

      {/* Subtle Hover Indicator */}
      <div className="absolute inset-0 rounded-lg ring-1 ring-orange-200 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none"></div>
    </div>
  );
}
