import { useNavigate } from "@tanstack/react-router";
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
import { InstituteSignUp } from "./InstituteSignUpForm";

export function SignUpForm({
    type,
    courseId,
}: {
    type?: string;
    courseId?: string;
}) {
    const navigate = useNavigate();



    return (
        <div
            className={`${type ? "h-[400px] overflow-auto" : "min-h-screen overflow-hidden"}  bg-gray-50 relative `}
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
                    x: [0, -20, 0],
                    y: [0, 10, 0],
                    rotate: [0, -2, 0],
                }}
                transition={{
                    duration: 15,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: 3,
                }}
                className="absolute bottom-20 right-20 w-64 h-64 bg-gradient-to-br from-gray-300/10 to-gray-400/10 rounded-full blur-3xl"
            />

            <div className="flex min-h-screen">
                {/* Left Side - Compact Branding & Features */}
                {!type && (
                    <motion.div
                        initial={{ x: -50, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                        className="hidden lg:flex lg:w-1/2 xl:w-1/2 flex-col justify-center px-8 xl:px-16"
                    >
                        {/* Compact Main Heading */}
                        <motion.div
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.2 }}
                            className="mb-8"
                        >
                            <h1 className="text-4xl xl:text-5xl font-bold text-gray-900 mb-4 leading-tight">
                                Start Your
                                <span className="bg-gradient-to-r from-gray-700 to-gray-900 bg-clip-text text-transparent">
                                    {" "}
                                    Learning
                                </span>
                                <br />
                                Journey Today
                            </h1>
                            <p className="text-lg text-gray-600 leading-relaxed max-w-lg">
                                Join thousands of learners and unlock personalized educational experiences designed for your success.
                            </p>
                        </motion.div>

                        {/* Compact Features Grid */}
                        <motion.div
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.4 }}
                            className="grid grid-cols-2 gap-4 mb-8"
                        >
                            {[
                                {
                                    icon: BookOpen,
                                    title: "Personalized Learning",
                                    desc: "AI-driven content recommendations",
                                },
                                {
                                    icon: Users,
                                    title: "Expert Instructors",
                                    desc: "Learn from industry professionals",
                                },
                                {
                                    icon: Award,
                                    title: "Certified Programs",
                                    desc: "Earn recognized credentials",
                                },
                                {
                                    icon: Shield,
                                    title: "Secure & Private",
                                    desc: "Your data is always protected",
                                },
                            ].map((feature, index) => (
                                <motion.div
                                    key={feature.title}
                                    initial={{ scale: 0.9, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    transition={{ delay: 0.6 + index * 0.05 }}
                                    whileHover={{ scale: 1.02 }}
                                    className="group p-3 rounded-lg bg-white/60 backdrop-blur-sm border border-gray-200/50 hover:bg-white/80 transition-all duration-200"
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
                        </motion.div>

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
                            <div className="bg-white/60 backdrop-blur-sm border border-gray-200/50 rounded-lg p-4">
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
                )}

                {/* Right Side - Compact Sign Up Form */}
                <motion.div
                    initial={{ x: 50, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
                    className={`w-full ${type ? "p-4 bg-white" : "lg:w-1/2 xl:w-1/2  p-4 lg:p-8 xl:p-12 "}  flex items-center justify-center`}
                >
                    <div className="w-full max-w-lg xl:max-w-xl">
                        {/* Compact Sign Up Card */}
                        <motion.div
                            initial={{ y: 20, opacity: 0, scale: 0.98 }}
                            animate={{ y: 0, opacity: 1, scale: 1 }}
                            transition={{ delay: 0.3, duration: 0.4 }}
                            className={`bg-white/90 backdrop-blur-xl rounded-xl ${type ? "" : "shadow-xl border border-gray-200/50 p-6 lg:p-8 xl:p-10"}  `}
                        >
                            {/* Compact Header */}
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
                                <InstituteSignUp
                                    type={type}
                                    courseId={courseId}
                                />
                            </motion.div>

                            {/* Compact Security Notice */}
                            <motion.div
                                initial={{ y: 10, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: 1.3 }}
                                className="mt-6 p-3 bg-gray-50/80 border border-gray-200/60 rounded-lg"
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