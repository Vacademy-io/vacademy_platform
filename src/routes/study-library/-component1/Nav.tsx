import React from 'react';

const Nav: React.FC = () => {
  return (
    <div className='h-16 flex items-center justify-between px-4 sm:px-8 py-4 bg-white shadow-sm'>
      <div className='flex items-center justify-center gap-2'>
        <img src="/images/Frame.png" alt="Learning Center Logo" className="h-8 w-8" />
        <p className='font-semibold text-gray-800'>Learning Center</p>
      </div>  
      <img src="/images/Frame2.svg" alt="User Profile" className="h-10 w-10 rounded-full" />
    </div>
  );
}

export default Nav; 