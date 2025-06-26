import React from 'react';
import Header from './Header';
import BannerDetails from './BannerDetails';
import CourseTabBar from './CourseTabBar';
import CourseOutline from './CourseOutline';
import  WhatYoullLearn from './WhatYoullLearn';
import AboutCourse from './AboutCourse';
import WhoShouldJoin from './WhoShouldJoin';
import InstructorPage from './InstructorPage';
import RatingsAndReviews from './RatingsAndReviews';
import FeedbackForm from './FeedbackForm';
const CourseDetailPage: React.FC = () => {
  return (
     <div className="bg-[#FAFAFA]">
      <Header />
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
  );
};

export default CourseDetailPage;
