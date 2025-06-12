// src/routes/study-library/-component/StudyCourseCatalogWrapper.tsx

import React from 'react';
//import CourseCatalougePage from '../../courses/-component/CourseCatalougePage'; // Adjust path as needed
//import Tab from './Tab';
//import HeroSection from './HeroSection';
import { useEffect } from 'react';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';

const completeCourseWrapper: React.FC = () => {

  const {setNavHeading} = useNavHeadingStore()
  useEffect(()=>{
    setNavHeading("Complete Course")
  }, [])

  return (
    <LayoutContainer>
    <div className="flex min-h-screen bg-white">
      

      {/* Main Content Area */}
      <div className="h-screenw-[80%] flex flex-col">
        
        {/* Uncomment below if Tab is needed */} 
        {/* <HeroSection /> */}
        {/* <Tab /> */}
        {/* Course Catalogue */}
        {/* <div className="flex-1 overflow-y-auto">
          <CourseCatalougePage hideHero={true} />
        </div> */}
        <h2>Complete Courses</h2>
      </div>
    </div>
    </LayoutContainer>
  );
};

export default completeCourseWrapper;
