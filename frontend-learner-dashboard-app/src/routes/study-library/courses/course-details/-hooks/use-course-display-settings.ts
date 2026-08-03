import { useEffect, useState } from "react";
import { getStudentDisplaySettings } from "@/services/student-display-settings";

// Institute-level display flags for the course-details page. Defaults are the
// permissive ones (everything visible except instructors, which is opt-in).
export function useCourseDisplaySettings() {
  const [showCourseConfiguration, setShowCourseConfiguration] =
    useState<boolean>(true);
  const [overviewVisible, setOverviewVisible] = useState<boolean>(true);
  const [hideAuthorName, setHideAuthorName] = useState<boolean>(false);
  // Teachers/Instructors section is hidden unless the institute opts in.
  const [showInstructors, setShowInstructors] = useState<boolean>(false);

  useEffect(() => {
    getStudentDisplaySettings(false)
      .then((settings) => {
        const cd = settings?.courseDetails;
        if (cd) {
          setShowCourseConfiguration(cd.showCourseConfiguration ?? true);
          setOverviewVisible(cd.courseOverview?.visible ?? true);
          setHideAuthorName(cd.hideAuthorName ?? false);
          setShowInstructors(cd.showInstructors ?? false);
        }
      })
      .catch(() => {
        setShowCourseConfiguration(true);
        setOverviewVisible(true);
        setHideAuthorName(false);
        setShowInstructors(false);
      });
  }, []);

  return {
    showCourseConfiguration,
    overviewVisible,
    hideAuthorName,
    showInstructors,
  };
}
