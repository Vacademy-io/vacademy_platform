import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { FileText, ArrowLeft, Users, CreditCard, Shield, AlertCircle, Scale, BookOpen, RefreshCw } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/terms-and-conditions/")({
  component: TermsAndConditions,
});

function TermsAndConditions() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 relative overflow-hidden">
      {/* Subtle Background Pattern */}
      <div className="absolute inset-0 bg-grid-gray-100 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] -z-10" />
      
      {/* Subtle Floating Background Elements */}
      <motion.div 
        animate={{ 
          x: [0, 20, 0],
          y: [0, -10, 0],
          rotate: [0, 2, 0] 
        }}
        transition={{ 
          duration: 12,
          repeat: Infinity,
          ease: "easeInOut" 
        }}
        className="absolute top-20 left-20 w-48 h-48 bg-gradient-to-br from-gray-200/10 to-gray-300/10 rounded-full blur-3xl"
      />

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-8"
        >
          {/* Back Button */}
          <motion.button
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            onClick={() => navigate({ to: "/login" })}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-800 transition-colors duration-200 mb-6 group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform duration-200" />
            <span className="text-sm font-medium">Back to Login</span>
          </motion.button>

          {/* Page Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gray-900 rounded-xl mx-auto flex items-center justify-center mb-4">
              <FileText className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              Terms and Conditions
            </h1>
            <p className="text-gray-600 text-lg max-w-2xl mx-auto">
              Please read these terms and conditions carefully before using the Vacademy educational platform.
            </p>
            <p className="text-sm text-gray-500 mt-4">
              Effective Date: January 2024
            </p>
          </div>
        </motion.div>

        {/* Introduction */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white/90 backdrop-blur-xl rounded-xl shadow-xl border border-gray-200/50 p-6 lg:p-8 mb-8"
        >
          <h2 className="text-xl font-bold text-gray-900 mb-4">Welcome to Vacademy</h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            These Terms and Conditions ("Terms", "Terms and Conditions") govern your relationship with the Vacademy educational platform 
            operated by Vacademy Educational Services ("us", "we", or "our").
          </p>
          <p className="text-gray-700 leading-relaxed">
            Your access to and use of the service is conditioned on your acceptance of and compliance with these Terms. 
            These Terms apply to all visitors, users, and others who access or use the service.
          </p>
        </motion.div>

        {/* Terms Sections */}
        <div className="space-y-6">
          {/* Acceptance of Terms */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white/90 backdrop-blur-xl rounded-xl shadow-xl border border-gray-200/50 p-6 lg:p-8"
          >
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-10 h-10 bg-gray-900 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Acceptance of Terms</h2>
            </div>
            
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Agreement to Terms</h3>
                <p className="text-gray-700 leading-relaxed">
                  By accessing and using Vacademy's educational platform, you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Modifications</h3>
                <p className="text-gray-700 leading-relaxed">
                  Vacademy reserves the right to change these terms and conditions at any time. Users will be notified of significant changes, and continued use of the platform constitutes acceptance of modified terms.
                </p>
              </div>
            </div>
          </motion.div>

          {/* User Accounts */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white/90 backdrop-blur-xl rounded-xl shadow-xl border border-gray-200/50 p-6 lg:p-8"
          >
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-10 h-10 bg-gray-900 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">User Accounts and Registration</h2>
            </div>
            
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Account Creation</h3>
                <p className="text-gray-700 leading-relaxed">
                  To access certain features of our platform, you must register for an account. You agree to provide accurate, current, and complete information during the registration process and to update such information to keep it accurate, current, and complete.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Account Security</h3>
                <p className="text-gray-700 leading-relaxed">
                  You are responsible for safeguarding the password and for all activities that occur under your account. You agree to immediately notify Vacademy of any unauthorized use of your account or any other breach of security.
                </p>
              </div>
            </div>
          </motion.div>

          {/* Educational Services */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-white/90 backdrop-blur-xl rounded-xl shadow-xl border border-gray-200/50 p-6 lg:p-8"
          >
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-10 h-10 bg-gray-900 rounded-lg flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Educational Services and Content</h2>
            </div>
            
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Course Access</h3>
                <p className="text-gray-700 leading-relaxed">
                  Upon enrollment and payment, you will receive access to course materials for the duration specified in your enrollment agreement. Access may be limited by time, device, or other restrictions as specified in the course description.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Learning Materials</h3>
                <p className="text-gray-700 leading-relaxed">
                  All course materials, including videos, documents, assessments, and other content, are provided for educational purposes only. You may not redistribute, reproduce, or share these materials without explicit permission.
                </p>
              </div>
            </div>
          </motion.div>

          {/* Payment Terms */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="bg-white/90 backdrop-blur-xl rounded-xl shadow-xl border border-gray-200/50 p-6 lg:p-8"
          >
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-10 h-10 bg-gray-900 rounded-lg flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Payment Terms and Refunds</h2>
            </div>
            
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Payment Processing</h3>
                <p className="text-gray-700 leading-relaxed">
                  All payments are processed securely through our approved payment processors. You agree to provide accurate payment information and authorize us to charge the specified amounts for your selected courses or services.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Refund Policy</h3>
                <p className="text-gray-700 leading-relaxed">
                  Refunds are available within 30 days of course enrollment, provided that less than 25% of the course content has been accessed. Refund requests must be submitted through our official channels and may take 5-10 business days to process.
                </p>
              </div>
            </div>
          </motion.div>

          {/* User Conduct */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="bg-white/90 backdrop-blur-xl rounded-xl shadow-xl border border-gray-200/50 p-6 lg:p-8"
          >
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-10 h-10 bg-gray-900 rounded-lg flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">User Conduct and Prohibited Activities</h2>
            </div>
            
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Acceptable Use</h3>
                <p className="text-gray-700 leading-relaxed">
                  You agree to use the platform only for lawful educational purposes and in a manner that does not infringe upon the rights of others or restrict or inhibit their use and enjoyment of the platform.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Prohibited Activities</h3>
                <p className="text-gray-700 leading-relaxed">
                  You may not: share account credentials, attempt to gain unauthorized access to the platform, upload malicious software, engage in academic dishonesty, harass other users, or use the platform for any commercial purpose without authorization.
                </p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Contact Information */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="bg-white/90 backdrop-blur-xl rounded-xl shadow-xl border border-gray-200/50 p-6 lg:p-8 mt-8"
        >
          <h2 className="text-xl font-bold text-gray-900 mb-4">Contact Information</h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            If you have any questions about these Terms and Conditions, please contact us:
          </p>
          
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h3 className="font-semibold text-gray-800 mb-2">Legal Department</h3>
              <p className="text-gray-600">legal@vacademy.com</p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-800 mb-2">General Support</h3>
              <p className="text-gray-600">support@vacademy.com</p>
            </div>
          </div>
        </motion.div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.0 }}
          className="text-center mt-12 mb-8"
        >
          <p className="text-sm text-gray-500 mb-2">
            These terms and conditions are effective as of January 2024.
          </p>
          <p className="text-xs text-gray-400">
            By using Vacademy, you acknowledge that you have read, understood, and agree to be bound by these Terms and Conditions.
          </p>
        </motion.div>
      </div>
    </div>
  );
} 