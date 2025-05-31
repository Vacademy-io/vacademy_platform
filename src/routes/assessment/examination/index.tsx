import { LayoutContainer } from "@/components/common/layout-container/layout-container";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { ScheduleTestMainComponent } from "./-components/ScheduleTestMainComponent";
// import { Helmet } from "react-helmet";
import { TokenKey } from "@/constants/auth/tokens";
import { getTokenFromStorage } from "@/lib/auth/sessionUtility";
import { getFromStorage } from "@/components/common/LoginPages/sections/login-form";

export const Route = createFileRoute("/assessment/examination/")({
  beforeLoad: async ({ location }) => {
    const token = await getTokenFromStorage(TokenKey.accessToken);
    const studentDetails = await getFromStorage("StudentDetails");
    const instituteDetails = await getFromStorage("InstituteDetails");
    const isPublicAssessment = location.search
      ? new URLSearchParams(location.search).get("isPublicAssessment")
      : undefined;
    // If any of the required details are missing, redirect to login
    if (!token || !studentDetails || !instituteDetails) {
      throw redirect({
        to: "/login",
        search: { redirect: location.pathname, isPublicAssessment },
      });
    }
  },
  component: () => (
    <LayoutContainer>
      {/* <Helmet>
        <title>Assessment</title>
        <meta name="description" content="Assessment page" />
      </Helmet> */}
      <ScheduleTestMainComponent assessment_types="ASSESSMENT" />
    </LayoutContainer>
  ),
});
