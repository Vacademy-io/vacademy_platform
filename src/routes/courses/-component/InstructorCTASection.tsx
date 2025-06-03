import React from 'react';

const InstructorCTASection: React.FC = () => {
  return (
    <div className="bg-white flex flex-col items-center text-center gap-y-3 p-8 md:p-12">
      <h1 className='font-bold text-3xl md:text-4xl'>Want to Create Your Own <span className="text-blue-600">Course</span>?</h1>
      <p className="text-gray-700 max-w-xl">Share your knowledge with the world!</p>
      <p className="text-gray-700 max-w-xl">Log in as an Instructor and start building your own courses for others to explore and learn from.</p>
      <button className="border-2 border-black mt-5 bg-white text-black px-10 py-2 rounded-md hover:bg-gray-100 transition-colors ">Login as an Instructor</button>
    </div>
  );
}

export default InstructorCTASection; 