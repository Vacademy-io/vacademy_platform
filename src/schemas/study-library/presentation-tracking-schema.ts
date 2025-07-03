import { z } from "zod";

export const ConcentrationScoreSchema = z.object({
  id: z.string(),
  concentration_score: z.number(),
  tab_switch_count: z.number(),
  pause_count: z.number(),
  wrong_answer_count: z.number(),
  answer_times_in_seconds: z.array(z.number()),
});

export const ViewSessionSchema = z.object({
  id: z.string(),
  start_time: z.string(),
  end_time: z.string(),
  start_time_in_millis: z.number(),
  end_time_in_millis: z.number(),
  duration: z.number(),
});

export const ActivitySchema = z.object({
  slide_id: z.string(),
  activity_id: z.string(),
  source: z.literal("PRESENTATION"),
  source_id: z.string(),
  start_time: z.string(),
  end_time: z.string(),
  start_time_in_millis: z.number(),
  end_time_in_millis: z.number(),
  duration: z.string(),
  view_sessions: z.array(ViewSessionSchema),
  total_viewing_time: z.number(),
  sync_status: z.enum(["SYNCED", "STALE"]),
  current_session_start_time_in_millis: z.number(),
  new_activity: z.boolean(),
  concentration_score: ConcentrationScoreSchema,
});

export type ConcentrationScore = z.infer<typeof ConcentrationScoreSchema>;
export type ViewSession = z.infer<typeof ViewSessionSchema>;
export type Activity = z.infer<typeof ActivitySchema>; 