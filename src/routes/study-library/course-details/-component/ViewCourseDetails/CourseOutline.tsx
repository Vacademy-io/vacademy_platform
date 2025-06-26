import React, { useState } from 'react';
import { PlayCircle, FileCode2, FileText } from 'lucide-react';
// import { LoginModel } from '@/components/common/LoginModel/LoginModel';
// import { SignUpModel } from '@/components/common/SignUpModel/SignUpModel';
interface CourseItem {
  type: 'video' | 'code' | 'pdf';
  title: string;
  detail: string;
}

const courseItems: CourseItem[] = [
  { type: 'video', title: 'Introduction', detail: '7 min' },
  { type: 'video', title: 'What is Scratch Programming Language', detail: '1 hr 3 min' },
  { type: 'code', title: 'My_First_Scratch_Project.sb3', detail: '31 min' },
  { type: 'pdf', title: 'Scratch_Basics_CourseGuide', detail: '12 pages' },
];

const CourseOutline: React.FC = () => {
  const [level, setLevel] = useState('Beginner');
  const [session, setSession] = useState('2025-2026');
  // const [showLogin, setShowLogin] = useState(false);
  // const [showSignUp, setShowSignUp] = useState(false);

  return (
    <div className="p-4 flex ml-0 mr-0 gap-8 border border-2 border-red-400">

      {/* Course Outline */}
      <div className='left pl-6  w-[60%] bg-white shadow-md'>
        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-6">
          <div>
            <label className="block text-xl font-medium text-gray-700 mb-1">Level</label>
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 w-[240px]"
            >
              <option>Beginner</option>
              <option>Intermediate</option>
              <option>Advanced</option>
            </select>
          </div>

          <div>
            <label className="block text-xl font-medium text-gray-700 mb-1">Session/Cohorts</label>
            <select
              value={session}
              onChange={(e) => setSession(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 w-[240px]"
            >
              <option>2025-2026</option>
              <option>2024-2025</option>
              <option>2023-2024</option>
            </select>
          </div>
        </div>

        {/* Course Outline Title */}
        <h2 className="text-xl font-semibold mb-4">Course Outline</h2>

        {/* Course Items */}
        <ul className="space-y-4">
          {courseItems.map((item, index) => (
            <li key={index} className="flex items-start gap-3">
              {/* Icon */}
              <div className="mt-1">
                {item.type === 'video' && <PlayCircle className="w-5 h-5 text-gray-600" />}
                {item.type === 'code' && <FileCode2 className="w-5 h-5 text-gray-600" />}
                {item.type === 'pdf' && <FileText className="w-5 h-5 text-gray-600" />}
              </div>

              {/* Text */}
              <div>
                <p className="text-gray-800 font-medium">{item.title}</p>
                <p className="text-sm text-gray-500">{item.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>


      {/* //Scrath Programming Language */}

      <div className='righ w-[40%]'>
        <div className="max-w-sm mx-auto bg-white rounded-lg shadow-lg p-5">
          <h2 className="text-xl font-bold mb-2">Scratch Programming Language</h2>
          <p className="text-gray-600 mb-1">🏷️ Beginner</p>
          <p className="text-gray-600 mb-1">🕒 1 hour 38 minutes</p>
          <p className="text-gray-600 mb-1">📹 11 Video slides</p>
          <p className="text-gray-600 mb-1">👨‍💻 8 Code slides</p>
          <p className="text-gray-600 mb-1">📄 2 PDF slides</p>
          <p className="text-gray-600 mb-1">📝 1 Doc slide</p>
          <p className="text-gray-600 mb-1">❓ 1 Question slide</p>
          <p className="text-gray-600 mb-3">📁 1 Assignment slide</p>
          <p className="text-gray-600">👥 Satya Dilliikar, Savir Dilliikar</p>
          <button className="w-full text-center mt-4 bg-blue-500 text-white font-semibold py-2 px-4 rounded"
            >
            View
          </button>
          {/* {showLogin && (
            <LoginModel
              onClose={() => setShowLogin(false)}
              switchToSignUp={() => {
                setShowLogin(false);
                setShowSignUp(true);
              }}
            />
          )}

          {showSignUp && (
            <SignUpModel
              onClose={() => setShowSignUp(false)}
              switchToLogin={() => {
                setShowSignUp(false);
                setShowLogin(true);
              }}
            />
          )} */}
        </div>
      </div>
    </div>
  );
};

export default CourseOutline;
