import { Separator } from "@/components/ui/separator";
import {
  CloseRegistrationMobile,
  CloseRegistrationWeb,
  VacademyLogoWeb,
} from "@/svgs";

const AssessmentClosedExpiredComponent = ({
  isExpired,
  assessmentName,
  isPrivate = false,
}: {
  isExpired: boolean;
  assessmentName: string;
  isPrivate?: boolean;
}) => {
  return (
    <div className="flex flex-col w-screen h-screen items-center justify-center gap-2 p-10 bg-[linear-gradient(180deg,#FFF9F4_0%,#E6E6FA_100%)]">
      <VacademyLogoWeb />
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
