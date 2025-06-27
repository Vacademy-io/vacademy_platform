import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NotifcationCard } from "./NotificationCard";
import { fetchNotifications, fetchAnnouncements } from "../-lib/utils";
import { useEffect, useState } from "react";

export function NotificationList() {
  const [notifications, setNotifications] = useState();
  const [announcements, setAnnouncements] = useState();
  console.log(notifications, announcements);
  async function fetch() {
    const notifications = await fetchNotifications();
    const announcements = await fetchAnnouncements();
    setNotifications(notifications);
    setAnnouncements(announcements);
  }
  useEffect(() => {
    fetch();
  }, []);
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50/80 via-white to-primary-50/30 p-6 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute top-0 left-1/4 w-72 h-72 bg-gradient-to-br from-primary-100/30 to-transparent rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-gradient-to-br from-slate-100/40 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
      
      <div className="max-w-4xl mx-auto relative z-10">
        <Tabs defaultValue="General" className="w-full">
          {/* Enhanced Header */}
          <div className="mb-10 animate-fade-in-down">
            <div className="text-center mb-6">
              <h1 className="text-3xl font-bold text-slate-900 mb-2 tracking-tight">
                Notifications
              </h1>
              <p className="text-base text-slate-600 font-medium">
                Stay updated with your latest activities and announcements
              </p>
            </div>
            
            <TabsList className="bg-gradient-to-r from-white/90 to-slate-50/90 backdrop-blur-xl rounded-2xl p-1.5 w-fit mx-auto shadow-lg border border-slate-200/50">
              <TabsTrigger
                className="rounded-xl px-6 py-3 font-medium text-slate-600 transition-all duration-500 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary-500 data-[state=active]:to-primary-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-primary-200/50 data-[state=active]:transform data-[state=active]:scale-105 hover:bg-slate-100/50 relative overflow-hidden group"
                value="General"
              >
                <span className="relative z-10 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5z" />
                  </svg>
                  General Notifications
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-primary-400 to-primary-500 opacity-0 group-hover:opacity-10 transition-opacity duration-300"></div>
              </TabsTrigger>
              <TabsTrigger
                className="rounded-xl px-6 py-3 font-medium text-slate-600 transition-all duration-500 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary-500 data-[state=active]:to-primary-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-primary-200/50 data-[state=active]:transform data-[state=active]:scale-105 hover:bg-slate-100/50 relative overflow-hidden group"
                value="Announcement"
              >
                <span className="relative z-10 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                  </svg>
                  Announcements
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-primary-400 to-primary-500 opacity-0 group-hover:opacity-10 transition-opacity duration-300"></div>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Enhanced General Notifications */}
          <TabsContent 
            className="grid gap-5 animate-fade-in-up opacity-0" 
            value="General"
            style={{animationDelay: '0.2s', animationFillMode: 'forwards'}}
          >
            <div className="space-y-5">
              <div className="animate-slide-in-left" style={{animationDelay: '0.1s'}}>
                <NotifcationCard
                  title="New Assessment Assigned!"
                  description="You have been assigned a new assessment: The Human Eye and The Colourful World. Check the details and stay prepared!"
                  date="Today, 11:06 AM"
                  isNew={true}
                />
              </div>
              <div className="animate-slide-in-left" style={{animationDelay: '0.2s'}}>
                <NotifcationCard
                  title="Study Material Updated"
                  description="New study materials have been added to your Physics course. Review the latest chapters on Optics and Light."
                  date="Yesterday, 3:45 PM"
                  isNew={false}
                />
              </div>
              <div className="animate-slide-in-left" style={{animationDelay: '0.3s'}}>
                <NotifcationCard
                  title="Assignment Reminder"
                  description="Don't forget to submit your Mathematics assignment on Quadratic Equations. Deadline is approaching soon."
                  date="2 days ago, 4:20 PM"
                  isNew={false}
                />
              </div>
            </div>
          </TabsContent>

          {/* Enhanced Announcements */}
          <TabsContent 
            className="grid gap-5 animate-fade-in-up opacity-0" 
            value="Announcement"
            style={{animationDelay: '0.2s', animationFillMode: 'forwards'}}
          >
            <div className="space-y-5">
              <div className="animate-slide-in-left" style={{animationDelay: '0.1s'}}>
                <NotifcationCard
                  title="School Holiday Notice"
                  description="Please note that the school will be closed on Monday, December 25th for Christmas holiday. All classes will resume on December 26th."
                  date="Dec 20, 2023, 9:00 AM"
                  isNew={true}
                />
              </div>
              <div className="animate-slide-in-left" style={{animationDelay: '0.2s'}}>
                <NotifcationCard
                  title="Exam Schedule Released"
                  description="The final examination schedule for this semester has been published. Please check your student portal for detailed timings and venues."
                  date="Dec 18, 2023, 2:30 PM"
                  isNew={false}
                />
              </div>
              <div className="animate-slide-in-left" style={{animationDelay: '0.3s'}}>
                <NotifcationCard
                  title="Parent-Teacher Meeting"
                  description="Annual parent-teacher conference scheduled for next month. Online booking for appointment slots will open soon."
                  date="Dec 15, 2023, 1:15 PM"
                  isNew={false}
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
