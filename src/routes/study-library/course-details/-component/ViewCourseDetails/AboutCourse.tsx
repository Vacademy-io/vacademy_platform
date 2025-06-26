import React from 'react';

const AboutCourse: React.FC = () => {
    return (
    <div className=" p-8 flex ml-8 mr-8">
    <div className='left p-6  w-[60%] bg-white shadow-md'>
            <h1 className="text-2xl font-bold mb-4">About this Course</h1>
            <p className="mb-4">
                The Scratch Basics course is designed to introduce beginners to the exciting world of coding through simple, visual programming.
                Using Scratch’s drag-and-drop interface, learners can easily create animations, games, and stories—without writing a single line of code.
                This course is perfect for children, young learners, or anyone starting their coding journey, as it focuses on creativity, problem-solving, and fun hands-on learning.
            </p>
            <h2 className="text-xl font-semibold mb-2">By the end of this course, learners will:</h2>
            <ul className="list-disc list-inside mb-4">
                <li>Understand the Scratch interface and how different coding blocks work.</li>
                <li>Build interactive projects using motion, sound, looks, and control blocks.</li>
                <li>Learn essential programming concepts like sequences, loops, and events.</li>
                <li>Strengthen logical thinking and step-by-step problem-solving skills.</li>
                <li>Gain confidence to explore and create their own coding projects independently.</li>
            </ul>
            <p>
                Whether at home or in a classroom setting, this course offers an engaging and supportive way to begin exploring the world of programming.
            </p>
            
        </div>
        </div>
    );
};

export default AboutCourse;
