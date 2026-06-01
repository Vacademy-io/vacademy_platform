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

const InstructionPage = () => {
  const [instructions, setInstructions] = useState<RichText>();
  const [assessmentInfo, setAssessmentInfo] = useState<AssessmentType>();
  const { assessmentId } = useParams({ strict: false });
  const fetchInstructions = async () => {
    try {
      const AssessmentData = await Preferences.get({
        key: "InstructionID_and_AboutID",
      });
      let Assessment = AssessmentData.value
        ? JSON.parse(AssessmentData.value)
        : null;

      // First-load / public-link fallback. InstructionID_and_AboutID is written
      // by whatever navigates here (assessment card click or post-registration).
      // On a direct/public link — or if this read wins the race against that
      // write — the key is absent. Resolve the assessment from the backend by
      // its route id and persist it so the rest of the exam flow has what it
      // needs, instead of dereferencing null and crashing.
      if (!Assessment?.instruction_id && assessmentId) {
        const resolved = await resolveAssessmentById(assessmentId);
        if (resolved) {
          await storeAssessmentInfo(resolved);
          Assessment = resolved;
        }
      }

      if (!Assessment?.instruction_id) {
        console.error(
          "Assessment details unavailable for",
          assessmentId
        );
        return;
      }

      setAssessmentInfo(Assessment);
      const data = await fetchDataByIds(
        Assessment.instruction_id,
        GET_TEXT_VIA_IDS
      );
      setInstructions(data[0]);
    } catch (error) {
      console.error("Error fetching assessments:", error);
    }
  };
  useEffect(() => {
    fetchInstructions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assessmentId]);

  return (
    <div className="min-h-screen relative">
      <div className="fixed top-0 w-full z-50">
        {assessmentInfo && <AssessmentNavbar title={assessmentInfo.name} />}
      </div>

      <main className="pt-24 pb-16 p-4 lg:p-8 lg:pt-24 lg:pb-16">
        {assessmentInfo && instructions && (
          <AssessmentInstructions
            instructions={instructions.content}
            duration={assessmentInfo.duration}
            preview={assessmentInfo.preview_time > 0 ? true : false}
            canSwitchSections={assessmentInfo.can_switch_section}
            assessmentInfo={assessmentInfo}
          />
        )}
        {/* {assessment.section_dtos.map((section: Section) => (
          <div key={section.id} className="section-container">
            <Separator orientation="horizontal" className="my-4" />
            <SectionDetails section={section} />
          </div>
        ))} */}

        <div className="fixed bottom-0 left-0 right-0 bg-white z-50">
          <div className="pb-4 px-4">
            <AssessmentStartModal />
          </div>
        </div>
      </main>
    </div>
  );
};

export default InstructionPage;
