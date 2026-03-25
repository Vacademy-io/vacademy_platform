import axios from "axios";
import { Preferences } from "@capacitor/preferences";
import { FEEDBACK_URL } from "@/constants/urls";

export interface FeedbackPayload {
  points: number;
  user_id: string;
  source_id: string;
  source_type: string;
  text: string;
  status: string;
  likes: number;
  dislikes: number;
}

export const submitFeedback = async (payload: FeedbackPayload) => {


  // 🔐 Retrieve the access token from Preferences
  const tokenResult = await Preferences.get({ key: "accessToken" });
  const accessToken = tokenResult.value;

  if (!accessToken) {
   
    throw new Error("User is not authenticated.");
  }

  // 📨 Make the request with Authorization header
  const response = await axios.post(FEEDBACK_URL, payload, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  return response.data;
};
