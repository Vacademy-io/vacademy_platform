import { useEffect, useState } from "react";
import { Preferences } from "@capacitor/preferences";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { getPublicUrl } from "@/services/upload_file";
import { Session } from "@/types/user/user-detail";
import { setToStorage } from "@/components/common/LoginPages/sections/login-form";
import {
  getTokenDecodedData,
  setTokenInStorage,
} from "@/lib/auth/sessionUtility";
import { TokenKey } from "@/constants/auth/tokens";
import { fetchAndStoreInstituteDetails } from "@/services/fetchAndStoreInstituteDetails";
import { fetchAndStoreStudentDetails } from "@/services/studentDetails";
import { useTheme } from "@/providers/theme/theme-provider";
import { DashboardLoader } from "@/components/core/dashboard-loader";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/login/oauth/learner")({
  component: OAuthRedirectHandler,
});

function OAuthRedirectHandler() {
  const navigate = useNavigate();
  const { setPrimaryColor } = useTheme();
  const [showSessionPage, setShowSessionPage] = useState(false);
  const [redirectPath, setRedirectPath] = useState("/dashboard");

  useEffect(() => {
    handleOAuthCallback(
      navigate,
      setPrimaryColor,
      setShowSessionPage,
      setRedirectPath
    );
  }, [navigate, setPrimaryColor]);

  return showSessionPage ? (
    <InlineSessionSelectionPage redirect={redirectPath} />
  ) : (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50">
      <DashboardLoader />
    </div>
  );
}

const handleOAuthCallback = async (
  navigate: ReturnType<typeof useNavigate>,
  setPrimaryColor: (color: string) => void,
  setShowSessionPage: (show: boolean) => void,
  setRedirectPath: (redirect: string) => void
) => {
  const urlParams = new URLSearchParams(window.location.search);
  const accessToken = urlParams.get("accessToken");
  const refreshToken = urlParams.get("refreshToken");
  const error = urlParams.get("error");
  const message = urlParams.get("message");

  if (error) {
    toast.error(decodeURIComponent(message || "Authentication failed."));
    navigate({ to: "/login" });
    return;
  }

  if (accessToken && refreshToken) {
    try {
      await setToStorage("accessToken", accessToken);
      await setToStorage("refreshToken", refreshToken);
      await setTokenInStorage(TokenKey.accessToken, accessToken);
      await setTokenInStorage(TokenKey.refreshToken, refreshToken);

      await handleSuccessfulLogin(
        accessToken,
        navigate,
        setShowSessionPage,
        setRedirectPath,
        setPrimaryColor
      );
    } catch {
      toast.error("Failed to store authentication tokens");
      navigate({ to: "/login" });
    }
  } else {
    toast.error("Missing tokens in redirect URL");
    navigate({ to: "/login" });
  }
};

const handleSuccessfulLogin = async (
  accessToken: string,
  navigate: ReturnType<typeof useNavigate>,
  setShowSessionPage: (show: boolean) => void,
  setRedirectPath: (redirect: string) => void,
  setPrimaryColor?: (color: string) => void
) => {
  try {
    const decodedData = getTokenDecodedData(accessToken);
    const authorities = decodedData?.authorities;
    const userId = decodedData?.user;

    const authorityKeys = authorities ? Object.keys(authorities) : [];

    if (!userId || authorityKeys.length === 0) {
      toast.error("Invalid user or institute data.");
      return;
    }

    if (authorityKeys.length === 1) {
      const instituteId = authorityKeys[0];

      const details = await fetchAndStoreInstituteDetails(instituteId, userId);
      if (setPrimaryColor) {
        setPrimaryColor(details?.institute_theme_code ?? "#E67E22");
      }
      await fetchAndStoreStudentDetails(instituteId, userId);

      setRedirectPath("/dashboard");
      setShowSessionPage(true);
    } else {
      navigate({
        to: "/institute-selection",
        search: { redirect: "/dashboard/" },
      });
    }
  } catch {
    toast.error("Failed to process user data.");
  }
};

function InlineSessionSelectionPage({ redirect }: { redirect: string }) {
  const [sessionList, setSessionList] = useState<Session[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchSessionList();
  }, []);

  useEffect(() => {
    if (sessionList.length === 1) {
      handleSessionSelect(sessionList[0]);
    } else if (sessionList.length > 0) {
      fetchImageUrls();
    }
  }, [sessionList]);

  const fetchSessionList = async () => {
    setIsLoading(true);
    try {
      const { value } = await Preferences.get({ key: "sessionList" });

      if (!value) {
        toast.error("No sessions found");
        setSessionList([]);
      } else {
        const sessions = JSON.parse(value) as Session[];
        setSessionList(sessions);
      }
    } catch (error) {
      toast.error("Failed to load sessions.");
      setSessionList([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchImageUrls = async () => {
    const urls: Record<string, string> = {};
    for (const session of sessionList) {
      const thumbnailId = session.package_dto.thumbnail_file_id;
      if (thumbnailId) {
        try {
          const url = await getPublicUrl(thumbnailId);
          urls[session.id] = url;
        } catch {}
      }
    }
  };

  const handleSessionSelect = async (selectedSession: Session) => {
    if (selectedId) return;
    try {
      setSelectedId(selectedSession.id);

      let studentList: any[] = [];
      const studentData = await Preferences.get({ key: "students" });

      if (studentData.value) {
        studentList = JSON.parse(studentData.value);
      } else {
        const singleStudentData = await Preferences.get({
          key: "StudentDetails",
        });
        if (singleStudentData.value) {
          studentList = [JSON.parse(singleStudentData.value)];
        }
      }

      const selectedStudent = studentList.find(
        (student: any) => student.package_session_id === selectedSession.id
      );

      if (!selectedStudent) throw new Error("No matching student found!");

      await Preferences.set({
        key: "StudentDetails",
        value: JSON.stringify(selectedStudent),
      });

      await navigate({ to: redirect as any, replace: true });
    } catch (error) {
      toast.error("⚠️ Failed to select session.");
      setSelectedId(null);
    }
  };

  if (isLoading || selectedId) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50">
        <DashboardLoader />
      </div>
    );
  }

  if (sessionList.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-rose-50 flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-md mx-auto">
          <div className="w-20 h-20 bg-gradient-to-br from-red-500 to-rose-600 rounded-2xl mx-auto flex items-center justify-center shadow-lg">
            <svg
              className="w-10 h-10 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01M4.293 6.293a1 1 0 011.414 0L12 12.586l6.293-6.293a1 1 0 111.414 1.414L13.414 14l6.293 6.293a1 1 0 01-1.414 1.414L12 15.414l-6.293 6.293a1 1 0 01-1.414-1.414L10.586 14 4.293 7.707a1 1 0 010-1.414z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900">
            No Sessions Found
          </h2>
          <p className="text-gray-600">
            You are not enrolled in any sessions. Please contact support.
          </p>
        </div>
      </div>
    );
  }

  return null;
}
 