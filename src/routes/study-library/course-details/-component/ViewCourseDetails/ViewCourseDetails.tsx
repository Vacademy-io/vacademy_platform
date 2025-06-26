import React from 'react';
// import Header from './Header';
import BannerDetails from './BannerDetails';
import CourseTabBar from './CourseTabBar';
import CourseOutline from './CourseOutline';
import  WhatYoullLearn from './WhatYoullLearn';
import AboutCourse from './AboutCourse';
import WhoShouldJoin from './WhoShouldJoin';
import InstructorPage from './InstructorPage';
import RatingsAndReviews from './RatingsAndReviews';
import FeedbackForm from './FeedbackForm';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
const CourseDetailPage: React.FC = () => {
  return (
  <LayoutContainer>
     <div className="bg-[#FAFAFA]">
      {/* <Header /> */}
      <BannerDetails/>
      <CourseTabBar/>
      <CourseOutline/>
      <WhatYoullLearn/>
      <AboutCourse/>
      <WhoShouldJoin/>
      <InstructorPage/>
      <RatingsAndReviews/>
      <FeedbackForm/>
      </div>
      </LayoutContainer>
  );
};

export default CourseDetailPage;
