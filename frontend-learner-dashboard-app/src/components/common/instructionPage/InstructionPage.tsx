import { useEffect, useState } from "react";
import { useParams } from "@tanstack/react-router";
import AssessmentStartModal from "./StartAssessment";
import { Preferences } from "@capacitor/preferences";
import { GET_TEXT_VIA_IDS } from "@/constants/urls";
import { fetchDataByIds } from "@/services/GetDataById";
import { RichText, Assessment as AssessmentType } from "@/types/assessment";
import {
  resolveAssessmentById,
  storeAssessmentInfo,
} from "@/routes/assessment/examination/-utils.ts/useFetchAssessment";
import AssessmentNavbar from "./AssessmentNavbar";
import { AssessmentInstructions } from "./AssessmentInstructions";
import { SpinnerGap, WarningCircle } from "@phosphor-icons/react";

const InstructionPage = () => {
  const [instructions, setInstructions] = useState<RichText>();
  const [assessmentInfo, setAssessmentInfo] = useState<AssessmentType>();
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const { assessmentId } = useParams({ strict: false });

  const fetchInstructions = async () => {
    setIsLoading(true);
    setHasError(false);
    try {
      const AssessmentData = await Preferences.get({
        key: "InstructionID_and_AboutID",
      });
      let Assessment = AssessmentData.value
        ? JSON.parse(AssessmentData.value)
        : null;

      // First-load / public-link fallback: resolve from backend when storage key
      // is absent (direct link, race with navigation source's write).
      if (!Assessment?.instruction_id && assessmentId) {
        const resolved = await resolveAssessmentById(assessmentId);
        if (resolved) {
          await storeAssessmentInfo(resolved);
          Assessment = resolved;
        }
      }

      if (!Assessment) {
        setHasError(true);
        return;
      }

      setAssessmentInfo(Assessment);

      // Instructions are optional — show the page even if they fail to load.
      if (Assessment.instruction_id) {
        try {
          const data = await fetchDataByIds(
            Assessment.instruction_id,
            GET_TEXT_VIA_IDS
          );
          setInstructions(data[0]);
        } catch {
          console.warn("Could not fetch instructions for", Assessment.instruction_id);
        }
      }
    } catch (error) {
      console.error("Error fetching assessment:", error);
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInstructions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assessmentId]);

  return (
    <div className="min-h-screen relative bg-neutral-50 w-full">
      <div className="fixed top-0 w-full z-50">
        <AssessmentNavbar title={assessmentInfo?.name ?? ""} />
      </div>

      <main className="pt-24 pb-28 px-4 lg:px-8">
        <div className="mx-auto w-full max-w-2xl">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center min-h-96 gap-4">
              <SpinnerGap
                size={40}
                className="animate-spin text-primary-400"
                weight="bold"
              />
              <p className="text-sm text-neutral-500">Loading assessment details…</p>
            </div>
          ) : hasError || !assessmentInfo ? (
            <div className="flex flex-col items-center justify-center min-h-96 gap-4 text-center">
              <WarningCircle size={48} className="text-danger-400" weight="duotone" />
              <p className="text-base font-semibold text-neutral-700">
                Assessment details unavailable
              </p>
              <p className="text-sm text-neutral-500 max-w-sm">
                We couldn&apos;t load this assessment. Please go back and try again.
              </p>
            </div>
          ) : (
            <AssessmentInstructions
              instructions={instructions?.content ?? ""}
              duration={assessmentInfo.duration}
              preview={assessmentInfo.preview_time > 0}
              canSwitchSections={assessmentInfo.can_switch_section}
              assessmentInfo={assessmentInfo}
            />
          )}
        </div>
      </main>

      <div className="fixed bottom-0 start-0 end-0 bg-white border-t border-neutral-100 z-50">
        <div className="mx-auto w-full max-w-2xl pb-4 pt-3 px-4">
          <AssessmentStartModal />
        </div>
      </div>
    </div>
  );
};

export default InstructionPage;
