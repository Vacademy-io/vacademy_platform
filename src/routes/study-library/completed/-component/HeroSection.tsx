import React from 'react';

const HeroSection: React.FC = () => {
  return (
    <div className='flex flex-col md:flex-row'>
      <div className='w-full md:w-2/3 flex items-center px-6 py-6 md:py-0'>
        <div>
          <h2 className='font-bold text-2xl lg:text-3xl mb-2'>Explore Courses</h2>
          <p className="mb-2 text-gray-700 ">
            Effortlessly organize, upload, and track educational resources in one place.
          </p>
          <p className="text-gray-700 ">
            Provide learners with easy access to the materials they need to succeed, ensuring a seamless and engaging learning experience.
          </p>
        </div>
      </div>
      <div className='w-full md:w-1/3 flex flex-col items-center gap-4 py-6'>
        {/* <button className='rounded-md text-white px-14 py-2 bg-blue-600 hover:bg-blue-700 transition-colors'>+ Get Started</button> */}
        <img src="/images/Group.png" alt="Illustration of diverse people learning" className="max-w-xs md:max-w-sm"/>
      </div>
    </div>
  );
}

export default HeroSection;
