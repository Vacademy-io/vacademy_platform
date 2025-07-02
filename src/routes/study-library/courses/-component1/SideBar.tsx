import React from 'react';

const SideBar: React.FC = () => {
  return (
    <div className="p-6 pt-12 pl-10 flex flex-col items-center gap-14">
      <img
        src="./images/codeCircleLogo.png"
        alt="Code Circle Logo"
        className="w-[140px] h-[50px]"
      />
      <img
        src="./images/learningImage.png"
        alt="Learning Illustration"
        className="w-[140px] h-[70px]"
      />
    </div>
  );
};

export default SideBar;
