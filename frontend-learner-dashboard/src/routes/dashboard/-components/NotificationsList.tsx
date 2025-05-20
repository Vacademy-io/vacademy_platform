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
    <Tabs defaultValue="General" className="">
      <TabsList className="inline-flex h-auto justify-start gap-4 rounded-none border-b !bg-transparent p-0 w-fit mb-2">
        <TabsTrigger
          className="flex gap-1.5 rounded-none px-12 py-2 !shadow-none text-body data-[state=active]:text-primary-500 data-[state=active]:rounded-t-sm data-[state=active]:border data-[state=active]:!border-b-0 data-[state=active]:border-primary-200 data-[state=active]:!bg-primary-50"
          value="General"
        >
          General
        </TabsTrigger>
        <TabsTrigger
          className="flex gap-1.5 rounded-none px-12 py-2 !shadow-none text-body data-[state=active]:text-primary-500 data-[state=active]:rounded-t-sm data-[state=active]:border data-[state=active]:!border-b-0 data-[state=active]:border-primary-200 data-[state=active]:!bg-primary-50"
          value="Announcement"
        >
          Announcement
        </TabsTrigger>
      </TabsList>
      <TabsContent className="flex flex-col gap-4" value="General">
        <NotifcationCard
          title="New Assessment Assigned!"
          description="You have been assigned a new assessment: The Human Eye and The Colourful World. Check the details and stay prepared!"
          date="Today, 11:06 AM"
        />
        <NotifcationCard
          title="New Assessment Assigned!"
          description="You have been assigned a new assessment: The Human Eye and The Colourful World. Check the details and stay prepared!"
          date="Today, 11:06 AM"
        />
      </TabsContent>
      <TabsContent className="flex flex-col gap-4" value="Announcement">
        <NotifcationCard
          title="New Assessment Assigned!"
          description="You have been assigned a new assessment: The Human Eye and The Colourful World. Check the details and stay prepared!"
          date="Today, 11:06 AM"
        />
        <NotifcationCard
          title="New Assessment Assigned!"
          description="You have been assigned a new assessment: The Human Eye and The Colourful World. Check the details and stay prepared!"
          date="Today, 11:06 AM"
        />
      </TabsContent>
    </Tabs>
  );
}
