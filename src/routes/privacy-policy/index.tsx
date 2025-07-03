import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Shield, ArrowLeft, Eye, Lock, Database, Users, Globe, Mail } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy-policy/")({
  component: PrivacyPolicy,
});

function PrivacyPolicy() {
  const navigate = useNavigate();

  const sections = [
    {
      id: "information-we-collect",
      title: "Information We Collect",
      icon: Database,
      content: [
        {
          subtitle: "Personal Information",
          text: "We collect information you provide directly to us, such as when you create an account, enroll in courses, or contact us. This may include your name, email address, phone number, educational background, and payment information."
        },
        {
          subtitle: "Learning Data",
          text: "We collect information about your learning activities, including course progress, assessment scores, time spent on materials, and interaction patterns to personalize your learning experience."
        },
        {
          subtitle: "Technical Information",
          text: "We automatically collect certain technical information about your device and how you interact with our platform, including IP address, browser type, operating system, and usage analytics."
        }
      ]
    },
    {
      id: "how-we-use-information",
      title: "How We Use Your Information",
      icon: Eye,
      content: [
        {
          subtitle: "Educational Services",
          text: "We use your information to provide, maintain, and improve our educational services, including delivering course content, tracking progress, and providing certifications."
        },
        {
          subtitle: "Personalization",
          text: "We analyze your learning patterns to recommend relevant courses, customize content delivery, and optimize your learning experience."
        },
        {
          subtitle: "Communication",
          text: "We may use your contact information to send you important updates about your courses, platform changes, and educational opportunities that may interest you."
        }
      ]
    },
    {
      id: "information-sharing",
      title: "Information Sharing and Disclosure",
      icon: Users,
      content: [
        {
          subtitle: "Educational Partners",
          text: "We may share your learning progress and achievements with educational institutions or employers as authorized by you or required for certification purposes."
        },
        {
          subtitle: "Service Providers",
          text: "We may share information with trusted third-party service providers who assist us in operating our platform, conducting business, or serving our users."
        },
        {
          subtitle: "Legal Requirements",
          text: "We may disclose your information when required by law, regulation, legal process, or governmental request, or to protect the rights, property, or safety of Vacademy, our users, or others."
        }
      ]
    },
    {
      id: "data-security",
      title: "Data Security",
      icon: Lock,
      content: [
        {
          subtitle: "Security Measures",
          text: "We implement appropriate technical and organizational security measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction."
        },
        {
          subtitle: "Encryption",
          text: "We use industry-standard encryption protocols to protect sensitive data during transmission and storage, including SSL/TLS encryption for all data transfers."
        },
        {
          subtitle: "Access Controls",
          text: "We maintain strict access controls and regularly audit our systems to ensure that only authorized personnel can access your personal information."
        }
      ]
    },
    {
      id: "your-rights",
      title: "Your Rights and Choices",
      icon: Shield,
      content: [
        {
          subtitle: "Access and Correction",
          text: "You have the right to access, update, or correct your personal information at any time through your account settings or by contacting us directly."
        },
        {
          subtitle: "Data Portability",
          text: "You may request a copy of your personal information in a structured, commonly used, and machine-readable format for transfer to another service."
        },
        {
          subtitle: "Deletion",
          text: "You may request deletion of your personal information, subject to certain exceptions where we may need to retain information for legal or legitimate business purposes."
        }
      ]
    },
    {
      id: "international-transfers",
      title: "International Data Transfers",
      icon: Globe,
      content: [
        {
          subtitle: "Global Operations",
          text: "Vacademy operates globally, and your information may be transferred to and processed in countries other than your country of residence, including countries that may have different data protection laws."
        },
        {
          subtitle: "Safeguards",
          text: "When we transfer your information internationally, we implement appropriate safeguards to ensure your information receives adequate protection, including standard contractual clauses and adequacy decisions."
        }
      ]
    }
  ];

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
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              Privacy Policy
            </h1>
            <p className="text-gray-600 text-lg max-w-2xl mx-auto">
              Your privacy is important to us. This policy explains how Vacademy collects, uses, and protects your personal information.
            </p>
            <p className="text-sm text-gray-500 mt-4">
              Last updated: January 2024
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
          <h2 className="text-xl font-bold text-gray-900 mb-4">Introduction</h2>
          <p className="text-gray-700 leading-relaxed">
            Welcome to Vacademy. We are committed to protecting your privacy and ensuring the security of your personal information. 
            This Privacy Policy describes how we collect, use, disclose, and safeguard your information when you use our educational platform. 
            By using our services, you agree to the collection and use of information in accordance with this policy.
          </p>
        </motion.div>

        {/* Sections */}
        <div className="space-y-6">
          {sections.map((section, index) => (
            <motion.div
              key={section.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + index * 0.1 }}
              className="bg-white/90 backdrop-blur-xl rounded-xl shadow-xl border border-gray-200/50 p-6 lg:p-8"
            >
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-10 h-10 bg-gray-900 rounded-lg flex items-center justify-center">
                  <section.icon className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">{section.title}</h2>
              </div>
              
              <div className="space-y-4">
                {section.content.map((item, itemIndex) => (
                  <div key={itemIndex}>
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">{item.subtitle}</h3>
                    <p className="text-gray-700 leading-relaxed">{item.text}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Contact Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="bg-white/90 backdrop-blur-xl rounded-xl shadow-xl border border-gray-200/50 p-6 lg:p-8 mt-8"
        >
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-10 h-10 bg-gray-900 rounded-lg flex items-center justify-center">
              <Mail className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Contact Us</h2>
          </div>
          
          <p className="text-gray-700 leading-relaxed mb-4">
            If you have any questions about this Privacy Policy or our data practices, please contact us:
          </p>
          
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h3 className="font-semibold text-gray-800 mb-2">Email</h3>
              <p className="text-gray-600">privacy@vacademy.com</p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-800 mb-2">Address</h3>
              <p className="text-gray-600">
                Vacademy Educational Services<br />
                123 Learning Street<br />
                Education City, EC 12345
              </p>
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
          <p className="text-sm text-gray-500">
            This privacy policy is effective as of January 2024 and will remain in effect except with respect to any changes in its provisions in the future.
          </p>
        </motion.div>
      </div>
    </div>
  );
} 