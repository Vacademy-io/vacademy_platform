import { LayoutContainer } from "@/components/common/layout-container/layout-container";
import { createFileRoute } from "@tanstack/react-router";
import { Helmet } from "react-helmet";
import { useEffect, useState } from "react";
import { useNavHeadingStore } from "@/stores/layout-container/useNavHeadingStore";
import { useLiveSessions } from "./-hooks/useLiveSessions";
import { SessionDetails } from "./-types/types";

import { useNavigate } from "@tanstack/react-router";
import { SessionStreamingServiceType } from "@/routes/register/live-class/-types/enum";
import { getPackageSessionId } from "@/utils/study-library/get-list-from-stores/getPackageSessionId";
import { useMarkAttendance } from "./-hooks/useMarkAttendance";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Calendar, List, Clock, MapPin, Users, ArrowSquareOut, X } from "phosphor-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/study-library/live-class/")({
  component: RouteComponent,
});

function RouteComponent() {
  const { setNavHeading } = useNavHeadingStore();
  const navigate = useNavigate();
  const [batchId, setBatchId] = useState<string>("");
  const [selectedView, setSelectedView] = useState<string>("calendar");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [dayModalOpen, setDayModalOpen] = useState<boolean>(false);
  const [selectedDayData, setSelectedDayData] = useState<{
    date: Date;
    sessions: SessionDetails[];
  } | null>(null);
  const { mutateAsync: markAttendance } = useMarkAttendance();

  useEffect(() => {
    const fetchBatchId = async () => {
      const id = await getPackageSessionId();
      setBatchId(id);
    };
    fetchBatchId();
  }, []);

  const { data: sessions, isLoading, error } = useLiveSessions(batchId);
  console.log("sessions ", sessions);
  
  // Debug: Log all session dates for calendar view troubleshooting
  if (sessions) {
    console.log("All session dates:", {
      live: sessions.live_sessions?.map(s => s.meeting_date) || [],
      upcoming: sessions.upcoming_sessions?.map(s => s.meeting_date) || []
    });
  }

  useEffect(() => {
    setNavHeading(
      <div className="flex items-center gap-2">
        <div>Live Classes</div>
      </div>
    );
  }, [setNavHeading]);

  const formatDateTime = (date: string, time: string) => {
    const datetime = new Date(`${date}T${time}`);
    return datetime.toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const handleJoinSession = async (session: SessionDetails) => {
    const now = new Date();
    const sessionDate = new Date(
      `${session.meeting_date}T${session.start_time}`
    );
    const waitingRoomStart = new Date(sessionDate);
    waitingRoomStart.setMinutes(
      waitingRoomStart.getMinutes() - session.waiting_room_time
    );

    // Check if we're in waiting room period or main session
    const isInWaitingRoom = now >= waitingRoomStart && now < sessionDate;
    const isInMainSession = now >= sessionDate;

    if (isInWaitingRoom) {
      // Navigate to waiting room without marking attendance
      navigate({
        to: "/study-library/live-class/waiting-room",
        search: { sessionId: session.schedule_id },
      });
    } else if (isInMainSession) {
      try {
        // Mark attendance only when directly joining live session
        await markAttendance({
          sessionId: session.session_id,
          scheduleId: session.schedule_id,
          userSourceType: "USER",
          userSourceId: "",
          details: "Joined live class directly",
        });

        // Navigate to live session
        if (
          session.session_streaming_service_type ===
          SessionStreamingServiceType.EMBED
        ) {
          navigate({
            to: "/study-library/live-class/embed",
            search: { sessionId: session.schedule_id },
          });
        } else {
          window.open(session.meeting_link, "_blank", "noopener,noreferrer");
        }
      } catch (error) {
        console.error("Failed to mark attendance:", error);
        toast.error("Failed to mark attendance");

        // Still proceed with navigation even if attendance marking fails
        if (
          session.session_streaming_service_type ===
          SessionStreamingServiceType.EMBED
        ) {
          navigate({
            to: "/study-library/live-class/embed",
            search: { sessionId: session.schedule_id },
          });
        } else {
          window.open(session.meeting_link, "_blank", "noopener,noreferrer");
        }
      }
    }
  };

  const calculateDuration = (startTime: string, lastEntryTime: string) => {
    const [startHours, startMinutes] = startTime.split(":").map(Number);
    const [endHours, endMinutes] = lastEntryTime.split(":").map(Number);

    let durationMinutes =
      endHours * 60 + endMinutes - (startHours * 60 + startMinutes);

    if (durationMinutes < 0) {
      durationMinutes += 24 * 60;
    }

    const hours = Math.floor(durationMinutes / 60);
    const minutes = durationMinutes % 60;

    if (hours === 0) {
      return `${minutes} minutes`;
    } else if (minutes === 0) {
      return `${hours} hour${hours > 1 ? "s" : ""}`;
    } else {
      return `${hours} hour${hours > 1 ? "s" : ""} ${minutes} minutes`;
    }
  };

  const renderSession = (session: SessionDetails, isLive: boolean) => (
    isLive && console.log("session ", session),
    (
      <div
        key={session.session_id}
        className="group p-4 border rounded-xl bg-gradient-to-br from-white to-neutral-50/50 hover:from-primary-50/30 hover:to-blue-50/40 border-neutral-200 hover:border-primary-200/60 hover:shadow-sm transition-all duration-200 w-full"
      >
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-semibold text-lg text-neutral-800 group-hover:text-primary-700 transition-colors">
                {session.title}
              </h3>
              {isLive && (
                <span className="px-2 py-1 bg-gradient-to-r from-red-500 to-red-600 text-white text-xs font-medium rounded-full animate-pulse">
                  LIVE
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 text-sm text-neutral-600 mb-2">
              <MapPin size={16} className="text-neutral-500" />
              <span className="capitalize">{session.subject}</span>
            </div>
          </div>
          {isLive && session.meeting_link && (
            <Button
              variant="default"
              size="sm"
              className="bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white shadow-sm hover:shadow-md transition-all duration-200"
              onClick={() => handleJoinSession(session)}
            >
              <ArrowSquareOut size={16} className="mr-1.5" />
              Join Session
            </Button>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-neutral-500" />
            <span className="text-neutral-600">
              <span className="font-medium">Starts:</span>{" "}
              {formatDateTime(session.meeting_date, session.start_time)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Users size={16} className="text-neutral-500" />
            <span className="text-neutral-600">
              <span className="font-medium">Duration:</span>{" "}
              {calculateDuration(session.start_time, session.last_entry_time)}
            </span>
          </div>
        </div>
      </div>
    )
  );

  // Calendar view functions
  const getCurrentMonth = () => {
    return selectedDate.getMonth();
  };

  const getCurrentYear = () => {
    return selectedDate.getFullYear();
  };

  const getDaysInMonth = (month: number, year: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (month: number, year: number) => {
    return new Date(year, month, 1).getDay();
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setSelectedDate(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
  };

  const getSessionsForDate = (date: Date) => {
    // Format date as YYYY-MM-DD in local timezone to avoid UTC issues
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateString = `${year}-${month}-${day}`;
    
    const allSessions = [
      ...(sessions?.live_sessions ?? []),
      ...(sessions?.upcoming_sessions ?? [])
    ];
    
    const filteredSessions = allSessions.filter(session => session.meeting_date === dateString);
    
    // Debug logging for June 30th specifically
    if (dateString === '2025-06-30') {
      console.log('June 30th check:', {
        dateString,
        allSessionsCount: allSessions.length,
        filteredSessionsCount: filteredSessions.length,
        allSessionDates: allSessions.map(s => s.meeting_date),
        filteredSessions
      });
    }
    
    return filteredSessions;
  };

  const handleDayClick = (date: Date, sessionsForDay: SessionDetails[]) => {
    if (sessionsForDay.length > 0) {
      setSelectedDayData({ date, sessions: sessionsForDay });
      setDayModalOpen(true);
    }
  };

  const renderDayModal = () => {
    if (!selectedDayData) return null;

    const liveSessions = selectedDayData.sessions.filter(session => 
      sessions?.live_sessions.includes(session)
    );
    const upcomingSessions = selectedDayData.sessions.filter(session => 
      sessions?.upcoming_sessions.includes(session)
    );

    return (
      <Dialog open={dayModalOpen} onOpenChange={setDayModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="text-xl font-semibold text-neutral-800">
                Classes on {formatDate(selectedDayData.date)}
              </DialogTitle>
              <DialogClose asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <X size={16} />
                </Button>
              </DialogClose>
            </div>
          </DialogHeader>
          
          <div className="space-y-6 mt-4">
            {liveSessions.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-neutral-800 mb-3 flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-gradient-to-r from-red-500 to-red-600 animate-pulse"></div>
                  Live Sessions
                </h3>
                <div className="space-y-3">
                  {liveSessions
                    .sort((a, b) => a.start_time.localeCompare(b.start_time))
                    .map((session) => (
                      <div key={session.schedule_id} className="p-4 border rounded-lg bg-gradient-to-r from-red-50/50 to-red-100/30 border-red-200">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h4 className="font-semibold text-neutral-800 mb-1">{session.title}</h4>
                            <div className="flex items-center gap-4 text-sm text-neutral-600">
                              <div className="flex items-center gap-1">
                                <Clock size={14} />
                                <span>{formatTime(session.start_time)} - {formatTime(session.last_entry_time)}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <MapPin size={14} />
                                <span className="capitalize">{session.subject}</span>
                              </div>
                            </div>
                          </div>
                          {session.meeting_link && (
                            <Button
                              size="sm"
                              className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white"
                              onClick={() => {
                                handleJoinSession(session);
                                setDayModalOpen(false);
                              }}
                            >
                              <ArrowSquareOut size={14} className="mr-1" />
                              Join
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {upcomingSessions.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-neutral-800 mb-3 flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-gradient-to-r from-blue-500 to-blue-600"></div>
                  Upcoming Sessions
                </h3>
                <div className="space-y-3">
                  {upcomingSessions
                    .sort((a, b) => a.start_time.localeCompare(b.start_time))
                    .map((session) => (
                      <div key={session.schedule_id} className="p-4 border rounded-lg bg-gradient-to-r from-blue-50/50 to-blue-100/30 border-blue-200">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h4 className="font-semibold text-neutral-800 mb-1">{session.title}</h4>
                            <div className="flex items-center gap-4 text-sm text-neutral-600">
                              <div className="flex items-center gap-1">
                                <Clock size={14} />
                                <span>{formatTime(session.start_time)} - {formatTime(session.last_entry_time)}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <MapPin size={14} />
                                <span className="capitalize">{session.subject}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {selectedDayData.sessions.length === 0 && (
              <div className="text-center py-8">
                <Clock size={48} className="mx-auto text-neutral-400 mb-3" />
                <p className="text-neutral-600">No classes scheduled for this day</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  const renderCalendarView = () => {
    const month = getCurrentMonth();
    const year = getCurrentYear();
    const daysInMonth = getDaysInMonth(month, year);
    const firstDay = getFirstDayOfMonth(month, year);
    
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    
    const days = [];
    
    // Empty cells for days before the first day of the month
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-24 border border-neutral-200"></div>);
    }
    
    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const currentDate = new Date(year, month, day);
      const sessionsForDay = getSessionsForDate(currentDate);
      const isToday = currentDate.toDateString() === new Date().toDateString();
      const hasLive = sessionsForDay.some(session => sessions?.live_sessions.includes(session));
      const sessionCount = sessionsForDay.length;
      
      days.push(
        <div 
          key={day} 
          className={`h-24 border border-neutral-200 p-1 transition-all duration-200 hover:bg-neutral-50 cursor-pointer ${
            isToday ? 'bg-primary-50/50 border-primary-200' : 'bg-white'
          } ${sessionCount > 0 ? 'hover:shadow-sm' : ''}`}
          onClick={() => handleDayClick(currentDate, sessionsForDay)}
        >
          <div className={`text-sm font-medium mb-1 flex items-center justify-between ${
            isToday ? 'text-primary-700' : 'text-neutral-700'
          }`}>
            <span>{day}</span>
            {sessionCount > 0 && (
              <div className={`flex items-center gap-1 ${
                hasLive ? 'text-red-600' : 'text-blue-600'
              }`}>
                <div className={`w-2 h-2 rounded-full ${
                  hasLive 
                    ? 'bg-gradient-to-r from-red-500 to-red-600 animate-pulse' 
                    : 'bg-gradient-to-r from-blue-500 to-blue-600'
                }`}></div>
                <span className="text-xs font-semibold">{sessionCount}</span>
              </div>
            )}
          </div>
          
          {/* Compact session indicators */}
          <div className="space-y-1">
            {sessionsForDay.slice(0, 1).map((session) => {
              const isLive = sessions?.live_sessions.includes(session);
              return (
                <div 
                  key={session.schedule_id}
                  className={`text-xs p-1 rounded truncate transition-all duration-200 ${
                    isLive 
                      ? 'bg-gradient-to-r from-red-500/20 to-red-600/20 text-red-700 border border-red-200' 
                      : 'bg-gradient-to-r from-blue-500/20 to-blue-600/20 text-blue-700 border border-blue-200'
                  }`}
                  title={`${session.title} - ${session.start_time}`}
                >
                  {session.start_time.slice(0, 5)} {session.title}
                </div>
              );
            })}
            
            {sessionCount > 1 && (
              <div className={`text-xs text-center font-medium rounded py-1 ${
                hasLive 
                  ? 'bg-red-100/80 text-red-700 border border-red-200' 
                  : 'bg-blue-100/80 text-blue-700 border border-blue-200'
              }`}>
                +{sessionCount - 1} more
              </div>
            )}
          </div>
        </div>
      );
    }
    
    return (
      <div className="bg-white rounded-lg border border-neutral-200 p-4">
        {/* Calendar Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-neutral-800">
            {monthNames[month]} {year}
          </h3>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateMonth('prev')}
              className="border-neutral-300 hover:border-primary-300 hover:bg-primary-50"
            >
              ←
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedDate(new Date())}
              className="border-neutral-300 hover:border-primary-300 hover:bg-primary-50"
            >
              Today
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateMonth('next')}
              className="border-neutral-300 hover:border-primary-300 hover:bg-primary-50"
            >
              →
            </Button>
          </div>
        </div>
        
        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-0">
          {/* Day headers */}
          {dayNames.map(day => (
            <div key={day} className="h-10 border border-neutral-200 bg-neutral-100 flex items-center justify-center font-medium text-sm text-neutral-700">
              {day}
            </div>
          ))}
          {/* Calendar days */}
          {days}
        </div>
        
        {/* Legend */}
        <div className="flex items-center gap-4 mt-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-gradient-to-r from-red-500/20 to-red-600/20 border border-red-200"></div>
            <span className="text-neutral-600">Live Sessions</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-gradient-to-r from-blue-500/20 to-blue-600/20 border border-blue-200"></div>
            <span className="text-neutral-600">Upcoming Sessions</span>
          </div>
          <div className="text-neutral-500 text-xs italic">
            Click on a day to view all classes
          </div>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <LayoutContainer>
        <div className="flex items-center justify-center min-h-[200px]">
          <div className="flex flex-col items-center gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            <div className="text-neutral-600">Loading sessions...</div>
          </div>
        </div>
      </LayoutContainer>
    );
  }

  if (error) {
    return (
      <LayoutContainer>
        <div className="p-4 border border-red-200 rounded-lg bg-red-50 text-red-700">
          <div className="flex items-center gap-2">
            <span className="font-medium">Error loading sessions:</span>
            <span>{(error as Error).message}</span>
          </div>
        </div>
      </LayoutContainer>
    );
  }

  const liveSessions = sessions?.live_sessions ?? [];
  const upcomingSessions = sessions?.upcoming_sessions ?? [];

  return (
    <LayoutContainer>
      <Helmet>
        <title>Live Classes</title>
        <meta name="description" content="Live and upcoming class sessions" />
      </Helmet>

      <div className="space-y-6">
        {/* View Toggle */}
        <Tabs value={selectedView} onValueChange={setSelectedView} className="w-full">
          <TabsList className="h-auto border-b border-neutral-200/80 bg-transparent p-0">
            <TabsTrigger
              value="list"
              className="data-[state=active]:text-primary data-[state=active]:border-primary hover:text-primary -mb-px px-4 py-2 text-sm font-medium transition-all duration-200 hover:bg-gradient-to-r hover:from-primary-50/60 hover:to-blue-50/40 focus-visible:ring-2 focus-visible:ring-primary-300 focus-visible:ring-offset-1 data-[state=active]:rounded-t-lg data-[state=active]:border-b-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-white data-[state=active]:to-primary-50/30 data-[state=inactive]:text-neutral-500 data-[state=inactive]:hover:rounded-t-lg"
            >
              <List size={18} className="mr-2" />
              List View
            </TabsTrigger>
            <TabsTrigger
              value="calendar"
              className="data-[state=active]:text-primary data-[state=active]:border-primary hover:text-primary -mb-px px-4 py-2 text-sm font-medium transition-all duration-200 hover:bg-gradient-to-r hover:from-primary-50/60 hover:to-blue-50/40 focus-visible:ring-2 focus-visible:ring-primary-300 focus-visible:ring-offset-1 data-[state=active]:rounded-t-lg data-[state=active]:border-b-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-white data-[state=active]:to-primary-50/30 data-[state=inactive]:text-neutral-500 data-[state=inactive]:hover:rounded-t-lg"
            >
              <Calendar size={18} className="mr-2" />
              Calendar View
            </TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="mt-6">
            <div className="space-y-8">
              <div>
                <h2 className="text-xl font-semibold mb-4 text-neutral-800">Live Sessions</h2>
                {liveSessions.length > 0 ? (
                  <div className="space-y-4 w-full">
                    {liveSessions.map((session) => renderSession(session, true))}
                  </div>
                ) : (
                  <div className="text-neutral-600 p-6 bg-gradient-to-br from-neutral-50 to-neutral-100 rounded-lg w-full border border-neutral-200">
                    <div className="text-center">
                      <Users size={48} className="mx-auto text-neutral-400 mb-3" />
                      <p className="font-medium">No live sessions at the moment</p>
                      <p className="text-sm text-neutral-500 mt-1">Check back later or view upcoming sessions</p>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <h2 className="text-xl font-semibold mb-4 text-neutral-800">Upcoming Sessions</h2>
                {upcomingSessions.length > 0 ? (
                  <div className="space-y-4 w-full">
                    {upcomingSessions.map((session) => renderSession(session, false))}
                  </div>
                ) : (
                  <div className="text-neutral-600 p-6 bg-gradient-to-br from-neutral-50 to-neutral-100 rounded-lg w-full border border-neutral-200">
                    <div className="text-center">
                      <Clock size={48} className="mx-auto text-neutral-400 mb-3" />
                      <p className="font-medium">No upcoming sessions scheduled</p>
                      <p className="text-sm text-neutral-500 mt-1">New sessions will appear here when scheduled</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="calendar" className="mt-6">
            {renderCalendarView()}
          </TabsContent>
        </Tabs>
        
        {/* Day Details Modal */}
        {renderDayModal()}
      </div>
    </LayoutContainer>
  );
}
