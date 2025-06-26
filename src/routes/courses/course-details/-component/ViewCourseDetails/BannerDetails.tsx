import React from 'react';

const BannerDetails: React.FC = () => {
  const fallbackBanner = 'https://images.unsplash.com/photo-1506765515384-028b60a970df?q=80&w=869&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D';
  return (
    <div className="w-full h-96">
      <img
        src={fallbackBanner}
        alt="Banner for CourseDetails"
        className="w-full h-full object-cover"
      />
    </div>

  );
};

export default BannerDetails;
