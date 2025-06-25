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
    <div className="min-h-screen bg-gradient-to-br from-gray-50/50 via-white to-orange-50/20 p-6">
      <div className="max-w-4xl mx-auto">
        <Tabs defaultValue="General" className="w-full">
          {/* Modern Tab Header */}
          <div className="mb-8">
            <TabsList className="bg-gray-50/50 rounded-2xl p-1.5 w-fit">
              <TabsTrigger
                className="rounded-xl px-8 py-3 font-light text-gray-600 transition-all duration-300 data-[state=active]:bg-white data-[state=active]:text-orange-600 data-[state=active]:shadow-lg data-[state=active]:font-medium"
                value="General"
              >
                General Notifications
              </TabsTrigger>
              <TabsTrigger
                className="rounded-xl px-8 py-3 font-light text-gray-600 transition-all duration-300 data-[state=active]:bg-white data-[state=active]:text-orange-600 data-[state=active]:shadow-lg data-[state=active]:font-medium"
                value="Announcement"
              >
                Announcements
              </TabsTrigger>
            </TabsList>
          </div>

          {/* General Notifications */}
          <TabsContent 
            className="grid gap-6 animate-fade-in-up opacity-0" 
            value="General"
            style={{animationDelay: '0.1s', animationFillMode: 'forwards'}}
          >
            <div className="space-y-4">
              <NotifcationCard
                title="New Assessment Assigned!"
                description="You have been assigned a new assessment: The Human Eye and The Colourful World. Check the details and stay prepared!"
                date="Today, 11:06 AM"
                isNew={true}
              />
              <NotifcationCard
                title="Study Material Updated"
                description="New study materials have been added to your Physics course. Review the latest chapters on Optics and Light."
                date="Yesterday, 3:45 PM"
                isNew={false}
              />
            </div>
          </TabsContent>

          {/* Announcements */}
          <TabsContent 
            className="grid gap-6 animate-fade-in-up opacity-0" 
            value="Announcement"
            style={{animationDelay: '0.1s', animationFillMode: 'forwards'}}
          >
            <div className="space-y-4">
              <NotifcationCard
                title="School Holiday Notice"
                description="Please note that the school will be closed on Monday, December 25th for Christmas holiday. All classes will resume on December 26th."
                date="Dec 20, 2023, 9:00 AM"
                isNew={true}
              />
              <NotifcationCard
                title="Exam Schedule Released"
                description="The final examination schedule for this semester has been published. Please check your student portal for detailed timings and venues."
                date="Dec 18, 2023, 2:30 PM"
                isNew={false}
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
