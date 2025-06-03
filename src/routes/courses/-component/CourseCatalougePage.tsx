import React from 'react';
 import Footer from './Footer.tsx';
import InstructorCTASection from './InstructorCTASection.tsx';
import SupportersSection from './SupportersSection.tsx';
import CoursesPage from './CoursesPage.tsx';
import Header from './Header.tsx';
import HeroSectionCourseCatalog from './HeroSectionCourseCatalog.tsx';

const CourseCatalougePage: React.FC = () => {
  return (
    <div>
      <Header/>
       <HeroSectionCourseCatalog/>
      <CoursesPage/> 
      <InstructorCTASection/>
      <SupportersSection/>
      <Footer/>
    </div>
  );
}

export default CourseCatalougePage; 