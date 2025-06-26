import React from 'react';

const instructors = [
  { instructorImage: "/", instructorName: "Martin Luther" },
  { instructorImage: "/", instructorName: "John Paul" }
];

const Instructor: React.FC = () => {
  return (
   <div className=" p-8 flex ml-8 mr-8">
    <div className='left p-6  w-[60%] bg-white shadow-md'>
      <h2 className="text-xl font-bold mb-4">Instructors</h2>
      {instructors.map((instructor, ind) => (
        <div key={ind} className="flex items-center mb-4">
          <img src={instructor.instructorImage} alt={instructor.instructorName} className="w-12 h-12 rounded-full mr-4"/>
          <span className="text-lg">{instructor.instructorName}</span>
        </div>
      ))}
    </div>
    </div>
  );
};

export default Instructor;
