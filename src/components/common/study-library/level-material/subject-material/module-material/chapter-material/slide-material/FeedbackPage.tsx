import { useState } from "react";
import { Star } from "lucide-react";
import { MyButton } from "@/components/design-system/button";// Adjust the path as per your file structure

export default function FeedbackPage() {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comments, setComments] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log({ rating, comments });
    alert("Thank you for your feedback!");
    setRating(0);
    setComments("");
  };

  return (
    <div className="w-full min-h-[calc(100vh-150px)] bg-gradient-to-br px-6 py-10 overflow-y-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">We Value Your Feedback</h2>
        <p className="text-base text-gray-600">
          Thank you for taking the time to provide feedback on your course experience!
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div>
          <label className="block text-lg font-semibold text-gray-700 mb-2">Overall Rating</label>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={`w-8 h-8 cursor-pointer transition-transform ${
                  (hover || rating) >= star ? "text-primary-300" : "text-gray-300"
                }`}
                onMouseEnter={() => setHover(star)}
                onMouseLeave={() => setHover(0)}
                onClick={() => setRating(star)}
                fill={(hover || rating) >= star ? "currentColor" : "none"}
              />
            ))}
          </div>
        </div>

        <div>
          <label className="block text-lg font-semibold text-gray-700 mb-2">Share Your Thoughts</label>
          <textarea
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            placeholder="We’d love to hear about your experience! What did you enjoy? What could be improved?"
            className="w-full min-h-[150px] p-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-200 resize-none"
            required
          />
        </div>

        {/* ✅ MyButton used here */}
        <MyButton
          buttonType="primary"
          layoutVariant="default"
          scale="medium"
          type="submit"
        >
          Submit Feedback
        </MyButton>
      </form>
    </div>
  );
}
