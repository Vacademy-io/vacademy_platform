import React from "react";
import { ClipboardText } from "@phosphor-icons/react";

interface AssessmentNavbarProps {
  title: string;
}

const AssessmentNavbar: React.FC<AssessmentNavbarProps> = ({ title }) => {
  return (
    <div className="flex h-20 items-center gap-3 border-b border-primary-100 bg-gradient-to-r from-primary-50 to-primary-50/40 px-6 shadow-sm">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-100">
        <ClipboardText size={18} weight="duotone" className="text-primary-500" />
      </div>
      <div className="min-w-0">
        {title && (
          <p className="truncate font-semibold text-neutral-800">{title}</p>
        )}
        <p className="text-xs font-medium text-primary-400 uppercase tracking-wide">
          Assessment Brief
        </p>
      </div>
    </div>
  );
};

export default AssessmentNavbar;
