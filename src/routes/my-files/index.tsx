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
import { Card, CardContent } from "@/components/ui/card";
import { DashboardLoader } from "@/components/core/dashboard-loader";
import { NotePreviewDialog } from "./components/note-preview-dialog";
import type { SystemFile } from "@/types/system-files";
import {
  Eye,
  Download,
  Edit,
  ArrowLeft,
  FileText,
  Link2,
  File,
} from "lucide-react";

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

  const getFileIcon = (fileType: string) => {
    switch (fileType) {
      case "Html":
        return <FileText className="h-4 w-4 text-blue-500" />;
      case "Url":
        return <Link2 className="h-4 w-4 text-green-500" />;
      case "File":
        return <File className="h-4 w-4 text-purple-500" />;
      default:
        return <File className="h-4 w-4 text-gray-500" />;
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-6 px-4 max-w-7xl">
        <DashboardLoader />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-6 px-4 max-w-7xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
            My Files
          </h1>
          <Button
            variant="outline"
            onClick={() => navigate({ to: "/dashboard" })}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back to Dashboard</span>
          </Button>
        </div>
        <Card className="border-red-200 bg-red-50/50">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <FileText className="h-8 w-8 text-red-600" />
            </div>
            <h3 className="text-lg font-semibold text-red-900 mb-2">
              Error Loading Files
            </h3>
            <p className="text-sm text-red-700 text-center">
              Unable to load your files. Please try again later.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const files = data?.files || [];

  if (files.length === 0) {
    return (
      <div className="container mx-auto py-6 px-4 max-w-7xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
            My Files
          </h1>
          <Button
            variant="outline"
            onClick={() => navigate({ to: "/dashboard" })}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back to Dashboard</span>
          </Button>
        </div>

        <Card className="border-dashed border-2">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="w-20 h-20 bg-primary-50 rounded-full flex items-center justify-center mb-4">
              <FileText className="h-10 w-10 text-primary-500" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              No Files Yet
            </h3>
            <p className="text-gray-600 dark:text-gray-400 text-center max-w-md">
              Files shared with you will appear here. Check back later or
              contact your instructor.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-4 sm:py-6 px-4 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-1">
            My Files
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {files.length} {files.length === 1 ? "file" : "files"} available
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => navigate({ to: "/dashboard" })}
          className="gap-2 self-start sm:self-auto"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Back to Dashboard</span>
          <span className="sm:hidden">Back</span>
        </Button>
      </div>

      {/* Desktop Table View */}
      <Card className="hidden lg:block border border-gray-200 dark:border-neutral-800 shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-primary-100 dark:bg-primary-900/20 hover:bg-primary-100 dark:hover:bg-primary-900/20">
                <TableHead className="font-semibold text-primary-900 dark:text-primary-100">
                  Name
                </TableHead>
                <TableHead className="font-semibold text-primary-900 dark:text-primary-100">
                  Type
                </TableHead>
                <TableHead className="font-semibold text-primary-900 dark:text-primary-100">
                  Media Type
                </TableHead>
                <TableHead className="font-semibold text-primary-900 dark:text-primary-100">
                  Added By
                </TableHead>
                <TableHead className="font-semibold text-primary-900 dark:text-primary-100">
                  Date Added
                </TableHead>
                <TableHead className="text-right font-semibold text-primary-900 dark:text-primary-100">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {files.map((file) => (
                <TableRow
                  key={file.id}
                  className="hover:bg-gray-50 dark:hover:bg-neutral-900/50 transition-colors"
                >
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {getFileIcon(file.file_type)}
                      <span className="truncate max-w-xs">{file.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-xs font-medium">
                      {file.file_type === "Html" ? "Note" : file.file_type}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="capitalize text-gray-600 dark:text-gray-400">
                      {file.media_type === "note" ? "Text" : file.media_type}
                    </span>
                  </TableCell>
                  <TableCell className="text-gray-600 dark:text-gray-400">
                    {file.created_by}
                  </TableCell>
                  <TableCell className="text-gray-600 dark:text-gray-400 text-sm">
                    {formatDate(file.created_at_iso)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {canShowViewButton(file) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewClick(file)}
                          title={
                            file.file_type === "Url" ? "Open URL" : "View Note"
                          }
                          className="gap-1.5"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span className="hidden xl:inline">View</span>
                        </Button>
                      )}
                      {canShowDownloadButton(file) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownloadClick(file)}
                          title="Download File"
                          className="gap-1.5"
                        >
                          <Download className="h-3.5 w-3.5" />
                          <span className="hidden xl:inline">Download</span>
                        </Button>
                      )}
                      {hasEditAccess(file) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditClick(file)}
                          title="Edit File"
                          className="gap-1.5"
                        >
                          <Edit className="h-3.5 w-3.5" />
                          <span className="hidden xl:inline">Edit</span>
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Tablet & Mobile Card View */}
      <div className="lg:hidden grid gap-4">
        {files.map((file) => (
          <Card
            key={file.id}
            className="border border-gray-200 dark:border-neutral-800 hover:shadow-md transition-all duration-200 hover:border-primary-300 dark:hover:border-primary-700"
          >
            <CardContent className="p-4">
              {/* Header with icon and name */}
              <div className="flex items-start gap-3 mb-3">
                <div className="mt-1">{getFileIcon(file.file_type)}</div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 dark:text-white break-words mb-1">
                    {file.name}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-xs font-medium">
                      {file.file_type === "Html" ? "Note" : file.file_type}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                      {file.media_type === "note" ? "Text" : file.media_type}
                    </span>
                  </div>
                </div>
              </div>

              {/* File Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 text-sm">
                <div>
                  <span className="text-gray-500 dark:text-gray-400 block mb-1">
                    Added By
                  </span>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {file.created_by}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400 block mb-1">
                    Date Added
                  </span>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {formatDate(file.created_at_iso)}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-100 dark:border-neutral-800">
                {canShowViewButton(file) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewClick(file)}
                    title={file.file_type === "Url" ? "Open URL" : "View Note"}
                    className="flex-1 min-w-[100px] gap-2"
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
                    className="flex-1 min-w-[100px] gap-2"
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
                    className="flex-1 min-w-[100px] gap-2"
                  >
                    <Edit className="h-4 w-4" />
                    Edit
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
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
