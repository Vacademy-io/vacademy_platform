import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem } from "@/components/ui/form";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "@tanstack/react-router";
import { FcGoogle } from "react-icons/fc";
import { GitHubLogoIcon } from "@radix-ui/react-icons";
import { LOGIN_URL_GOOGLE_GITHUB } from "@/constants/urls";
import { 
    Building2,
    Mail,
    User,
    CheckCircle,
    ChevronDown,
    Search,
    ArrowRight,
} from "lucide-react";
import { MyInput } from "@/components/design-system/input";

const instituteSelectionSchema = z.object({
    instituteId: z.string().min(1, "Please select an institute"),
});

const userDetailsSchema = z.object({
    email: z.string().email("Please enter a valid email address"),
    fullName: z.string().min(2, "Full name must be at least 2 characters"),
    username: z.string().min(3, "Username must be at least 3 characters"),
});

type InstituteSelectionValues = z.infer<typeof instituteSelectionSchema>;
type UserDetailsValues = z.infer<typeof userDetailsSchema>;

interface Institute {
    id: string;
    name: string;
    location: string;
    type: string;
}

interface InstituteSignUpProps {
    type?: string;
    courseId?: string;
    onSwitchToLogin?: () => void;
}

export function InstituteSignUp({
    type,
    courseId,
    onSwitchToLogin,
}: InstituteSignUpProps) {
    const navigate = useNavigate();
    const [currentStep, setCurrentStep] = useState<"selection" | "details">("selection");
    const [selectedInstitute, setSelectedInstitute] = useState<Institute | null>(null);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    // Mock institutes data
    const institutes: Institute[] = [
        { id: "1", name: "Harvard University", location: "Cambridge, MA", type: "University" },
        { id: "2", name: "MIT", location: "Cambridge, MA", type: "University" },
        { id: "3", name: "Stanford University", location: "Stanford, CA", type: "University" },
        { id: "4", name: "Code Academy", location: "New York, NY", type: "Coding Bootcamp" },
        { id: "5", name: "Tech Institute", location: "San Francisco, CA", type: "Technical School" },
        { id: "6", name: "University of California, Berkeley", location: "Berkeley, CA", type: "University" },
        { id: "7", name: "General Assembly", location: "New York, NY", type: "Coding Bootcamp" },
        { id: "8", name: "Flatiron School", location: "New York, NY", type: "Coding Bootcamp" },
        { id: "9", name: "Community College", location: "Local, Various", type: "Community College" },
        { id: "10", name: "Online Learning Platform", location: "Remote", type: "Online Platform" },
    ];

    // Filter institutes based on search query
    const filteredInstitutes = useMemo(() => {
        if (!searchQuery.trim()) return institutes;
        
        const query = searchQuery.toLowerCase();
        return institutes.filter(institute => 
            institute.name.toLowerCase().includes(query) ||
            institute.location.toLowerCase().includes(query) ||
            institute.type.toLowerCase().includes(query)
        );
    }, [searchQuery, institutes]);

    const instituteSelectionForm = useForm<InstituteSelectionValues>({
        resolver: zodResolver(instituteSelectionSchema),
        defaultValues: {
            instituteId: "",
        },
    });

    const userDetailsForm = useForm<UserDetailsValues>({
        resolver: zodResolver(userDetailsSchema),
        defaultValues: {
            email: "",
            fullName: "",
            username: "",
        },
    });

    const handleInstituteSelect = (institute: Institute) => {
        setSelectedInstitute(institute);
        instituteSelectionForm.setValue("instituteId", institute.id);
        setIsDropdownOpen(false);
        setSearchQuery(""); // Clear search when institute is selected
        setCurrentStep("details");
    };

    const handleDropdownToggle = () => {
        setIsDropdownOpen(!isDropdownOpen);
        if (!isDropdownOpen) {
            setSearchQuery(""); // Clear search when opening dropdown
        }
    };

    const handleUserDetailsSubmit = async (data: UserDetailsValues) => {
        if (!selectedInstitute) {
            toast.error("Please select an institute first");
            return;
        }

        try {
            // Simulate API call for user registration
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            toast.success("Account created successfully!");
            console.log("Registration data:", {
                institute: selectedInstitute,
                userDetails: data,
                type,
                courseId,
            });
            
            // Navigate to dashboard or next step
            navigate({ to: "/dashboard" });
        } catch (error) {
            toast.error("Registration failed. Please try again.");
        }
    };

    const handleBackToSelection = () => {
        setCurrentStep("selection");
        setSelectedInstitute(null);
        instituteSelectionForm.reset();
    };

    const handleOAuthSignUp = (provider: "google" | "github") => {
        if (!selectedInstitute) {
            toast.error("Please select an institute first");
            return;
        }

        try {
            const stateObj = {
                from: `${window.location.origin}/signup/oauth/learner`,
                account_type: "signup",
                institute_id: selectedInstitute.id,
                institute_name: selectedInstitute.name,
            };

            const base64State = btoa(JSON.stringify(stateObj));
            const signupUrl = `${LOGIN_URL_GOOGLE_GITHUB}/${provider}?state=${encodeURIComponent(
                base64State
            )}`;
            window.location.href = signupUrl;
        } catch {
            toast.error("Failed to initiate signup. Please try again.");
        }
    };

    return (
        <div className="space-y-4">
            <AnimatePresence mode="wait">
                {currentStep === "selection" ? (
                    <motion.div
                        key="selection"
                        initial={{ opacity: 0, x: -30 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 30 }}
                        transition={{ duration: 0.3 }}
                        className="space-y-4"
                    >
                        {/* Institute Selection Header */}
                        <motion.div
                            initial={{ y: 10, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.1 }}
                            className="text-center space-y-3"
                        >
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{
                                    delay: 0.2,
                                    type: "spring",
                                    stiffness: 200,
                                }}
                                className="w-12 h-12 bg-gray-100 rounded-xl mx-auto flex items-center justify-center"
                            >
                                <Building2 className="w-6 h-6 text-gray-700" />
                            </motion.div>
                            <div className="space-y-1">
                                <h3 className="text-lg font-semibold text-gray-900">
                                    Select Your Institute
                                </h3>
                                <p className="text-sm text-gray-600">
                                    Choose your educational institution from the list below
                                </p>
                            </div>
                        </motion.div>

                        {/* Institute Dropdown */}
                        <motion.div
                            initial={{ y: 10, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.3 }}
                            className="space-y-4"
                        >
                            <div className="relative">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Institute <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    {isDropdownOpen ? (
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 z-10" />
                                            <input
                                                type="text"
                                                placeholder="Search institutes..."
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                className="w-full pl-10 pr-10 py-3 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all duration-200"
                                                autoFocus
                                            />
                                            <button
                                                type="button"
                                                onClick={handleDropdownToggle}
                                                className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-100 rounded transition-colors duration-200"
                                            >
                                                <ChevronDown className="w-4 h-4 text-gray-400 rotate-180" />
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={handleDropdownToggle}
                                            className="w-full p-3 text-left bg-white border border-gray-200 rounded-lg hover:border-gray-300 focus:border-gray-900 focus:outline-none transition-all duration-200 flex items-center justify-between"
                                        >
                                            <span className={selectedInstitute ? "text-gray-900" : "text-gray-500"}>
                                                {selectedInstitute ? selectedInstitute.name : "Select an institute..."}
                                            </span>
                                            <ChevronDown className="w-4 h-4 text-gray-400 transition-transform duration-200" />
                                        </button>
                                    )}
                                </div>

                                {/* Dropdown Options */}
                                {isDropdownOpen && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto"
                                    >
                                        {filteredInstitutes.length > 0 ? (
                                            filteredInstitutes.map((institute) => (
                                                <button
                                                    key={institute.id}
                                                    type="button"
                                                    onClick={() => handleInstituteSelect(institute)}
                                                    className="w-full p-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0 transition-colors duration-200"
                                                >
                                                    <div>
                                                        <h5 className="font-medium text-gray-900 text-sm">
                                                            {institute.name}
                                                        </h5>
                                                        <p className="text-xs text-gray-600">
                                                            {institute.location} • {institute.type}
                                                        </p>
                                                    </div>
                                                </button>
                                            ))
                                        ) : (
                                            <div className="p-4 text-center text-gray-500 text-sm">
                                                No institutes found matching "{searchQuery}"
                                            </div>
                                        )}
                                    </motion.div>
                                )}
                            </div>

                            {/* Continue Button */}
                            {selectedInstitute && (
                                <motion.button
                                    type="button"
                                    onClick={() => setCurrentStep("details")}
                                    whileHover={{ scale: 1.01 }}
                                    whileTap={{ scale: 0.99 }}
                                    className="w-full bg-gray-900 hover:bg-black text-white font-medium py-3 px-4 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md"
                                >
                                    <div className="flex items-center justify-center space-x-2">
                                        <CheckCircle className="w-4 h-4" />
                                        <span className="text-sm">Continue</span>
                                    </div>
                                </motion.button>
                            )}
                        </motion.div>
                    </motion.div>
                ) : (
                    <motion.div
                        key="details"
                        initial={{ opacity: 0, x: 30 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -30 }}
                        transition={{ duration: 0.3 }}
                        className="space-y-6"
                    >
                        {/* Selected Institute Display */}
                        <motion.div
                            initial={{ y: 10, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.1 }}
                            className="p-4 bg-green-50 border border-green-200 rounded-lg"
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                    <Building2 className="w-5 h-5 text-green-600" />
                                    <div>
                                        <h4 className="font-medium text-green-900 text-sm">
                                            {selectedInstitute?.name}
                                        </h4>
                                        <p className="text-xs text-green-700">
                                            {selectedInstitute?.location} • {selectedInstitute?.type}
                                        </p>
                                    </div>
                                </div>
                                <motion.button
                                    type="button"
                                    whileHover={{ scale: 1.05 }}
                                    onClick={handleBackToSelection}
                                    className="text-xs text-green-700 hover:text-green-900 font-medium underline"
                                >
                                    Change
                                </motion.button>
                            </div>
                        </motion.div>

                        {/* OAuth Buttons */}
                        <motion.div
                            initial={{ y: 10, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.2 }}
                            className="space-y-2 mb-6"
                        >
                            <motion.button
                                whileHover={{ scale: 1.01 }}
                                whileTap={{ scale: 0.99 }}
                                className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-200 rounded-lg bg-white/80 backdrop-blur-sm text-gray-700 font-medium hover:bg-white hover:border-gray-300 hover:shadow-md transition-all duration-200 group"
                                onClick={() => handleOAuthSignUp("google")}
                                type="button"
                            >
                                <FcGoogle className="w-4 h-4" />
                                <span className="text-sm">
                                    Continue with Google
                                </span>
                                <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                            </motion.button>
                            <motion.button
                                whileHover={{ scale: 1.01 }}
                                whileTap={{ scale: 0.99 }}
                                className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-200 rounded-lg bg-white/80 backdrop-blur-sm text-gray-700 font-medium hover:bg-white hover:border-gray-300 hover:shadow-md transition-all duration-200 group"
                                onClick={() => handleOAuthSignUp("github")}
                                type="button"
                            >
                                <GitHubLogoIcon className="w-4 h-4" />
                                <span className="text-sm">
                                    Continue with GitHub
                                </span>
                                <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                            </motion.button>
                        </motion.div>

                        {/* Divider */}
                        <motion.div
                            initial={{ width: 0, opacity: 0 }}
                            animate={{ width: "100%", opacity: 1 }}
                            transition={{ delay: 0.4, duration: 0.3 }}
                            className="relative my-5"
                        >
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-gray-200" />
                            </div>
                            <div className="relative flex justify-center text-xs">
                                <span className="bg-white px-3 py-1 text-gray-500 font-medium rounded-full border border-gray-200">
                                    or continue with email
                                </span>
                            </div>
                        </motion.div>

                        {/* User Details Form */}
                        <motion.div
                            initial={{ y: 10, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.6 }}
                        >
                            <Form {...userDetailsForm}>
                                <form onSubmit={userDetailsForm.handleSubmit(handleUserDetailsSubmit)} className="space-y-4">
                                    {/* Email Field */}
                                    <FormField
                                        control={userDetailsForm.control}
                                        name="email"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormControl>
                                                    <div className="relative">
                                                        <MyInput
                                                            inputType="email"
                                                            inputPlaceholder="Enter your email address"
                                                            label="Email Address"
                                                            required
                                                            size="large"
                                                            error={
                                                                userDetailsForm.formState.errors.email?.message
                                                            }
                                                            {...field}
                                                            className="w-full transition-all duration-200 border-gray-200 focus:border-gray-300 focus:ring-0 focus-visible:ring-0 rounded-lg bg-gray-50/50 focus:bg-white hover:bg-white font-normal pr-10"
                                                            input={field.value}
                                                            onChangeFunction={field.onChange}
                                                        />
                                                        <Mail className="absolute right-3 bottom-3 w-4 h-4 text-gray-400" />
                                                    </div>
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />

                                    {/* Full Name Field */}
                                    <FormField
                                        control={userDetailsForm.control}
                                        name="fullName"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormControl>
                                                    <div className="relative">
                                                        <MyInput
                                                            inputType="text"
                                                            inputPlaceholder="Enter your full name"
                                                            label="Full Name"
                                                            required
                                                            size="large"
                                                            error={
                                                                userDetailsForm.formState.errors.fullName?.message
                                                            }
                                                            {...field}
                                                            className="w-full transition-all duration-200 border-gray-200 focus:border-gray-300 focus:ring-0 focus-visible:ring-0 rounded-lg bg-gray-50/50 focus:bg-white hover:bg-white font-normal pr-10"
                                                            input={field.value}
                                                            onChangeFunction={field.onChange}
                                                        />
                                                        <User className="absolute right-3 bottom-3 w-4 h-4 text-gray-400" />
                                                    </div>
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />

                                    {/* Username Field */}
                                    <FormField
                                        control={userDetailsForm.control}
                                        name="username"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormControl>
                                                    <div className="relative">
                                                        <MyInput
                                                            inputType="text"
                                                            inputPlaceholder="Choose a username"
                                                            label="Username"
                                                            required
                                                            size="large"
                                                            error={
                                                                userDetailsForm.formState.errors.username?.message
                                                            }
                                                            {...field}
                                                            className="w-full transition-all duration-200 border-gray-200 focus:border-gray-300 focus:ring-0 focus-visible:ring-0 rounded-lg bg-gray-50/50 focus:bg-white hover:bg-white font-normal pr-10"
                                                            input={field.value}
                                                            onChangeFunction={field.onChange}
                                                        />
                                                        <User className="absolute right-3 bottom-3 w-4 h-4 text-gray-400" />
                                                    </div>
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />

                                    {/* Create Account Button */}
                                    <motion.button
                                        type="submit"
                                        whileHover={{ scale: 1.01 }}
                                        whileTap={{ scale: 0.99 }}
                                        className="w-full bg-gray-900 hover:bg-black text-white font-medium py-3 px-4 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md"
                                    >
                                        <div className="flex items-center justify-center space-x-2">
                                            <CheckCircle className="w-4 h-4" />
                                            <span className="text-sm">Create Account</span>
                                        </div>
                                    </motion.button>
                                </form>
                            </Form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Sign In Link */}
            <motion.div
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="text-center pt-3"
            >
                <div className="text-xs text-gray-500">
                    Already have an account?{" "}
                    <motion.button
                        type="button"
                        whileHover={{ scale: 1.02 }}
                        onClick={onSwitchToLogin || (() => navigate({ to: "/login" }))}
                        className="text-gray-700 hover:text-gray-900 font-medium underline cursor-pointer"
                    >
                        Sign in here
                    </motion.button>
                </div>
            </motion.div>
        </div>
    );
} 