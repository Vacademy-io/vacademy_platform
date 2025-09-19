import { Separator } from "@/components/ui/separator";
import {
  CloseRegistrationMobile,
  CloseRegistrationWeb,
} from "@/svgs";
import { InstituteBrandingComponent, type InstituteBranding } from "@/components/common/institute-branding";
import { useInstituteDetails } from "../live-class/-hooks/useInstituteDetails";

const AssessmentClosedExpiredComponent = ({
  isExpired,
  assessmentName,
  isPrivate = false,
}: {
  isExpired: boolean;
  assessmentName: string;
  isPrivate?: boolean;
}) => {
  const { data: instituteDetails } = useInstituteDetails();
  
  const branding: InstituteBranding = {
    instituteId: instituteDetails?.id || null,
    instituteName: instituteDetails?.institute_name || null,
    instituteLogoFileId: instituteDetails?.institute_logo_file_id || null,
    instituteThemeCode: null
  };

  return (
    <div className="flex flex-col w-screen h-screen items-center justify-center gap-2 p-10 bg-background">
      <InstituteBrandingComponent branding={branding} size="large" showName={false} />
      <h1 className="text-sm sm:text-lg text-center">{assessmentName}</h1>
      <Separator className="mt-2" />
      <div className="block sm:hidden">
        <CloseRegistrationMobile />
      </div>
      <div className="hidden sm:block">
        <CloseRegistrationWeb />
      </div>
      {!isPrivate ? (
        <>
          <h1 className="-mt-4 text-sm sm:text-lg text-center">
            {isExpired ? "Assessment Expired" : "Registration Closed"}
          </h1>
          <h1 className="mt-4 text-sm sm:text-lg text-center">
            {isExpired
              ? "This assessment is no longer available. "
              : "Registration for this assessment has closed."}
          </h1>
        </>
      ) : (
        <>
          <h1 className="-mt-4 text-sm sm:text-lg text-center">
            Assessment Access Denied
          </h1>
          <h1 className="mt-4 text-sm sm:text-lg text-center">
            You are not registered for this assessment.
          </h1>
        </>
      )}
      <h1 className="text-primary-500 text-sm sm:text-lg text-center">
        Stay tuned for upcoming opportunities!
      </h1>
    </div>
  );
};

export default AssessmentClosedExpiredComponent;
