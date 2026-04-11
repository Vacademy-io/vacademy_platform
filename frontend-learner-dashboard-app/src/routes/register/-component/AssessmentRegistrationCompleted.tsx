import { MyButton } from "@/components/design-system/button";
import { Separator } from "@/components/ui/separator";
import { getTokenDecodedData } from "@/lib/auth/sessionUtility";
import { fetchAndStoreInstituteDetails } from "@/services/fetchAndStoreInstituteDetails";
import { fetchAndStoreStudentDetails } from "@/services/studentDetails";
import { RegistrationCompletedMobile, RegistrationCompletedWeb } from "@/svgs";
import {
  InstituteBrandingComponent,
  type InstituteBranding,
} from "@/components/common/institute-branding";
import { useInstituteDetails } from "../live-class/-hooks/useInstituteDetails";
import { Preferences } from "@capacitor/preferences";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  fetchAssessmentData,
  storeAssessmentInfo,
} from "@/routes/assessment/examination/-utils.ts/useFetchAssessment";
import { Assessment, assessmentTypes } from "@/types/assessment";

interface TimeLeft {
  hours: number;
  minutes: number;
  seconds: number;
}

const AssessmentRegistrationCompleted = ({
  assessmentId,
  assessmentName,
  timeLeft,
}: {
  assessmentId: string;
  assessmentName: string;
  timeLeft: TimeLeft;
}) => {
  const navigate = useNavigate();
  const { data: instituteDetails } = useInstituteDetails();

  const resolveAssessmentById = async (
    id: string,
  ): Promise<Assessment | undefined> => {
    const tabs = [
      assessmentTypes.LIVE,
      assessmentTypes.UPCOMING,
      assessmentTypes.PAST,
    ];

    for (const tab of tabs) {
      const response = await fetchAssessmentData(0, 100, tab, "ASSESSMENT");
      const assessments = response?.content ?? [];
      const matchedAssessment = assessments.find(
        (assessment: Assessment) => assessment.assessment_id === id,
      );

      if (matchedAssessment) {
        return matchedAssessment;
      }
    }

    return undefined;
  };

  const branding: InstituteBranding = {
    instituteId: instituteDetails?.id || null,
    instituteName: instituteDetails?.institute_name || null,
    instituteLogoFileId: instituteDetails?.institute_logo_file_id || null,
    instituteThemeCode: null,
    homeIconClickRoute: instituteDetails?.homeIconClickRoute ?? null,
  };
  const handleNavigateAssessment = async () => {
    try {
      const { value } = await Preferences.get({ key: "accessToken" });
      console.log("access token after registration before login ", value);
      // Decode token to get user data
      const decodedData = await getTokenDecodedData(value);
      const authorities = decodedData?.authorities;
      const userId = decodedData?.user;
      const authorityKeys = authorities ? Object.keys(authorities) : [];
      const assessmentRoute = `/assessment/examination/${assessmentId}`;

      if (authorityKeys.length > 1) {
        navigate({
          to: "/institute-selection",
          search: {
            redirect: assessmentRoute,
            isPublicAssessment: true,
          },
        });
      } else {
        const instituteId = authorityKeys[0];

        if (instituteId && userId) {
          try {
            await fetchAndStoreInstituteDetails(instituteId, userId);
            await fetchAndStoreStudentDetails(instituteId, userId);
            const fullAssessment = await resolveAssessmentById(assessmentId);
            if (fullAssessment) {
              await storeAssessmentInfo(fullAssessment);
            }

            navigate({
              to: assessmentRoute,
              search: { isPublicAssessment: true },
            });
          } catch (error) {
            console.error("Error fetching details:", error);
            toast.error("Failed to fetch details");
            navigate({
              to: assessmentRoute,
              search: { isPublicAssessment: true },
            });
          }
        } else {
          console.error("Institute ID or User ID is undefined");
          navigate({
            to: assessmentRoute,
            search: { isPublicAssessment: true },
          });
        }
      }
    } catch (error) {
      console.error("Error processing decoded data:", error);
      navigate({
        to: `/assessment/examination/${assessmentId}`,
      });
    }
  };
  return (
    <div className="flex flex-col w-screen h-screen items-center justify-center gap-2 p-10 bg-background">
      <InstituteBrandingComponent
        branding={branding}
        size="large"
        showName={false}
      />
      <h1 className="text-sm sm:text-lg my-1 text-center">{assessmentName}</h1>
      <Separator className="mt-2" />
      <div className="block sm:hidden">
        <RegistrationCompletedMobile />
      </div>
      <div className="hidden sm:block">
        <RegistrationCompletedWeb />
      </div>
      <h1 className="-mt-4 text-sm sm:text-lg">Registration Completed!</h1>
      <div className="flex flex-col my-4 text-center">
        <h1 className="text-primary-500 text-sm sm:text-lg">
          Assessment goes live in
        </h1>
        {(timeLeft.hours > 0 ||
          timeLeft.minutes > 0 ||
          timeLeft.seconds > 0) && (
          <span className="font-thin">
            {timeLeft.hours} hrs : {timeLeft.minutes} min : {timeLeft.seconds}{" "}
            sec
          </span>
        )}
      </div>
      <MyButton
        type="button"
        buttonType="primary"
        scale="large"
        layoutVariant="default"
        disable={
          timeLeft.hours !== 0 ||
          timeLeft.minutes !== 0 ||
          timeLeft.seconds !== 0
        }
        onClick={handleNavigateAssessment}
      >
        Go To Assessment
      </MyButton>
    </div>
  );
};

export default AssessmentRegistrationCompleted;
