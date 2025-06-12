// import { SsdcLogo_Login } from "@/assets/svgs";
import React from "react";

interface AssessmentNavbarProps {
  title: string;
}
const AssessmentNavbar: React.FC<AssessmentNavbarProps> = ({ title }) => {
  return (
    <div className="flex h-[72px] items-center justify-between bg-primary-50 px-8 py-4">
      {/* <img src={SsdcLogo_Login} alt="logo" style={{ width: "52px" }} /> */}
      <div className="flex-1 flex  items-center">
        <div className="border-neutral-500 px-4 font-semibold text-neutral-600 text-center">
          <p className="line-clamp-2 font-bold ">{title}</p>
        </div>
      </div>
    </div>
  );
};

export default AssessmentNavbar;
