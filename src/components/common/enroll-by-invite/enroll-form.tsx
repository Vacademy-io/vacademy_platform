import { Route } from "@/routes/learner-invitation-response";
import { useSuspenseQuery } from "@tanstack/react-query";
import { handleGetEnrollInviteData } from "./-services/enroll-invite-services";
import { DashboardLoader } from "@/components/core/dashboard-loader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Award, Target, Info, GraduationCap, BookOpen } from "lucide-react";
import { useEffect, useState } from "react";
import { safeJsonParse } from "./-utils/helper";
import { useInstituteQuery } from "@/services/signup-api";
import { useInstituteDetailsStore } from "@/stores/study-library/useInstituteDetails";

interface FinalCourseData {
    aboutCourse: string;
    course: string;
    courseBanner: string;
    customHtml: string;
    description: string;
    includeInstituteLogo: boolean;
    learningOutcome: string;
    restrictToSameBatch: boolean;
    showRelatedCourses: boolean;
    tags: string[];
    targetAudience: string;
}

const EnrollByInvite = () => {
    const { instituteId, inviteCode } = Route.useSearch();
    const { isLoading: isInstituteLoading } = useSuspenseQuery(
        useInstituteQuery({ instituteId })
    );

    const { getDetailsFromPackageSessionId } = useInstituteDetailsStore();

    const { data: inviteData, isLoading } = useSuspenseQuery(
        handleGetEnrollInviteData({ instituteId, inviteCode })
    );

    // Form state
    const [formData, setFormData] = useState({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
    });

    const handleInputChange = (field: string, value: string) => {
        setFormData((prev) => ({
            ...prev,
            [field]: value,
        }));
    };

    const handleRegister = () => {
        // Handle registration logic here
        console.log("Registration data:", formData);
    };

    const [courseData, setCourseData] = useState<FinalCourseData>({
        aboutCourse: "",
        course: "",
        courseBanner: "",
        customHtml: "",
        description: "",
        includeInstituteLogo: false,
        learningOutcome: "",
        restrictToSameBatch: false,
        showRelatedCourses: false,
        tags: [],
        targetAudience: "",
    });

    useEffect(() => {
        const loadCourseData = async () => {
            try {
                const transformedData = await safeJsonParse(
                    inviteData?.web_page_meta_data_json,
                    {}
                );
                setCourseData({
                    aboutCourse: transformedData.aboutCourse,
                    course: transformedData.course,
                    courseBanner: transformedData.courseBannerBlob,
                    customHtml: transformedData.customHtml,
                    description: transformedData.description,
                    includeInstituteLogo: transformedData.includeInstituteLogo,
                    learningOutcome: transformedData.learningOutcome,
                    restrictToSameBatch: transformedData.restrictToSameBatch,
                    showRelatedCourses: transformedData.transformedData,
                    tags: transformedData?.tags ?? [],
                    targetAudience: transformedData?.targetAudience ?? "",
                });
            } catch (error) {
                console.error("Error transforming course data:", error);
            }
        };

        loadCourseData();
    }, [inviteData]);

    console.log(
        getDetailsFromPackageSessionId({
            packageSessionId: "386fbdcb-352b-480f-8213-0521c451d75b",
        })
    );

    if (isLoading || isInstituteLoading) return <DashboardLoader />;

    return (
        <div className="w-full min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-8 px-4 sm:px-6 lg:px-8">
            <div className="max-w-[80%] mx-auto space-y-8">
                {/* Course Information Card */}
                <Card className="overflow-hidden shadow-xl border-0 bg-white/80 backdrop-blur-sm w-full">
                    {/* Banner Image */}
                    <div className="p-8 rounded-lg !pb-0">
                        {courseData.courseBanner ? (
                            <div className="rounded-xl relative h-32 sm:h-56 lg:h-72 w-full overflow-hidden">
                                <img
                                    src={courseData.courseBanner}
                                    alt="Course Banner"
                                    className="w-full h-full object-contain"
                                />
                            </div>
                        ) : (
                            <div className="rounded-xl relative h-32 sm:h-56 lg:h-72 w-full overflow-hidden bg-primary-500"></div>
                        )}
                    </div>
                    <CardContent className="p-6 sm:p-8">
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
                                {courseData?.tags?.map(
                                    (tag: string, index: number) => (
                                        <Badge
                                            key={index}
                                            variant="secondary"
                                            className="px-3 py-1 text-sm font-medium bg-blue-100 text-blue-800 hover:bg-blue-200 transition-colors"
                                        >
                                            {tag}
                                        </Badge>
                                    )
                                )}
                            </div>
                        )}

                        {/* Course Description */}
                        <p
                            className="text-gray-700 text-base sm:text-lg leading-relaxed mb-6"
                            dangerouslySetInnerHTML={{
                                __html: courseData.description || "",
                            }}
                        />

                        {/* Level Badge */}
                        <div className="flex items-start gap-2 mb-8">
                            <Award className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                            <Badge
                                variant="outline"
                                className="px-3 py-1 text-sm font-medium border-amber-200 text-amber-700"
                            >
                                {/* Level: {courseData.level} */}
                                {getDetailsFromPackageSessionId({
                                    packageSessionId:
                                        inviteData
                                            .package_session_to_payment_options[0]
                                            .package_session_id,
                                })?.level.level_name || "-"}
                            </Badge>
                        </div>

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
                                            __html:
                                                courseData?.learningOutcome ||
                                                "",
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
                                        __html: courseData?.aboutCourse || "",
                                    }}
                                />
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Registration Card */}
                <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm w-full">
                    <CardContent className="p-6 sm:p-8">
                        {/* Header */}
                        <div className="flex items-start gap-2 sm:gap-3 mb-6">
                            <div className="p-1.5 sm:p-2 bg-blue-100 rounded-lg flex-shrink-0">
                                <GraduationCap className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                            </div>
                            <div>
                                <h2 className="text-lg sm:text-xl md:text-2xl font-semibold text-gray-900 leading-tight">
                                    Join This Course
                                </h2>
                                <p className="text-gray-600 text-sm mt-1">
                                    Fill in your details to enroll in the course
                                </p>
                            </div>
                        </div>

                        <Separator className="mb-6" />

                        {/* Registration Form */}
                        <div className="space-y-6">
                            {/* Email Field */}
                            <div className="space-y-2">
                                <Label
                                    htmlFor="email"
                                    className="text-sm font-medium text-gray-700"
                                >
                                    Email Address *
                                </Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="Enter your email address"
                                    value={formData.email}
                                    onChange={(e) =>
                                        handleInputChange(
                                            "email",
                                            e.target.value
                                        )
                                    }
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                    required
                                />
                            </div>

                            {/* Phone Field */}
                            <div className="space-y-2">
                                <Label
                                    htmlFor="phone"
                                    className="text-sm font-medium text-gray-700"
                                >
                                    Phone Number *
                                </Label>
                                <Input
                                    id="phone"
                                    type="tel"
                                    placeholder="Enter your phone number"
                                    value={formData.phone}
                                    onChange={(e) =>
                                        handleInputChange(
                                            "phone",
                                            e.target.value
                                        )
                                    }
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                    required
                                />
                            </div>

                            {/* Register Button */}
                            <Button
                                onClick={handleRegister}
                                size="lg"
                                className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl"
                            >
                                <GraduationCap className="w-5 h-5 mr-2" />
                                Register
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default EnrollByInvite;
