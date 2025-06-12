export interface TrackingDataType {
  id: string,
  source_id: string | null,
  source_type: string | null,
  user_id: string,
  slide_id: string | null,
  start_time_in_millis: number,
  end_time_in_millis: number,
  percentage_watched: number | null,
  videos: 
    {
      id: string,
      start_time_in_millis: number,
      end_time_in_millis: number
    }[] | null,
  documents: 
    {
      id: string,
      start_time_in_millis: number,
      end_time_in_millis: number,
      page_number: number
    }[]
    | null,
  new_activity: boolean,
  concentration_score: {
    id: string,
    concentration_score: number,
    tab_switch_count: number,
    pause_count: number,
    answer_times_in_seconds: number[]
  }
}