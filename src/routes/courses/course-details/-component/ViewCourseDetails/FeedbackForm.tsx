import React, { useState } from "react";
import axios from "axios";

const FeedbackForm = () => {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [feedback, setFeedback] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rating || !feedback) return alert("Please fill both fields");

    try {
      await axios.post("http://localhost:5000/api/feedback", {
        rating,
        feedback,
      });
      alert("Feedback submitted successfully!");
      setRating(0);
      setFeedback("");
    } catch (err) {
      console.error(err);
      alert("Submission failed.");
    }
  };

  return (
   <div className="p-8 flex ml-8 mr-8">
    <div className='left p-6  w-[60%] bg-white shadow-md relative'>
      <h2 className="text-xl font-bold mb-4">Your Feedback</h2>

      {/* Star Rating */}
      <div className="flex mb-4">
        {[...Array(5)].map((_, index) => {
          const value = index + 1;
          return (
            <label key={index} >
              <input
                type="radio"
                className="hidden"
                value={value}
                onClick={() => setRating(value)}
              />
              <svg
                className={`w-8 h-8 cursor-pointer transition ${
                  value <= (hover || rating) ? "text-yellow-400" : "text-gray-300"
                }`}
                fill="currentColor"
                viewBox="0 0 20 20"
                onMouseEnter={() => setHover(value)}
                onMouseLeave={() => setHover(0)}
              >
                <path d="M10 15l-5.878 3.09 1.122-6.545L.488 6.91l6.562-.954L10 0l2.95 5.956 6.562.954-4.756 4.635 1.122 6.545z" />
              </svg>
            </label>
          );
        })}
      </div>

      {/* Feedback Textarea */}
      <textarea
        className="w-full h-32 p-3 border rounded mb-16 resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
        placeholder="Write your feedback..."
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
      />

      {/* Submit Button */}
      <button
        className="bg-blue-500 text-white px-4 py-2 rounded absolute bottom-4 right-4 hover:bg-blue-600"
        onClick={handleSubmit}
      >
        Submit Feedback
      </button>
    </div>
    </div>
  );
};

export default FeedbackForm;
