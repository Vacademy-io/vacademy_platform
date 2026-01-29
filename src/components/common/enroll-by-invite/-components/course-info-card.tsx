import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Award, Target, Info } from "lucide-react";

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

const stripUrlQueryString = (htmlString: string) => {
  if (!htmlString) return "";
  // Regex to find src or href attributes with query parameters and strip them
  return htmlString.replace(
    /(src|href)=(["'])([^"']*?)(\?[^"']*)\2/gi,
    "$1=$2$3$2"
  );
};

const CourseInfoCard = ({ courseData, levelName }: CourseInfoCardProps) => {
  return (
    <Card className="overflow-hidden shadow-lg border bg-white w-full">
      <CardContent className="p-5 sm:p-6">
        {/* Course Name, Tags, and Description Removed as they duplicate the header info */}

        {/* Level Wedge - hidden when level is 'default' (case-insensitive) or empty */}
        {(() => {
          const normalizedLevel = (levelName || "").trim().toLowerCase();
          if (!normalizedLevel || normalizedLevel === "default" || normalizedLevel === "-") return null;
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
                  __html: stripUrlQueryString(courseData?.learningOutcome || ""),
                }}
              />
            </div>
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
                __html: stripUrlQueryString(courseData?.aboutCourse || ""),
              }}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CourseInfoCard;
