import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { MyButton } from "@/components/design-system/button";
import { submitFeedback } from "@/services/feedback/submitFeedback";
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";
import { Preferences } from "@capacitor/preferences";
import axios from "axios";
import { useRouter } from "@tanstack/react-router";
import { getUserId } from "@/utils/study-library/get-list-from-stores/getPackageSessionId";
import { urlInstituteDetails } from "@/constants/urls";

const MySwal = withReactContent(Swal);

export default function FeedbackPage() {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comments, setComments] = useState("");
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [packageSessionId, setPackageSessionId] = useState<string | null>(null);

  const router = useRouter();
  type SearchParams = { courseId?: string };
  const searchParams = router.state.location.search as SearchParams;
  const courseId = searchParams?.courseId ?? null;

  useEffect(() => {
    const fetchUserAndPackageSession = async () => {
      const id = await getUserId();
      setUserId(id);

      const instituteResult = await Preferences.get({ key: "InstituteId" });
      const instituteId = instituteResult.value;

      if (!instituteId || !courseId) {
        console.error("Missing instituteId or courseId");
        MySwal.fire("Missing Info", "Institute ID or Course ID is missing.", "warning");
        return;
      }

      try {
        const response = await axios.get(`${urlInstituteDetails}/${instituteId}`);
        type BatchForSession = { id: string; package_dto?: { id?: string } | null };
        const batches = response.data?.batches_for_sessions as BatchForSession[] | undefined;

        const matched = batches?.find(
          (item) => item.package_dto?.id === courseId
        );

        if (matched?.id) {
          setPackageSessionId(matched.id);
        } else {
          console.error("❌ No matching packageSessionId found");
          MySwal.fire("Error", "Course is not linked to any session.", "error");
        }
      } catch (error) {
        console.error("❌ Failed to fetch package session:", error);
        MySwal.fire("Oops!", "Unable to fetch session data", "error");
      }

      if (!id) {
        MySwal.fire("Missing Info", "User ID is missing", "warning");
      }
    };

    fetchUserAndPackageSession();
  }, [courseId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!userId || !packageSessionId) {
      await MySwal.fire("Error", "Cannot submit feedback — user or session ID is missing.", "error");
      return;
    }

    if (!rating) {
      await MySwal.fire("Incomplete", "Please select a rating.", "warning");
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
      status: "PENDING",
    };

    try {
      setLoading(true);
      await submitFeedback(payload);

      await MySwal.fire({
        title: "Thank you!",
        text: "Thanks for sharing your thoughts — it means a lot to us!",
        icon: "success",
        confirmButtonColor: "#2563eb",
      });

      setRating(0);
      setComments("");
    } catch (error: unknown) {
      console.error("❌ Feedback API error:", error);
      const errorMessage = (() => {
        if (typeof error === "object" && error !== null && "response" in error) {
          const response = (error as { response?: { data?: { message?: string } } }).response;
          return response?.data?.message || "Something went wrong. Please try again.";
        }
        return "Something went wrong. Please try again.";
      })();
      await MySwal.fire("Oops!", errorMessage, "error");
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
          <div className="flex gap-2" role="radiogroup" aria-label="Overall rating">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={`w-8 h-8 cursor-pointer transition-transform ${
                  (hover || rating) >= star ? "text-primary-300" : "text-gray-300"
                }`}
                tabIndex={0}
                role="radio"
                aria-checked={rating === star}
                aria-label={`${star} star${star > 1 ? "s" : ""}`}
                onMouseEnter={() => setHover(star)}
                onMouseLeave={() => setHover(0)}
                onClick={() => setRating(star)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setRating(star);
                  }
                }}
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
          />
        </div>

        <MyButton
          buttonType="primary"
          layoutVariant="default"
          scale="medium"
          type="submit"
          disable={loading || rating === 0}
        >
          {loading ? "Submitting..." : "Submit Feedback"}
        </MyButton>
      </form>
    </div>
  );
}
