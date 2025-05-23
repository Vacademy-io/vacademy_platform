import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { AlertCircle } from "lucide-react";
import { useState } from "react";
import { useAssessmentStore } from "@/stores/assessment-store";
import useAlertsStore from "@/stores/alerts-store";
// import SectionDetails from "../common/instructionPage/SectionDetails";
import { AssessmentInstructions } from "../common/instructionPage/AssessmentInstructions";
import { GET_TEXT_VIA_IDS } from "@/constants/urls";
import { fetchDataByIds } from "@/services/GetDataById";
import { RichText, Assessment as AssessmentType } from "@/types/assessment";
import { useEffect } from "react";
import { Preferences } from "@capacitor/preferences";

interface HelpModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "instructions" | "alerts" | "reattempt" | "time";
}

export function HelpModal({ open, onOpenChange, type }: HelpModalProps) {
  const [instructions, setInstructions] = useState<RichText>();
  const [assessmentInfo, setAssessmentInfo] = useState<AssessmentType>();
  const [reason, setReason] = useState("");
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const { assessment } = useAssessmentStore();
  //  const { assessment , currentSection} = useAssessmentStore();
  // const { assessment, currentSection } = useAssessmentStore();
  // const { alerts, requests, addRequest } = useAlertsStore();
  const { alerts } = useAlertsStore();
  const fetchInstructions = async () => {
    try {
      const AssessmentData = await Preferences.get({
        key: "InstructionID_and_AboutID",
      });
      const Assessment = AssessmentData.value
        ? JSON.parse(AssessmentData.value)
        : null;
      setAssessmentInfo(Assessment);
      const data = await fetchDataByIds(
        Assessment.instruction_id,
        GET_TEXT_VIA_IDS
      );
      setInstructions(data[0]);
    } catch (error) {
      console.error("Error fetching assessments:", error);
      // toast.error("Failed to fetch assessments.");
    }
  };
  useEffect(() => {
    fetchInstructions();
  }, []);
  const getTitle = () => {
    switch (type) {
      case "instructions":
        return "Assessment Instructions";
      case "alerts":
        return "Assessment Alerts";
      case "reattempt":
        return "Request Reattempt";
      case "time":
        return "Request Time Increase";
    }
  };

  const getContent = () => {
    switch (type) {
      case "instructions":
        if (!assessment) return null;
        // const currentSectionInstructions =
        //   assessment.section_dtos[currentSection] || "";
        // console.log(assessment);
        return (
          <>
            <div className="space-y-4 mt-4 max-h-96 overflow-y-auto">
              {/* <p>{assessment.assessmentInstruction}</p> */}
              {assessmentInfo && instructions && (
                <AssessmentInstructions
                  instructions={instructions.content}
                  duration={assessmentInfo.duration}
                  preview={assessmentInfo.preview_time > 0 ? true : false}
                  canSwitchSections={assessmentInfo.can_switch_section}
                  assessmentInfo={assessmentInfo}
                />
              )}
              {/* <p>Current Section Instructions:</p>
              <div className="">
                <SectionDetails
                  section={assessment.section_dtos[currentSection]}
                />
              </div> */}
            </div>
            <div className="">
              {/* {open && type === "instructions" && (
                <div className="space-y-4 mt-4 max-h-96 overflow-y-auto">
                  <AssessmentInstructions
                    instructions={assessment?.assessmentInstruction}
                  />
                  <p>Current Section Instructions:</p>
                  <SectionDetails
                    section={assessment?.sections[currentSection]}
                  />
                </div>
              )} */}
            </div>
          </>
        );
      case "alerts":
        return (
          <div className="space-y-4 mt-4">
            {alerts.length === 0 ? (
              <div className="flex items-center gap-2 text-yellow-600">
                <AlertCircle className="h-5 w-5" />
                <p>No active alerts at this time.</p>
              </div>
            ) : (
              alerts.map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-start gap-2 bg-yellow-50 p-3 rounded-lg"
                >
                  <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5" />
                  <div>
                    <p className="text-sm text-yellow-700">{alert.message}</p>
                    <p className="text-xs text-yellow-600 mt-1">
                      {new Date(alert.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        );
      case "reattempt":
      case "time":
        return (
          <div className="space-y-4">
            <div className="flex items-start gap-2 bg-red-50 p-3 rounded-lg mt-4">
              <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
              <p className="text-sm text-red-600">
                Please provide a reason for requesting a{" "}
                {type === "reattempt" ? "reattempt" : "time extension"} for the
                Assessment to submit to the admin.
              </p>
            </div>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Type your reason here"
              className="min-h-[100px]"
            />
            <Button
              className="w-full bg-primary-500"
              onClick={() => {
                // addRequest(type, reason);
                setReason("");
                setShowSuccessDialog(true);
              }}
            >
              Submit
            </Button>
          </div>
        );
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader className="flex flex-row items-center justify-between">
            <DialogTitle>{getTitle()}</DialogTitle>
          </DialogHeader>
          {getContent()}
        </DialogContent>
      </Dialog>

      <AlertDialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <AlertDialogContent>
          <AlertDialogDescription>
            Your request has been successfully submitted to the admin.
          </AlertDialogDescription>
          <AlertDialogAction
            onClick={() => {
              setShowSuccessDialog(false);
              onOpenChange(false);
            }}
          >
            Close
          </AlertDialogAction>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
