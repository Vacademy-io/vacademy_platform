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
  count = 0,
  button,
  buttonText,
  list = [],
  icon,
}: DashboardTabsProps) {
  const displayIcon = icon || getIcon(title);
  
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 p-5 cursor-pointer">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary-50 rounded-lg text-primary-600">
            {displayIcon}
          </div>
          <div className="text-base font-semibold text-gray-900">
            {title}
          </div>
        </div>
        <div className="px-3 py-1 bg-gray-100 rounded-full text-sm font-medium text-gray-700">
          {count}
        </div>
      </div>

      {/* Status */}
      <div className="text-sm text-gray-500 mb-3">
        <span className="inline-flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${count === 0 ? 'bg-gray-300' : 'bg-green-500'}`}></div>
          {count === 0 ? 'No items available' : `${count} ${count === 1 ? 'item' : 'items'} ready`}
        </span>
      </div>

      {/* List Items */}
      {list?.length > 0 && (
        <div className="space-y-2 mb-4">
          {list?.slice(0, 3).map((item, idx) => (
            <div 
              key={idx} 
              className="flex items-center gap-3 py-2 px-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors duration-150"
            >
              <div className="w-2 h-2 bg-primary-500 rounded-full flex-shrink-0"></div>
              <div className="truncate text-sm font-medium text-gray-700">{item.slide_title}</div>
            </div>
          ))}
          {list.length > 3 && (
            <div className="text-sm text-gray-400 pl-5">
              +{list.length - 3} more items
            </div>
          )}
        </div>
      )}

      {/* Action Button */}
      {button && (
        <button className="w-full bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium py-2.5 px-4 rounded-lg transition-colors duration-200 shadow-sm border border-primary-600">
          {buttonText}
        </button>
      )}
    </div>
  );
}
