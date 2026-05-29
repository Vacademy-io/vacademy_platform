import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  InstituteBrandingComponent,
  type InstituteBranding,
} from "@/components/common/institute-branding";
import { useInstituteDetails } from "../live-class/-hooks/useInstituteDetails";
import { Clock, Lock, XCircle } from "@phosphor-icons/react";
import { motion } from "framer-motion";

const AssessmentClosedExpiredComponent = ({
  isExpired,
  assessmentName,
  isPrivate = false,
  externalBranding,
}: {
  isExpired: boolean;
  assessmentName: string;
  isPrivate?: boolean;
  externalBranding?: InstituteBranding | null;
}) => {
  const { data: instituteDetails } = useInstituteDetails();

  const branding: InstituteBranding = externalBranding || {
    instituteId: instituteDetails?.id || null,
    instituteName: instituteDetails?.institute_name || null,
    instituteLogoFileId: instituteDetails?.institute_logo_file_id || null,
    instituteThemeCode: null,
    homeIconClickRoute: instituteDetails?.homeIconClickRoute ?? null,
  };

  const config = isPrivate
    ? {
        Icon: Lock,
        iconBg: "bg-amber-50",
        iconColor: "text-amber-500",
        ringColor: "ring-amber-100",
        badgeVariant: "secondary" as const,
        badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
        badgeText: "Access Denied",
        title: "Assessment Access Denied",
        description: "You are not registered for this assessment.",
      }
    : isExpired
      ? {
          Icon: XCircle,
          iconBg: "bg-red-50",
          iconColor: "text-red-500",
          ringColor: "ring-red-100",
          badgeVariant: "destructive" as const,
          badgeClass: "bg-red-50 text-red-700 border-red-200",
          badgeText: "Expired",
          title: "Assessment Expired",
          description:
            "This assessment is no longer available. The window for taking this test has closed.",
        }
      : {
          Icon: Clock,
          iconBg: "bg-orange-50",
          iconColor: "text-orange-500",
          ringColor: "ring-orange-100",
          badgeVariant: "secondary" as const,
          badgeClass: "bg-orange-50 text-orange-700 border-orange-200",
          badgeText: "Closed",
          title: "Registration Closed",
          description:
            "Registration for this assessment has closed. Please contact your institute for more information.",
        };

  const { Icon } = config;

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100 p-4 sm:p-6">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-md"
      >
        <Card className="border-0 shadow-xl shadow-slate-200/60 overflow-hidden">
          {/* Header strip */}
          <div className="h-1.5 bg-gradient-to-r from-orange-400 via-red-400 to-pink-400" />

          <CardContent className="p-8 sm:p-10">
            {/* Branding */}
            <div className="flex flex-col items-center gap-3 mb-6">
              <InstituteBrandingComponent
                branding={branding}
                size="medium"
                showName={false}
              />
              {branding.instituteName && (
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                  {branding.instituteName}
                </p>
              )}
            </div>

            {/* Icon */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="flex justify-center mb-6"
            >
              <div
                className={`relative w-20 h-20 rounded-full ${config.iconBg} flex items-center justify-center ring-8 ${config.ringColor}`}
              >
                <Icon
                  className={`w-10 h-10 ${config.iconColor}`}
                  strokeWidth={2}
                />
              </div>
            </motion.div>

            {/* Status badge */}
            <div className="flex justify-center mb-4">
              <Badge
                variant={config.badgeVariant}
                className={`${config.badgeClass} font-medium px-3 py-1`}
              >
                {config.badgeText}
              </Badge>
            </div>

            {/* Title & description */}
            <div className="text-center space-y-3 mb-6">
              <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
                {config.title}
              </h1>
              <p className="text-sm text-slate-600 leading-relaxed">
                {config.description}
              </p>
            </div>

            {/* Assessment name */}
            <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3">
              <p className="text-caption font-medium text-slate-500 uppercase tracking-wider mb-1">
                Assessment
              </p>
              <p className="text-sm font-medium text-slate-900 truncate">
                {assessmentName}
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default AssessmentClosedExpiredComponent;
