import { MyButton } from "@/components/design-system/button";
import { Separator } from "@/components/ui/separator";
import { getTokenDecodedData } from "@/lib/auth/sessionUtility";
import { fetchAndStoreInstituteDetails } from "@/services/fetchAndStoreInstituteDetails";
import { fetchAndStoreStudentDetails } from "@/services/studentDetails";
import {
  RegistrationCompletedMobile,
  RegistrationCompletedWeb,
  VacademyLogoWeb,
} from "@/svgs";
import { Preferences } from "@capacitor/preferences";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

interface TimeLeft {
  hours: number;
  minutes: number;
  seconds: number;
}

const AssessmentRegistrationCompleted = ({
  assessmentName,
  timeLeft,
}: {
  assessmentName: string;
  timeLeft: TimeLeft;
}) => {
  const navigate = useNavigate();
  const handleNavigateAssessment = async () => {
    try {
      const { value } = await Preferences.get({ key: "accessToken" });
      console.log("access token after registration before login ", value);
      // Decode token to get user data
      const decodedData = await getTokenDecodedData(value);
      const authorities = decodedData?.authorities;
      const userId = decodedData?.user;
      const authorityKeys = authorities ? Object.keys(authorities) : [];
      
      if (authorityKeys.length > 1) {
        navigate({
          to: "/institute-selection",
          search: { redirect: "/assessment/examination" },
        });
      } else {
        const instituteId = authorityKeys[0];

        if (instituteId && userId) {
          try {
            await fetchAndStoreInstituteDetails(instituteId, userId);
            const status = await fetchAndStoreStudentDetails(
              instituteId,
              userId
            );
            if (status == 200) {
              navigate({
                to: "/SessionSelectionPage",
                search: { redirect: "/assessment/examination" },
              });
            } else {
              navigate({
                to: "/assessment/examination",
              });
            }
          } catch (error) {
            console.error("Error fetching details:", error);
            toast.error("Failed to fetch details");
            navigate({
              to: "/assessment/examination",
            });
          }
        } else {
          console.error("Institute ID or User ID is undefined");
          navigate({
            to: "/assessment/examination",
          });
        }
      }
    } catch (error) {
      console.error("Error processing decoded data:", error);
      navigate({
        to: "/assessment/examination",
      });
    }
  };
  return (
    <div className="flex flex-col w-screen h-screen items-center justify-center gap-2 p-10 bg-[linear-gradient(180deg,#FFF9F4_0%,#E6E6FA_100%)]">
      <VacademyLogoWeb />
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
