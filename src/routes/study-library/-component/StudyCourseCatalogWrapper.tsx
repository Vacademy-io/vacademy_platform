// src/routes/study-library/-component/StudyCourseCatalogWrapper.tsx

import React from 'react';
import CourseCatalougePage from '../../courses/-component/CourseCatalougePage'; // Adjust path as needed
import Tab from './Tab';
import Nav from './Nav';
import SideBar from './SideBar';
import HeroSection from './HeroSection';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';

const StudyCourseCatalogWrapper: React.FC = () => {
  return (
    <LayoutContainer>
    <div className="flex min-h-screen bg-white">
      

      {/* Main Content Area */}
      <div className="h-screenw-[80%] flex flex-col">
        
        {/* Uncomment below if Tab is needed */} 
        <HeroSection />
        <Tab />
        {/* Course Catalogue */}
        <div className="flex-1 overflow-y-auto">
          <CourseCatalougePage hideHero={true} />
        </div>
      </div>
    </div>
    </LayoutContainer>
  );
};

export default StudyCourseCatalogWrapper;
