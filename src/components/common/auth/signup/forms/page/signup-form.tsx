import { useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
    Shield,
    BookOpen,
    Users,
    Award,
    Sparkles,
    CheckCircle,
    Star,
} from "lucide-react";
import { motion } from "framer-motion";
import { ModularDynamicSignupContainer } from "../../components/ModularDynamicSignupContainer";
// Removed unused imports - using ModularDynamicSignupContainer instead
import { useModularSignupFlow } from "../../hooks/use-modular-signup-flow";

export function SignUpForm({
    type,
    courseId,
}: {
    type?: string;
    courseId?: string;
}) {
    const navigate = useNavigate();
    const search = useSearch({ from: "/signup/" });
    const domainRouting = useDomainRouting();
    const { setPrimaryColor } = useTheme();
    
    // Use search parameters if not provided as props
    const finalType = type || (search as { type?: string; courseId?: string; instituteId?: string }).type;
    const finalCourseId = courseId || (search as { type?: string; courseId?: string; instituteId?: string }).courseId;
    const instituteId = (search as { instituteId?: string }).instituteId;

    // Check for OAuth callback parameters to extract institute ID
    const [finalInstituteId, setFinalInstituteId] = useState<string | null>(null);

    useEffect(() => {
      // Check if we have OAuth callback parameters
      const urlParams = new URLSearchParams(window.location.search);
      const signupDataParam = urlParams.get("signupData");
      const stateParam = urlParams.get("state");
      
      console.log("SignupForm: OAuth callback parameter extraction", {
        signupDataParam: !!signupDataParam,
        stateParam: !!stateParam,
        currentInstituteId: instituteId
      });
      
      if (signupDataParam && stateParam) {
        try {
          const decodedState = JSON.parse(atob(stateParam));
          console.log("SignupForm: Decoded OAuth state", decodedState);
          
          if (decodedState?.institute_id) {
            console.log("SignupForm: Setting institute ID from OAuth", decodedState.institute_id);
            setFinalInstituteId(decodedState.institute_id);
            return;
          }
        } catch (error) {
          console.error("Failed to decode OAuth state:", error);
        }
      }
      
      // Fallback to instituteId from search params
      if (instituteId) {
        console.log("SignupForm: Using institute ID from search params", instituteId);
        setFinalInstituteId(instituteId);
      } else {
        console.log("SignupForm: No institute ID available");
        setFinalInstituteId(null);
      }
    }, [instituteId]);
    
    // Use the modular signup flow hook only if we have an institute ID
    const { settings, isLoading, error } = useModularSignupFlow({ 
      instituteId: finalInstituteId || "" 
    });
    
    // Debug logging
    console.log("SignupForm: Institute ID extraction", {
      searchParams: window.location.search,
      extractedInstituteId: instituteId,
      finalInstituteId,
      hasOAuthParams: !!(search.signupData && search.state),
      settings,
      isLoading,
      error
    });

    // Removed modal-specific logic - using unified signup flow

    return (
        <div
            className={`${finalType ? "h-[400px] overflow-auto" : "min-h-screen overflow-hidden"}  bg-gray-50 relative `}
        >
            {/* Subtle Background Pattern */}
            <div className="absolute inset-0 bg-grid-gray-100 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] -z-10" />

            {/* Subtle Floating Background Elements */}
            <motion.div
                animate={{
                    x: [0, 20, 0],
                    y: [0, -10, 0],
                    rotate: [0, 2, 0],
                }}
                transition={{
                    duration: 12,
                    repeat: Infinity,
                    ease: "easeInOut",
                }}
                className="absolute top-20 left-20 w-48 h-48 bg-gradient-to-br from-gray-200/10 to-gray-300/10 rounded-full blur-3xl"
            />
            <motion.div
                animate={{
                    x: [0, -15, 0],
                    y: [0, 15, 0],
                    rotate: [0, -1, 0],
                }}
                transition={{
                    duration: 15,
                    repeat: Infinity,
                    ease: "easeInOut",
                }}
                className="absolute top-40 right-20 w-32 h-32 bg-gradient-to-br from-gray-200/10 to-gray-300/10 rounded-full blur-3xl"
            />
            <motion.div
                animate={{
                    x: [0, 10, 0],
                    y: [0, 20, 0],
                    rotate: [0, 3, 0],
                }}
                transition={{
                    duration: 18,
                    repeat: Infinity,
                    ease: "easeInOut",
                }}
                className="absolute bottom-20 left-1/2 w-24 h-24 bg-gradient-to-br from-gray-200/10 to-gray-300/10 rounded-full blur-3xl"
            />

            {/* Main Content */}
            <div className="relative z-10 flex items-center justify-center min-h-screen p-4">
                <div className="w-full max-w-md">
                    {/* Header */}
                    <motion.div
                        initial={{ y: -20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                        className="text-center mb-8"
                    >
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{
                                delay: 0.2,
                                type: "spring",
                                stiffness: 200,
                            }}
                            className="w-20 h-20 bg-gradient-to-br from-gray-900 to-gray-700 rounded-2xl mx-auto flex items-center justify-center mb-6 shadow-lg"
                        >
                            <Shield className="w-10 h-10 text-white" />
                        </motion.div>
                        <motion.h1
                            initial={{ y: 10, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.3, duration: 0.5 }}
                            className="text-3xl font-bold text-gray-900 mb-3"
                        >
                            Join Our Learning Community
                        </motion.h1>
                        <motion.p
                            initial={{ y: 10, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.4, duration: 0.5 }}
                            className="text-gray-600 text-lg leading-relaxed"
                        >
                            Start your educational journey with personalized learning experiences
                        </motion.p>
                        </motion.div>

                    {/* Dynamic Signup Container */}
                        <motion.div
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.5, duration: 0.6 }}
                        className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6"
                    >
                        {isLoading ? (
                            <div className="flex items-center justify-center p-8">
                                <div className="text-center">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
                                    <p className="text-gray-600">Loading signup options...</p>
                                </div>
                            </div>
                        ) : error ? (
                            <div className="text-center p-8">
                                <p className="text-red-600 mb-4">{error}</p>
                                <button
                                    onClick={() => window.location.reload()}
                                    className="text-blue-600 hover:text-blue-800 underline"
                                >
                                    Try again
                                </button>
                            </div>
                        ) : (
                            <ModularDynamicSignupContainer
                                instituteId={finalInstituteId}
                                settings={settings!}
                                onSignupSuccess={() => navigate({ to: "/dashboard" })}
                                onBackToProviders={() => navigate({ to: "/login" })}
                            />
                        )}
                            </motion.div>

                    {/* Footer Features */}
                            <motion.div
                        initial={{ y: 20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.7, duration: 0.6 }}
                        className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4"
                    >
                        <motion.div
                            whileHover={{ scale: 1.05 }}
                            className="flex flex-col items-center text-center p-4 bg-white/50 backdrop-blur-sm rounded-xl border border-gray-200/50"
                        >
                            <BookOpen className="w-6 h-6 text-gray-700 mb-2" />
                            <span className="text-sm font-medium text-gray-700">Access Courses</span>
                            </motion.div>
                        <motion.div
                            whileHover={{ scale: 1.05 }}
                            className="flex flex-col items-center text-center p-4 bg-white/50 backdrop-blur-sm rounded-xl border border-gray-200/50"
                        >
                            <Users className="w-6 h-6 text-gray-700 mb-2" />
                            <span className="text-sm font-medium text-gray-700">Join Community</span>
                        </motion.div>
                        <motion.div
                            whileHover={{ scale: 1.05 }}
                            className="flex flex-col items-center text-center p-4 bg-white/50 backdrop-blur-sm rounded-xl border border-gray-200/50"
                        >
                            <Award className="w-6 h-6 text-gray-700 mb-2" />
                            <span className="text-sm font-medium text-gray-700">Earn Certificates</span>
                        </motion.div>
                    </motion.div>

                    {/* Features Grid */}
                    <motion.div
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.8 }}
                        className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
                    >
                        {[
                            {
                                icon: BookOpen,
                                title: "Access Courses",
                                desc: "Browse and enroll in courses from top instructors"
                            },
                            {
                                icon: Users,
                                title: "Join Community",
                                desc: "Connect with fellow learners and mentors"
                            },
                            {
                                icon: Award,
                                title: "Earn Certificates",
                                desc: "Get recognized for your achievements"
                            }
                        ].map((feature, index) => (
                            <motion.div
                                key={feature.title}
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ delay: 0.6 + index * 0.05 }}
                                whileHover={{ scale: 1.02 }}
                                className="group p-3 rounded-md bg-white border border-gray-200 hover:bg-gray-50 transition-colors duration-200"
                            >
                                <feature.icon className="w-6 h-6 text-gray-700 mb-2 group-hover:scale-105 transition-transform duration-200" />
                                <h3 className="font-semibold text-gray-900 mb-1 text-sm">
                                    {feature.title}
                                </h3>
                                <p className="text-xs text-gray-600">
                                    {feature.desc}
                                </p>
                            </motion.div>
                        ))}




                        {/* Compact Trust Indicators */}

                        <motion.div

                            initial={{ y: 20, opacity: 0 }}

                            animate={{ y: 0, opacity: 1 }}

                            transition={{ delay: 0.8 }}

                            className="space-y-4"

                        >

                            <div className="flex items-center space-x-6 text-sm text-gray-500">

                                <div className="flex items-center space-x-2">

                                    <Shield className="w-4 h-4" />

                                    <span>ISO 27001 Certified</span>

                                </div>

                                <div className="flex items-center space-x-2">

                                    <Sparkles className="w-4 h-4" />

                                    <span>99.9% Uptime</span>

                                </div>

                            </div>

                            

                            {/* Social Proof */}

                            <div className="bg-white border border-gray-200 rounded-md p-4">

                                <div className="flex items-center space-x-2 mb-2">

                                    <div className="flex">

                                        {[1, 2, 3, 4, 5].map((star) => (

                                            <Star key={star} className="w-4 h-4 fill-yellow-400 text-yellow-400" />

                                        ))}

                                    </div>

                                    <span className="text-sm font-medium text-gray-700">4.9/5</span>

                                </div>

                                <p className="text-xs text-gray-600">

                                    "Amazing platform! The personalized learning experience is incredible."

                                </p>

                                <p className="text-xs text-gray-500 mt-1">- Sarah M., Student</p>

                            </div>

                        </motion.div>

                                         </motion.div>

                 </div>

                 {/* Right Side - Compact Sign Up Form */}

                <motion.div

                    initial={{ x: 50, opacity: 0 }}

                    animate={{ x: 0, opacity: 1 }}

                    transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}

                    className={`w-full ${type ? "p-4 bg-white" : "lg:w-1/2 xl:w-1/2  p-4 lg:p-6 xl:p-8 "}  flex items-center justify-center`}

                >

                    <div className="w-full max-w-lg xl:max-w-xl">

                        {/* Compact Sign Up Card */}

                        <motion.div

                            initial={{ y: 20, opacity: 0, scale: 0.98 }}

                            animate={{ y: 0, opacity: 1, scale: 1 }}

                            transition={{ delay: 0.3, duration: 0.4 }}

                            className={`bg-white rounded-md ${finalType ? "" : "shadow-md border border-gray-200 p-5 lg:p-6 xl:p-8"}  `}

                        >

                            {/* Header - Always show for consistent UX */}
                                <motion.div

                                    initial={{ y: 10, opacity: 0 }}

                                    animate={{ y: 0, opacity: 1 }}

                                    transition={{ delay: 0.5 }}

                                    className="text-center mb-6"

                                >

                                    <h2 className="text-xl lg:text-2xl font-bold text-gray-900 mb-2">

                                        Create Your Account

                                    </h2>

                                    <p className="text-gray-600 text-sm">

                                        Join our learning community and start your journey

                                    </p>

                                </motion.div>



                            {/* Form Content */}

                            <motion.div

                                initial={{ y: 10, opacity: 0 }}

                                animate={{ y: 0, opacity: 1 }}

                                transition={{ delay: 1.1 }}

                            >

                                {finalInstituteId && settings ? (
                                    <ModularDynamicSignupContainer
                                        type={finalType}
                                        courseId={finalCourseId}
                                        instituteId={finalInstituteId}
                                        settings={settings}
                                        onSwitchToLogin={() => navigate({ to: "/login" })}
                                    />
                                ) : (
                                    <div className="text-center py-8">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                                        <p className="text-gray-600">Loading signup options...</p>
                                    </div>
                                )}

                            </motion.div>



                            {/* Compact Security Notice */}

                            <motion.div

                                initial={{ y: 10, opacity: 0 }}

                                animate={{ y: 0, opacity: 1 }}

                                transition={{ delay: 1.3 }}

                                className="mt-6 p-3 bg-gray-50/80 border border-gray-200/60 rounded-md"

                            >

                                <div className="flex items-start space-x-2">

                                    <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />

                                    <div>

                                        <p className="text-xs font-medium text-gray-800 mb-1">

                                            Free to Start

                                        </p>

                                        <p className="text-xs text-gray-600">

                                            Create your account for free and explore our learning platform.

                                        </p>

                                    </div>

                                </div>

                            </motion.div>

                        </motion.div>



                        {/* Compact Footer Links */}

                        <motion.div

                            initial={{ y: 10, opacity: 0 }}

                            animate={{ y: 0, opacity: 1 }}

                            transition={{ delay: 1.5 }}

                            className="mt-6 text-center text-xs text-gray-600"

                        >

                            <p>

                                By creating an account, you agree to our{" "}

                                <motion.button

                                    whileHover={{ scale: 1.02 }}

                                    onClick={() =>

                                        navigate({

                                            to: "/terms-and-conditions",

                                        })

                                    }

                                    className="text-gray-800 hover:text-gray-900 font-medium underline cursor-pointer"

                                >

                                    Terms of Service

                                </motion.button>{" "}

                                and{" "}

                                <motion.button

                                    whileHover={{ scale: 1.02 }}

                                    onClick={() =>

                                        navigate({ to: "/privacy-policy" })

                                    }

                                    className="text-gray-800 hover:text-gray-900 font-medium underline cursor-pointer"

                                >

                                    Privacy Policy

                                </motion.button>

                            </p>

                        </motion.div>

                    </div>

                </motion.div>

            </div>

        </div>

    );

} 
