// src/routes/study-library/-component/StudyCourseCatalogWrapper.tsx

import React, { useEffect } from 'react';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import CourseCatalougePage from '../-component/CourseCatalougePage';

const StudyCourseCatalogWrapper: React.FC = () => {
  const { setNavHeading } = useNavHeadingStore();

  useEffect(() => {
    setNavHeading("Courses");
  }, []);

  return (
    <LayoutContainer>
      
          <CourseCatalougePage />
       
    </LayoutContainer>
  );
};

export default StudyCourseCatalogWrapper;
