import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CheckCircle, ArrowRight } from "@phosphor-icons/react";
import { useTranslation } from "react-i18next";
import { MyButton } from "@/components/design-system/button";
import {
  getTerminology,
  getTerminologyPlural,
} from "@/components/common/layout-container/sidebar/utils";
import { ContentTerms, SystemTerms } from "@/types/naming-settings";

interface EnrollmentSuccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseTitle: string;
  onExploreCourse: () => void;
}

export const EnrollmentSuccessDialog: React.FC<EnrollmentSuccessDialogProps> = ({
  open,
  onOpenChange,
  courseTitle,
  onExploreCourse,
}) => {
  const { t } = useTranslation("study");
  const course = getTerminology(ContentTerms.Course, SystemTerms.Course);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-xl font-bold text-green-700">
            {t("enrollment.success.title")}
          </DialogTitle>
        </DialogHeader>
        
        <div className="text-center py-6">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </div>
          
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {t("enrollment.success.welcome", { courseTitle })}
          </h3>

          <p className="text-gray-600 mb-6">
            {t("enrollment.success.description", {
              course: course.toLocaleLowerCase(),
              slides: getTerminologyPlural(
                ContentTerms.Slides,
                SystemTerms.Slides
              ).toLocaleLowerCase(),
            })}
          </p>
          
          <MyButton
            type="button"
            scale="large"
            buttonType="primary"
            layoutVariant="default"
            onClick={onExploreCourse}
            className="w-full flex items-center justify-center space-x-2"
          >
            <span>{t("enrollment.success.exploreCourse", { course })}</span>
            <ArrowRight className="w-4 h-4" />
          </MyButton>
        </div>
      </DialogContent>
    </Dialog>
  );
};

