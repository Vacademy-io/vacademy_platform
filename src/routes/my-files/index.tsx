import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getMyFiles } from "@/services/system-files-api";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { NotePreviewDialog } from "./components/note-preview-dialog";
import type { SystemFile } from "@/types/system-files";
import { Eye, Download, Edit, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/my-files/")({
  component: RouteComponent,
});

function RouteComponent() {
  const navigate = useNavigate();
  const [selectedNote, setSelectedNote] = useState<{
    title: string;
    content: string;
  } | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["my-files"],
    queryFn: () => getMyFiles({}),
  });

  const formatDate = (isoDate: string) => {
    const date = new Date(isoDate);
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  const handleViewClick = (file: SystemFile) => {
    if (file.file_type === "Url") {
      window.open(file.data, "_blank");
    } else if (file.file_type === "Html") {
      setSelectedNote({
        title: file.name,
        content: file.data,
      });
    }
  };

  const handleDownloadClick = async (file: SystemFile) => {
    try {
      // For File type, the data field contains the S3 fileId
      // We need to get the public URL from S3
      const { getPublicUrl } = await import("@/services/upload_file");
      const publicUrl = await getPublicUrl(file.data);
      window.open(publicUrl, "_blank");
    } catch (error) {
      console.error("Error downloading file:", error);
      // Fallback to direct URL if getPublicUrl fails
      window.open(file.data, "_blank");
    }
  };

  const handleEditClick = (file: SystemFile) => {
    // TODO: Implement edit functionality
    console.log("Edit file:", file);
  };

  const hasViewAccess = (file: SystemFile) => {
    return file.access_types.includes("view");
  };

  const hasEditAccess = (file: SystemFile) => {
    return file.access_types.includes("edit");
  };

  const canShowViewButton = (file: SystemFile) => {
    return (
      hasViewAccess(file) &&
      (file.file_type === "Url" || file.file_type === "Html")
    );
  };

  const canShowDownloadButton = (file: SystemFile) => {
    return hasViewAccess(file) && file.file_type === "File";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading files...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-destructive">
          Error loading files. Please try again later.
        </div>
      </div>
    );
  }

  const files = data?.files || [];

  if (files.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-muted-foreground text-lg">No files found</p>
          <p className="text-muted-foreground text-sm mt-2">
            Files shared with you will appear here
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">My Files</h1>
        <Button
          variant="default"
          onClick={() => navigate({ to: "/dashboard" })}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Button>
      </div>
      
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Media Type</TableHead>
              <TableHead>Added By</TableHead>
              <TableHead>Date Added</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {files.map((file) => (
              <TableRow key={file.id}>
                <TableCell className="font-medium">{file.name}</TableCell>
                <TableCell>{file.file_type==="Html" ? "Note" : file.file_type}</TableCell>
                <TableCell className="capitalize">{file.media_type === "note" ? "Text" : file.media_type}</TableCell>
                <TableCell>{file.created_by}</TableCell>
                <TableCell>{formatDate(file.created_at_iso)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    {canShowViewButton(file) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewClick(file)}
                        title={file.file_type === "Url" ? "Open URL" : "View Note"}
                      >
                        <Eye className="h-4 w-4" />
                        View
                      </Button>
                    )}
                    {canShowDownloadButton(file) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownloadClick(file)}
                        title="Download File"
                      >
                        <Download className="h-4 w-4" />
                        Download
                      </Button>
                    )}
                    {hasEditAccess(file) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditClick(file)}
                        title="Edit File"
                      >
                        <Edit className="h-4 w-4" />
                        Edit
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <NotePreviewDialog
        open={selectedNote !== null}
        onOpenChange={(open) => !open && setSelectedNote(null)}
        title={selectedNote?.title || ""}
        htmlContent={selectedNote?.content || ""}
      />
    </div>
  );
}
