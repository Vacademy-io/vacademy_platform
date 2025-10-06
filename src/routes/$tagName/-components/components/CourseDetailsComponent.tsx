import React from "react";
import { CourseDetailsProps } from "../../-types/course-catalogue-types";

export const CourseDetailsComponent: React.FC<CourseDetailsProps> = ({
  showEnroll,
  showPayment,
  fields,
}) => {
  // Mock course data - replace with actual data from props or context
  const courseData = {
    title: "Advanced Web Development",
    description: "Master modern web development techniques including React, Node.js, and cloud deployment.",
    duration: "8 weeks",
    instructor: "Jane Smith",
    price: 199,
    type: "Advanced",
  };

  const handleEnroll = () => {
    // Handle enrollment logic
    console.log("Enrolling in course...");
  };

  const handlePayment = () => {
    // Handle payment logic
    console.log("Processing payment...");
  };

  return (
    <div className="py-12 bg-white">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {/* Course Header */}
          <div className="px-6 py-8 border-b border-gray-200">
            {fields.includes("title") && (
              <h1 className="text-3xl font-bold text-gray-900 mb-4">
                {courseData.title}
              </h1>
            )}
            {fields.includes("type") && (
              <span className="inline-block px-3 py-1 bg-primary-100 text-primary-800 text-sm font-medium rounded-full mb-4">
                {courseData.type}
              </span>
            )}
          </div>

          {/* Course Content */}
          <div className="px-6 py-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Main Content */}
              <div className="lg:col-span-2">
                {fields.includes("description") && (
                  <div className="mb-8">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">
                      Course Description
                    </h2>
                    <p className="text-gray-600 leading-relaxed">
                      {courseData.description}
                    </p>
                  </div>
                )}

                {/* Course Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  {fields.includes("duration") && (
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h3 className="font-semibold text-gray-900 mb-2">Duration</h3>
                      <p className="text-gray-600">{courseData.duration}</p>
                    </div>
                  )}
                  {fields.includes("instructor") && (
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h3 className="font-semibold text-gray-900 mb-2">Instructor</h3>
                      <p className="text-gray-600">{courseData.instructor}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Sidebar */}
              <div className="lg:col-span-1">
                <div className="bg-gray-50 p-6 rounded-lg sticky top-8">
                  {fields.includes("price") && (
                    <div className="mb-6">
                      <div className="text-3xl font-bold text-primary-600 mb-2">
                        ${courseData.price}
                      </div>
                      <p className="text-gray-600">One-time payment</p>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="space-y-3">
                    {showEnroll && (
                      <button
                        onClick={handleEnroll}
                        className="w-full bg-primary-600 text-white py-3 px-4 rounded-md font-medium hover:bg-primary-700 transition-colors"
                      >
                        Enroll Now
                      </button>
                    )}
                    {showPayment && (
                      <button
                        onClick={handlePayment}
                        className="w-full bg-green-600 text-white py-3 px-4 rounded-md font-medium hover:bg-green-700 transition-colors"
                      >
                        Make Payment
                      </button>
                    )}
                  </div>

                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
