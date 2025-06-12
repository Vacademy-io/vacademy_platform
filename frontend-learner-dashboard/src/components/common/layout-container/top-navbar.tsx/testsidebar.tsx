import React, { createContext, useContext, useState } from 'react';
import { Calendar, Home, Inbox, Search, Settings, ChevronLeft, ChevronRight } from "lucide-react";

// Create context for sidebar state
const SidebarContext = createContext({
  isExpanded: true,
  toggleSidebar: () => {},
});

interface SidebarItem {
  title: string;
  to: string;
  icon: React.ElementType;
  subItems?: SidebarItem[];
}

const SidebarItemsData: SidebarItem[] = [
  {
    title: "Home",
    to: "#",
    icon: Home,
  },
  {
    title: "Inbox",
    to: "#",
    icon: Inbox,
  },
  {
    title: "Calendar",
    to: "#",
    icon: Calendar,
  },
  {
    title: "Search",
    to: "#",
    icon: Search,
  },
  {
    title: "Settings",
    to: "#",
    icon: Settings,
  },
];

interface SidebarItemProps {
  icon: React.ElementType;
  title: string;
  to: string;
  subItems?: SidebarItem[];
}

const SidebarItem = ({ icon: Icon, title, to }: SidebarItemProps) => {
  const { isExpanded } = useContext(SidebarContext);
  
  return (
    <a 
      href={to}
      className={`flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-all duration-200 ${
        isExpanded ? "justify-start" : "justify-center"
      }`}
    >
      <Icon className="h-5 w-5" />
      {isExpanded && <span className="text-sm">{title}</span>}
    </a>
  );
};

export const AppSidebar = ({ sidebarComponent }: { sidebarComponent?: React.ReactNode }) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const toggleSidebar = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <SidebarContext.Provider value={{ isExpanded, toggleSidebar }}>
      <div className="relative">
        <div
          className={`h-screen transition-all duration-300 border-r border-gray-200 bg-white ${
            isExpanded ? "w-64" : "w-20"
          }`}
        >
          {/* Header */}
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div className={`flex items-center gap-2 ${isExpanded ? "" : "justify-center w-full"}`}>
                <img src="/api/placeholder/32/32" alt="logo" className="h-8 w-8" />
                {isExpanded && (
                  <span className="text-lg font-semibold text-gray-800">
                    My App
                  </span>
                )}
              </div>
              <button
                onClick={toggleSidebar}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
              >
                {isExpanded ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
              </button>
            </div>

            {/* Navigation Items */}
            <nav className="flex-1 overflow-y-auto p-4">
              <div className="flex flex-col gap-2">
                {sidebarComponent
                  ? sidebarComponent
                  : SidebarItemsData.map((item, index) => (
                      <SidebarItem
                        key={index}
                        icon={item.icon}
                        title={item.title}
                        to={item.to}
                        subItems={item.subItems}
                      />
                    ))}
              </div>
            </nav>
          </div>
        </div>
      </div>
    </SidebarContext.Provider>
  );
};

export default AppSidebar;