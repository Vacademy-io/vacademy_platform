import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Award, Target, Info, BookOpen } from "lucide-react";

interface FinalCourseData {
  aboutCourse: string;
  course: string;
  courseBanner: string;
  courseMediaId: {
    type: string;
    id: string;
  };
  courseMedia: string;
  coursePreview: string;
  customHtml: string;
  description: string;
  includeInstituteLogo: boolean;
  instituteLogo: string;
  learningOutcome: string;
  restrictToSameBatch: boolean;
  showRelatedCourses: boolean;
  tags: string[];
  targetAudience: string;
}

interface CourseInfoCardProps {
  courseData: FinalCourseData;
  levelName: string;
}

// Utility to extract YouTube video ID
const extractYouTubeVideoId = (url: string): string | null => {
  const regExp =
    /^.*(?:youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|live\/)([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[1] && match[1].length === 11 ? match[1] : null;
};

const CourseInfoCard = ({ courseData, levelName }: CourseInfoCardProps) => {
  return (
    <Card className="overflow-hidden shadow-lg border bg-white w-full">
      {/* Banner Image - full cover with rounded corners; no top logo duplication */}
      <div className="p-6 rounded-md !pb-0">
        {courseData.courseBanner ? (
          <div className="rounded-xl relative w-full overflow-hidden aspect-video">
            <img
              src={courseData.courseBanner}
              alt="Course Banner"
              className="absolute inset-0 w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className="rounded-xl relative w-full overflow-hidden aspect-video bg-gradient-to-br from-slate-200 to-slate-100" />
        )}
      </div>
      <CardContent className="p-5 sm:p-6">
        {/* Course Name */}
        <div className="flex items-start gap-2 sm:gap-3 mb-4">
          <BookOpen className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 flex-shrink-0 mt-0.5" />
          <h2 className="text-lg sm:text-xl md:text-2xl font-semibold text-gray-900 leading-tight">
            {courseData.course}
          </h2>
        </div>
        {/* Tags Row */}
        {courseData?.tags?.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {courseData?.tags?.map((tag: string, index: number) => (
              <Badge
                key={index}
                variant="outline"
                className="h-7 rounded-full px-3 text-xs font-medium uppercase tracking-wide bg-gray-100 text-gray-700 border-gray-200"
              >
                {tag}
              </Badge>
            ))}
          </div>
        )}

        {/* Course Description */}
        <p
          className="text-gray-700 text-base sm:text-lg leading-relaxed mb-6"
          dangerouslySetInnerHTML={{
            __html: courseData.description || "",
          }}
        />

        {/* Level Wedge - hidden when level is 'default' (case-insensitive) or empty */}
        {(() => {
          const normalizedLevel = (levelName || "").trim().toLowerCase();
          if (!normalizedLevel || normalizedLevel === "default") return null;
          return (
            <div className="flex items-start gap-2 mb-8">
              <Award className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <Badge
                variant="outline"
                className="h-7 rounded-full px-3 text-xs font-medium uppercase tracking-wide border-amber-200 text-amber-700 bg-amber-50"
              >
                {levelName}
              </Badge>
            </div>
          );
        })()}

        <Separator className="my-8" />

        {/* What Learners Will Gain Section */}
        {courseData?.learningOutcome && (
          <div className="mb-8">
            <div className="flex items-start gap-2 sm:gap-3 mb-4">
              <Target className="w-5 h-5 sm:w-6 sm:h-6 text-green-600 flex-shrink-0 mt-0.5" />
              <h2 className="text-lg sm:text-xl md:text-2xl font-semibold text-gray-900 leading-tight">
                What Learners Will Gain
              </h2>
            </div>
            <div className="grid gap-3">
              <p
                className="text-gray-700 text-sm sm:text-base"
                dangerouslySetInnerHTML={{
                  __html: courseData?.learningOutcome || "",
                }}
              />
            </div>
          </div>
        )}

        {courseData.coursePreview && (
          <div className="flex justify-center items-center pt-8 rounded-lg">
            <img
              src={courseData.coursePreview}
              alt="Course Preview Image"
              className="w-fit"
            />
          </div>
        )}

        <Separator className="my-8" />

        {/* About the Course Section */}
        {courseData?.aboutCourse && (
          <div className="mb-8">
            <div className="flex items-start gap-2 sm:gap-3 mb-4">
              <Info className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 flex-shrink-0 mt-0.5" />
              <h2 className="text-lg sm:text-xl md:text-2xl font-semibold text-gray-900 leading-tight">
                About the Course
              </h2>
            </div>
            <p
              className="text-gray-700 text-sm sm:text-base leading-relaxed"
              dangerouslySetInnerHTML={{
                __html: courseData?.aboutCourse || "",
              }}
            />
          </div>
        )}

        {/* Right side - Video Player - More Compact */}
        {courseData?.courseMediaId?.id &&
          (courseData?.courseMediaId?.type === "youtube" ? (
            <div className={`shrink-0 overflow-hidden rounded-lg shadow-lg`}>
              <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-lg bg-black">
                <iframe
                  width="100%"
                  height="100%"
                  src={`https://www.youtube.com/embed/${extractYouTubeVideoId(
                    courseData?.courseMediaId?.id || ""
                  )}`}
                  title="YouTube video player"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="size-full object-contain"
                />
              </div>
            </div>
          ) : courseData?.courseMediaId?.type === "video" ? (
            <div className={`shrink-0 overflow-hidden rounded-lg shadow-lg`}>
              <div className="relative aspect-video overflow-hidden rounded-lg bg-black">
                <video
                  src={courseData?.courseMedia}
                  controls
                  controlsList="nodownload noremoteplayback"
                  disablePictureInPicture
                  disableRemotePlayback
                  className="size-full object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                    e.currentTarget.parentElement?.classList.add("bg-black");
                  }}
                >
                  Your browser does not support the video tag.
                </video>
              </div>
            </div>
          ) : (
            <div className={`shrink-0 overflow-hidden rounded-lg shadow-lg`}>
              <div className="relative aspect-video overflow-hidden rounded-lg bg-black">
                <img
                  src={courseData?.courseMedia}
                  alt="Course Banner"
                  className="size-full object-contain"
                />
              </div>
            </div>
          ))}
      </CardContent>
    </Card>
  );
};

export default CourseInfoCard;
