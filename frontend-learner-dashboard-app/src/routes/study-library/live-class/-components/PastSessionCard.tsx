import { useState } from "react";
import {
  Clock,
  MapPin,
  PlayCircle,
  CheckCircle,
  XCircle,
  MinusCircle,
  ChatTeardrop,
  HandPalm,
  Smiley,
  ChartBar,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  formatSessionTimeInUserTimezone,
  getTimezoneDisplayInfo,
} from "@/utils/timezone";
import { PastSessionDetails, LearnerRecording } from "../-types/types";
import { RecordingPlayerDialog } from "./RecordingPlayerDialog";

interface PastSessionCardProps {
  session: PastSessionDetails;
}

const AttendanceBadge = ({
  status,
}: {
  status: PastSessionDetails["attendance_status"];
}) => {
  if (!status) return null;
  if (status === "PRESENT") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-success-100 px-2 py-1 text-xs font-medium text-success-700 dark:bg-success-900/30 dark:text-success-300">
        <CheckCircle size={14} weight="fill" />
        Present
      </span>
    );
  }
  if (status === "ABSENT") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-danger-100 px-2 py-1 text-xs font-medium text-danger-700 dark:bg-danger-900/30 dark:text-danger-300">
        <XCircle size={14} weight="fill" />
        Absent
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-1 text-xs font-medium text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
      <MinusCircle size={14} />
      Not marked
    </span>
  );
};

const ActivityChips = ({
  activity,
}: {
  activity: PastSessionDetails["activity"];
}) => {
  if (!activity) return null;
  const chips: { icon: JSX.Element; label: string }[] = [];

  if (activity.duration_minutes != null) {
    chips.push({
      icon: <Clock size={12} />,
      label: `Attended ${activity.duration_minutes} min`,
    });
  }
  if (activity.chats != null) {
    chips.push({ icon: <ChatTeardrop size={12} />, label: `${activity.chats} chats` });
  }
  if (activity.poll_votes != null) {
    chips.push({ icon: <ChartBar size={12} />, label: `${activity.poll_votes} poll votes` });
  }
  if (activity.raise_hand != null) {
    chips.push({ icon: <HandPalm size={12} />, label: `${activity.raise_hand} hand raises` });
  }
  if (activity.emojis != null) {
    chips.push({ icon: <Smiley size={12} />, label: `${activity.emojis} reactions` });
  }

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {chips.map((chip, idx) => (
        <span
          key={idx}
          className="inline-flex items-center gap-1 rounded-full bg-neutral-100 dark:bg-neutral-800 px-2 py-1 text-xs text-neutral-600 dark:text-neutral-300"
        >
          {chip.icon}
          {chip.label}
        </span>
      ))}
    </div>
  );
};

export const PastSessionCard = ({ session }: PastSessionCardProps) => {
  const [activeRecording, setActiveRecording] = useState<LearnerRecording | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const recordings = session.recordings ?? [];

  const handleWatch = (recording: LearnerRecording) => {
    if (recording.expired) return;
    if (recording.playback_type === "BBB") {
      if (recording.url) window.open(recording.url, "_blank", "noopener,noreferrer");
      return;
    }
    setActiveRecording(recording);
    setDialogOpen(true);
  };

  const recordingLabel = (recording: LearnerRecording, index: number) =>
    recording.part_label || (recordings.length > 1 ? `Part ${index + 1}` : "Watch Recording");

  const cardBody = (
    <>
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <h3 className="font-semibold text-lg text-neutral-800 dark:text-neutral-100">
          {session.title}
        </h3>
        <AttendanceBadge status={session.attendance_status} />
      </div>

      {session.subject && session.subject.toLowerCase() !== "none" && (
        <div className="flex items-center gap-1 text-sm text-neutral-600 dark:text-neutral-300 mb-2">
          <MapPin size={16} className="text-neutral-500 dark:text-neutral-400" />
          <span className="capitalize">{session.subject}</span>
        </div>
      )}

      <div className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300 mb-2">
        <Clock size={16} className="text-neutral-500 dark:text-neutral-400" />
        <span>
          {new Date(session.meeting_date).toLocaleDateString("en-US", {
            weekday: "short",
            year: "numeric",
            month: "short",
            day: "numeric",
          })}
          {" · "}
          {formatSessionTimeInUserTimezone(
            session.meeting_date,
            session.start_time,
            session.timezone
          )}
          {session.timezone && (
            <span className="text-xs text-neutral-500 dark:text-neutral-400 ml-1">
              ({getTimezoneDisplayInfo(session.timezone).sessionTz})
            </span>
          )}
        </span>
      </div>

      {session.activity && (
        <div className="mb-2">
          <ActivityChips activity={session.activity} />
        </div>
      )}

      {recordings.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mt-2">
          {recordings.map((recording, idx) => (
            <Button
              key={recording.recording_id || idx}
              variant="outline"
              size="sm"
              disabled={!!recording.expired}
              onClick={() => handleWatch(recording)}
            >
              <PlayCircle size={16} className="mr-1.5" />
              {recording.expired ? "Recording expired" : recordingLabel(recording, idx)}
            </Button>
          ))}
        </div>
      )}
    </>
  );

  return (
    <div className="p-4 border rounded-xl bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 hover:shadow-sm transition-all duration-200 w-full">
      {cardBody}
      <RecordingPlayerDialog
        recording={activeRecording}
        title={session.title}
        open={dialogOpen}
        onOpenChange={(next) => {
          setDialogOpen(next);
          if (!next) setActiveRecording(null);
        }}
      />
    </div>
  );
};
