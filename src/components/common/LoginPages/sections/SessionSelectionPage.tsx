import { useEffect, useState } from "react";
import { Preferences } from "@capacitor/preferences";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { toast } from "sonner";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { DashboardLoader } from "@/components/core/dashboard-loader";
import { getPublicUrl } from "@/services/upload_file";
import { Session } from "@/types/user/user-detail";

const SessionSelectionPage = () => {
  const [sessionList, setSessionList] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const navigate = useNavigate();
  const { redirect } = useSearch<any>({ from: "/SessionSelectionPage/" });

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
    try {
      setLoading(true);
      const { value } = await Preferences.get({ key: "sessionList" });
      if (!value) {
        toast.error("No sessions found");
        setSessionList([]);
        return;
      }
      const sessions = JSON.parse(value) as Session[];
      setSessionList(sessions);
    } catch (error) {
      toast.error("Failed to load sessions.");
      console.error("Error fetching sessions:", error);
      setSessionList([]);
    } finally {
      setLoading(false);
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
        } catch (error) {
          console.error(`Failed to fetch image URL for session ${session.id}:`, error);
        }
      }
    }
    setImageUrls(urls);
  };

  const handleSessionSelect = async (selectedSession: Session) => {
    try {
      setSelectedId(selectedSession.id); // Triggers full-page loader
      const studentData = await Preferences.get({ key: "students" });
      if (!studentData.value) throw new Error("No student data found!");

      const studentList = JSON.parse(studentData.value);
      const selectedStudent = studentList.find(
        (student: any) => student.package_session_id === selectedSession.id
      );

      if (!selectedStudent) throw new Error("No matching student found for selected session!");

      await Preferences.set({
        key: "StudentDetails",
        value: JSON.stringify(selectedStudent),
      });

      navigate({ to: redirect });
    } catch (error) {
      console.error("Error selecting session:", error);
      toast.error("Something went wrong while selecting session.");
      setSelectedId(null);
    }
  };

  // 🔁 Central loader when loading or selecting
  if (loading || selectedId)
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <DashboardLoader />
      </div>
    );

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center space-y-4 mb-8 animate-fade-in-down opacity-0 [animation-delay:0.2s] [animation-fill-mode:forwards]">
          <div className="w-20 h-20 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl mx-auto flex items-center justify-center shadow-lg">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13..." />
            </svg>
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Choose Your Course</h1>
            <p className="text-gray-600">Select a course to begin your learning journey</p>
          </div>
        </div>

        {/* If no sessions */}
        {sessionList.length === 0 ? (
          <div className="max-w-md mx-auto animate-fade-in-up opacity-0 [animation-delay:0.4s] [animation-fill-mode:forwards]">
            <div className="glass-card rounded-2xl p-8 text-center shadow-xl">
              <div className="w-16 h-16 bg-gray-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13..." />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Courses Available</h3>
              <p className="text-gray-600">
                You are not currently enrolled in any courses. Please contact your administrator.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 animate-fade-in-up opacity-0 [animation-delay:0.4s] [animation-fill-mode:forwards]">
            {sessionList.map((session, index) => (
              <div
                key={session.id}
                className={`group cursor-pointer transition-all duration-300 hover:scale-[1.02] ${
                  selectedId === session.id ? "scale-[1.02]" : ""
                }`}
                onClick={() => handleSessionSelect(session)}
                style={{ animationDelay: `${0.1 * index}s` }}
              >
                <Card
                  className={`glass-card border-2 transition-all duration-300 shadow-lg hover:shadow-xl ${
                    selectedId === session.id
                      ? "border-emerald-500 ring-4 ring-emerald-500/20"
                      : "border-gray-200 hover:border-emerald-300"
                  }`}
                >
                  <div className="relative h-48 overflow-hidden rounded-t-lg">
                    {imageUrls[session.id] ? (
                      <img
                        src={imageUrls[session.id]}
                        alt={session.package_dto.package_name}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                      />
                    ) : (
                      <div className="flex w-full h-full items-center justify-center bg-gradient-to-br from-emerald-100 to-teal-100">
                        <svg className="w-16 h-16 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13..." />
                        </svg>
                      </div>
                    )}
                    {selectedId === session.id && (
                      <div className="absolute top-3 right-3 w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center animate-scale-in">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </div>

                  <CardHeader className="pb-3">
                    <h3 className="text-xl font-bold text-gray-900 group-hover:text-emerald-600 transition-colors duration-300">
                      {session.package_dto.package_name}
                    </h3>
                  </CardHeader>

                  <CardContent className="space-y-3">
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <span className="font-medium">Session:</span>
                      <span>{session.session.session_name}</span>
                    </div>
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <span className="font-medium">Level:</span>
                      <span>{session.level.level_name} Year/Class</span>
                    </div>
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <span className="font-medium">Start Date:</span>
                      <span>{new Date(session.start_time).toLocaleDateString()}</span>
                    </div>
                    <div className="pt-2">
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>Ready to start</span>
                        <span>100%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-gradient-to-r from-emerald-500 to-teal-500 h-2 rounded-full w-full transition-all duration-300"></div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SessionSelectionPage;
