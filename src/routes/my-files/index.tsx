import { LayoutContainer } from "@/components/common/layout-container/layout-container";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getMyFiles } from "@/services/system-files-api";
import { Folder, X, FileText, ChevronRight } from "lucide-react";
import { MyButton } from "@/components/design-system/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { SystemFile } from "@/types/system-files";

export const Route = createFileRoute("/my-files/")({
  component: RouteComponent,
});

function RouteComponent() {
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: ["my-files"],
    queryFn: () => getMyFiles({}),
  });

  const handleClose = () => {
    navigate({ to: "/dashboard" });
  };

  const handleFolderClick = (folderName: string) => {
    // Encode the folder name for URL
    const encodedFolderName = encodeURIComponent(folderName);
    navigate({ to: `/my-files/${encodedFolderName}` });
  };

  if (isLoading) {
    return (
      <LayoutContainer className="!m-0 !p-0 max-w-none">
        <div className="min-h-screen bg-gray-50/50 pb-24 md:pb-8">
          {/* Header */}
          <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
            <div className="w-full py-4 px-4">
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-4">
                  <button
                    onClick={handleClose}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-600 md:hidden"
                  >
                    <X size={24} />
                  </button>
                  <h1 className="text-xl md:text-2xl font-bold text-gray-900">
                    My Files
                  </h1>
                </div>
                <div className="hidden md:flex gap-3">
                  <MyButton
                    type="button"
                    scale="medium"
                    buttonType="secondary"
                    layoutVariant="default"
                    onClick={handleClose}
                  >
                    Back to Dashboard
                  </MyButton>
                </div>
              </div>
            </div>
          </div>

          {/* Loading Skeleton */}
          <div className="py-6 md:py-8 px-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => (
                <Card key={i} className="overflow-hidden">
                  <CardContent className="p-6">
                    <div className="flex flex-col items-center text-center space-y-4">
                      <Skeleton className="h-16 w-16 rounded-full" />
                      <Skeleton className="h-5 w-32" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </LayoutContainer>
    );
  }

  if (error) {
    return (
      <LayoutContainer className="!m-0 !p-0 max-w-none">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-neutral-700 mb-2">
              Error Loading Folders
            </h2>
            <p className="text-neutral-500">Please try again later.</p>
          </div>
        </div>
      </LayoutContainer>
    );
  }

  const files = data?.files || [];

  // Group files by folder_name and get unique folders
  const folderMap = new Map<string, SystemFile[]>();
  files.forEach((file) => {
    if (file.folder_name) {
      if (!folderMap.has(file.folder_name)) {
        folderMap.set(file.folder_name, []);
      }
      folderMap.get(file.folder_name)!.push(file);
    }
  });

  const folders = Array.from(folderMap.entries()).map(([name, folderFiles]) => ({
    name,
    fileCount: folderFiles.length,
  }));

  if (folders.length === 0) {
    return (
      <LayoutContainer className="!m-0 !p-0 max-w-none">
        <div className="min-h-screen bg-gray-50/50 pb-24 md:pb-8">
          {/* Header */}
          <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
            <div className="w-full py-4 px-4">
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-4">
                  <button
                    onClick={handleClose}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-600 md:hidden"
                  >
                    <X size={24} />
                  </button>
                  <h1 className="text-xl md:text-2xl font-bold text-gray-900">
                    My Files
                  </h1>
                </div>
                <div className="hidden md:flex gap-3">
                  <MyButton
                    type="button"
                    scale="medium"
                    buttonType="secondary"
                    layoutVariant="default"
                    onClick={handleClose}
                  >
                    Back to Dashboard
                  </MyButton>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <h2 className="text-xl font-semibold text-neutral-700 mb-2">
                No Folders Found
              </h2>
              <p className="text-neutral-500">
                You don't have any folders yet.
              </p>
            </div>
          </div>
        </div>
      </LayoutContainer>
    );
  }

  return (
    <LayoutContainer className="!m-0 !p-0 max-w-none">
      <div className="min-h-screen bg-gray-50/50 pb-24 md:pb-8">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
          <div className="w-full py-4 px-4">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-4">
                <button
                  onClick={handleClose}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-600 md:hidden"
                >
                  <X size={24} />
                </button>
                <h1 className="text-xl md:text-2xl font-bold text-gray-900">
                  My Files
                </h1>
              </div>
              <div className="hidden md:flex gap-3">
                <MyButton
                  type="button"
                  scale="medium"
                  buttonType="secondary"
                  layoutVariant="default"
                  onClick={handleClose}
                >
                  Back to Dashboard
                </MyButton>
              </div>
            </div>
          </div>
        </div>

        {/* Folders Grid */}
        <div className="py-6 md:py-8 px-4 max-w-7xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
            <TooltipProvider>
              {folders.map((folder) => (
                <Tooltip key={folder.name}>
                  <TooltipTrigger asChild>
                    <Card
                      onClick={() => handleFolderClick(folder.name)}
                      className="group relative overflow-hidden border border-gray-200 dark:border-neutral-800 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 hover:border-primary-300 dark:hover:border-primary-700 cursor-pointer hover:-translate-y-1 bg-white dark:bg-neutral-900"
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between mb-3">
                          <div className="p-3 bg-gradient-to-br from-primary-50 to-primary-100 dark:from-primary-900/30 dark:to-primary-800/20 rounded-xl group-hover:from-primary-100 group-hover:to-primary-200 dark:group-hover:from-primary-800/40 dark:group-hover:to-primary-700/30 transition-all duration-300 shadow-sm">
                            <Folder className="h-6 w-6 text-primary-600 dark:text-primary-400 group-hover:scale-110 transition-transform duration-300" />
                          </div>
                          <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-primary-600 dark:group-hover:text-primary-400 group-hover:translate-x-1 transition-all duration-300 opacity-0 group-hover:opacity-100" />
                        </div>
                        <CardTitle className="text-base font-semibold text-gray-900 dark:text-white mb-2 line-clamp-2 text-left group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                          {folder.name}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="flex items-center justify-between">
                          <CardDescription className="text-sm text-gray-600 dark:text-gray-400 m-0">
                            {folder.fileCount === 1 ? "1 file" : `${folder.fileCount} files`}
                          </CardDescription>
                          <Badge 
                            variant="secondary" 
                            className="bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300 border-primary-200 dark:border-primary-700"
                          >
                            <FileText className="h-3 w-3 mr-1" />
                            {folder.fileCount}
                          </Badge>
                        </div>
                      </CardContent>
                      {/* Hover effect overlay */}
                      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                    </Card>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="font-medium">Click to view files in "{folder.name}"</p>
                  </TooltipContent>
                </Tooltip>
              ))}
            </TooltipProvider>
          </div>
        </div>
      </div>
    </LayoutContainer>
  );
}
