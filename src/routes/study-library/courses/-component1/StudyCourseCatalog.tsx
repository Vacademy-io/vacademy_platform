//import React from 'react'

import { getTerminology } from "@/components/common/layout-container/sidebar/utils";
import { ContentTerms, SystemTerms } from "@/types/naming-settings";

const StudyCourseCatalog = () => {
  return (
    <div>
      <h1 className="text-2xl font-bold bg-red-400">
        Study {getTerminology(ContentTerms.Course, SystemTerms.Course)} Catalog
      </h1>
    </div>
  );
};

export default StudyCourseCatalog;
