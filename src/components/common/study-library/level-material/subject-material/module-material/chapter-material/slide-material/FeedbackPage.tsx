import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { MyButton } from "@/components/design-system/button";
import { submitFeedback } from "@/services/feedback/submitFeedback";
import { getPackageSessionId, getUserId } from "@/utils/study-library/get-list-from-stores/getPackageSessionId";
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";

const MySwal = withReactContent(Swal);

export default function FeedbackPage() {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comments, setComments] = useState("");
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [packageSessionId, setPackageSessionId] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserData = async () => {
      const id = await getUserId();
      const sessionId = await getPackageSessionId();
      setUserId(id);
      setPackageSessionId(sessionId);

      if (!id || !sessionId) {
        console.error("❌ user_id or package_session_id missing", { id, sessionId });
        MySwal.fire("Missing Info", "User or session ID is missing.", "warning");
      }
    };

    fetchUserData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!userId || !packageSessionId) {
      await MySwal.fire("Error", "Cannot submit feedback — user info is missing.", "error");
      return;
    }

    if (!rating || !comments.trim()) {
      await MySwal.fire("Incomplete", "Please select a rating and write a comment.", "warning");
      return;
    }

    const payload = {
      id: "",
      points: rating,
      user_id: userId,
      likes: 0,
      dislikes: 0,
      source_id: packageSessionId,
      source_type: "PACKAGE_SESSION",
      text: comments,
      status: "ACTIVE",
    };

    try {
      setLoading(true);
      await submitFeedback(payload);

      // 🎉 Success Alert
      await MySwal.fire({
        title: "Thank you!",
        text: "Thanks for sharing your thoughts — it means a lot to us!",
        icon: "success",
        confirmButtonColor: "#2563eb",
      });

      setRating(0);
      setComments("");
    } catch (error: any) {
      console.error("❌ Feedback API error:", error);
      await MySwal.fire("Oops!", error?.response?.data?.message || "Something went wrong. Please try again.", "error");
    } finally {
      setLoading(false);
    }
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

        <MyButton
          buttonType="primary"
          layoutVariant="default"
          scale="medium"
          type="submit"
          disable={loading}
        >
          {loading ? "Submitting..." : "Submit Feedback"}
        </MyButton>
      </form>
    </div>
  );
}
