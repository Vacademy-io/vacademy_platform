import { useState, useEffect } from "react";
import { Gamepad2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";

interface ScratchProjectData {
  projectId: string;
  scratchUrl: string;
  embedType: string;
  autoStart: boolean;
  hideControls: boolean;
  editorType: "scratchEditor";
  timestamp: number;
  projectName: string;
}

interface ScratchProjectSlideProps {
  published_data: string;
}

export const ScratchProjectSlide: React.FC<ScratchProjectSlideProps> = ({
  published_data,
}) => {
  const [projectData, setProjectData] = useState<ScratchProjectData | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const data = JSON.parse(published_data) as ScratchProjectData;
      setProjectData(data);
      setIsLoading(false);
    } catch (err) {
      console.error("Failed to parse Scratch project data:", err);
      setError("Failed to load project configuration");
      setIsLoading(false);
    }
  }, [published_data]);

  const handleOpenInNewTab = () => {
    if (projectData?.scratchUrl) {
      window.open(projectData.scratchUrl, "_blank");
    }
  };
  const handleSeeInside = () => {
    if (projectData?.projectId) {
      const editorUrl = `https://scratch.mit.edu/projects/${projectData?.projectId}/editor/`;
      window.open(editorUrl, "_blank");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin"></div>
          <div className="text-neutral-500">Loading Scratch Project...</div>
        </div>
      </div>
    );
  }

  if (error || !projectData) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <div className="bg-red-50 rounded-full p-4">
            <Gamepad2 size={32} className="text-red-500" />
          </div>
          <div className="text-red-500">
            {error || "Failed to load project"}
          </div>
        </div>
      </div>
    );
  }

  // Create the embed URL for Scratch
  const embedUrl = `https://scratch.mit.edu/projects/${
    projectData.projectId
  }/embed${projectData.autoStart ? "?autostart=true" : ""}`;

  return (
    <div className="h-full p-1">
      <Card className="h-screen flex flex-col">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-orange-100 rounded-lg p-2">
                <Gamepad2 size={20} className="text-orange-600" />
              </div>
              <div className="flex flex-col">
                <h3 className="text-sm font-medium text-neutral-900">
                  {projectData.projectName}
                </h3>
                <p className="text-xs text-neutral-500">
                  Project ID: {projectData.projectId}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenInNewTab}
                className="flex items-center gap-1.5"
              >
                <ExternalLink size={14} />
                Open in Scratch
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSeeInside}
                className="flex items-center gap-1.5"
              >
                <ExternalLink size={14} />
                Edit in Scratch
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex-1 p-0 relative">
          <iframe
            src={embedUrl}
            title={projectData.projectName}
            className="w-full h-full border-none rounded-b-lg"
            allowFullScreen
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
            loading="lazy"
            onLoad={() => setIsLoading(false)}
            onError={() => setError("Failed to load Scratch project")}
          />

          {/* Loading overlay */}
          {isLoading && (
            <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-10 rounded-b-lg">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin"></div>
                <div className="text-neutral-500">
                  Loading Scratch interface...
                </div>
              </div>
            </div>
          )}

          {/* Footer overlay */}
          <div className="absolute bottom-0 left-0 right-0 border-t border-neutral-200 bg-white/95 backdrop-blur-sm px-4 py-2 flex items-center justify-between text-xs text-neutral-500">
            <div className="flex items-center gap-4">
              <span>Type: Scratch Project</span>
              <span>Embed Type: {projectData.embedType}</span>
            </div>
            <div className="flex items-center gap-2">
              {projectData.autoStart && (
                <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs">
                  Auto Start
                </span>
              )}
              <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded text-xs">
                Interactive
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
