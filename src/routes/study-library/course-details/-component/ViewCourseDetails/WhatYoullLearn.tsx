import React from 'react';

const WhatYoullLearn: React.FC = () => {
  return (
    <div className=" p-8 flex ml-8 mr-8">
    <div className='left p-6  w-[60%] bg-white shadow-md'>
      <h2 className="text-xl font-bold mb-4 ml-6">What you’ll learn?</h2>
      <ul className="list-disc pl-5 space-y-2">
        <li className="flex items-start">
          <span className="text-blue-500 mr-2">✔️</span>
          Learn how to explore the Scratch interface and use core coding blocks like motion, looks, and sound to bring your ideas to life.
        </li>
        <li className="flex items-start">
          <span className="text-blue-500 mr-2">✔️</span>
          Create your first interactive project by combining visual elements, sounds, and simple logic to make games or animations.
        </li>
        <li className="flex items-start">
          <span className="text-blue-500 mr-2">✔️</span>
          Develop essential programming skills by using sequences, loops, and events to control how your projects behave.
        </li>
      </ul>
    </div>
    </div>
  );
};

export default WhatYoullLearn;
