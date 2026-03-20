export type FileType = "File" | "Url" | "Html";

export type MediaType = "video" | "audio" | "pdf" | "doc" | "image" | "note" | "unknown";

export type AccessType = "view" | "edit";

export interface SystemFile {
  id: string;
  file_type: FileType;
  media_type: MediaType;
  data: string;
  name: string;
  folder_name: string | null;
  thumbnail_file_id: string | null;
  created_at_iso: string;
  updated_at_iso: string;
  created_by: string;
  access_types: AccessType[];
}

export interface MyFilesRequest {
  user_roles?: string[];
  access_type?: AccessType;
  statuses?: string[];
}

export interface MyFilesResponse {
  files: SystemFile[];
}
