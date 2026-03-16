import { motion } from "framer-motion";
import type { ChildProfile, InterviewSchedule, AssessmentSchedule } from "@/types/parent-portal";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarCheck, Clock, MapPin, Video, Timer, ExternalLink, CalendarDays } from "lucide-react";

interface Props { child: ChildProfile; interview: InterviewSchedule; assessment: AssessmentSchedule }

export function InterviewDemo({ child, interview, assessment }: Props) {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto w-full space-y-6 pb-20 lg:pb-8">
      <div><h2 className="text-lg sm:text-xl font-bold text-foreground">Interview & Assessment</h2><p className="text-sm text-muted-foreground mt-0.5">Scheduled sessions for {child.full_name}</p></div>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <ScheduleCard type="Interview" date={interview.scheduled_date} time={interview.scheduled_time} dur={interview.duration_minutes} mode={interview.mode} link={interview.meeting_link} location={interview.location} icon={<Video size={20} className="text-violet-600 dark:text-violet-400" />} accent="violet" />
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <ScheduleCard type="Assessment" date={assessment.scheduled_date} time={assessment.scheduled_time} dur={assessment.duration_minutes} mode={assessment.mode} location={assessment.location} icon={<CalendarCheck size={20} className="text-blue-600 dark:text-blue-400" />} accent="blue" />
      </motion.div>
    </div>
  );
}

function ScheduleCard({ type, date, time, dur, mode, link, location, icon, accent }: { type: string; date: string; time: string; dur: number; mode: string; link?: string; location?: string; icon: React.ReactNode; accent: "violet" | "blue" }) {
  const dateStr = new Date(date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const bg = accent === "violet" ? "bg-violet-50 dark:bg-violet-950/20" : "bg-blue-50 dark:bg-blue-950/20";
  const border = accent === "violet" ? "border-l-violet-500" : "border-l-blue-500";
  return (
    <Card className={`shadow-sm border-l-4 ${border}`}>
      <CardHeader className="pb-3"><div className="flex items-center gap-2.5"><div className={`p-2 rounded-lg ${bg}`}>{icon}</div><div><CardTitle className="text-base">{type}</CardTitle><CardDescription className="text-xs">Upcoming</CardDescription></div></div></CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-2 text-sm"><CalendarDays size={14} className="text-muted-foreground" /><span>{dateStr}</span></div>
          <div className="flex items-center gap-2 text-sm"><Clock size={14} className="text-muted-foreground" /><span>{time}</span></div>
          <div className="flex items-center gap-2 text-sm"><Timer size={14} className="text-muted-foreground" /><span className="text-muted-foreground">{dur} min</span></div>
        </div>
        <div className="flex items-center gap-2 text-sm">
          {mode === "ONLINE" ? <Video size={14} className="text-muted-foreground" /> : <MapPin size={14} className="text-muted-foreground" />}
          <span>{mode === "ONLINE" ? "Online" : location || "On campus"}</span>
          <Badge variant="outline" className="text-[10px] ml-auto">{mode}</Badge>
        </div>
        {link && <Button variant="outline" size="sm" className="w-full sm:w-auto gap-1.5 text-xs h-8" onClick={() => window.open(link, "_blank")}><Video size={12} />Join Meeting<ExternalLink size={10} /></Button>}
      </CardContent>
    </Card>
  );
}
