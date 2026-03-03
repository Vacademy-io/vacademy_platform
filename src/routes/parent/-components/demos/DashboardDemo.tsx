// Dashboard demo — props-driven (no API)
import { motion } from "framer-motion";
import type { ChildProfile, AdmissionOverview } from "@/types/parent-portal";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CheckCircle,
  Clock,
  ClipboardList,
  CalendarCheck,
  DollarSign,
  FileText,
  ArrowRight,
  Info,
} from "lucide-react";

type TabId =
  | "dashboard"
  | "registration"
  | "schedule"
  | "admission"
  | "documents"
  | "payments"
  | "tracker";
interface Props {
  child: ChildProfile;
  overview: AdmissionOverview;
  onNavigate: (tab: TabId) => void;
}

export function ParentDashboardDemo({ child, overview, onNavigate }: Props) {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto w-full space-y-6 pb-20 lg:pb-8">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">
            {child.full_name}&apos;s Admission
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {child.grade_applying
              ? `Applying for ${child.grade_applying}`
              : "Admission in progress"}
            {child.academic_year ? ` • ${child.academic_year}` : ""}
          </p>
        </div>
        <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 self-start text-xs font-medium px-3 py-1">
          Registration In Progress
        </Badge>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
      >
        <Card className="border-l-4 border-l-yellow-500 shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-900/30 shrink-0 mt-0.5">
                <ClipboardList size={20} className="text-yellow-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-foreground">
                  Continue Registration
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  You have a draft registration. Continue filling the form and
                  submit when ready.
                </p>
                <Button
                  size="sm"
                  onClick={() => onNavigate("registration")}
                  className="mt-3 h-8 text-xs rounded-lg gap-1.5"
                >
                  Continue
                  <ArrowRight size={12} />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Admission Progress</CardTitle>
            <CardDescription className="text-xs">
              Track each step of the journey
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ProgressSteps currentStatus={child.admission_status} />
          </CardContent>
        </Card>
      </motion.div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          {
            id: "registration" as TabId,
            icon: ClipboardList,
            label: "Registration",
            desc: "Form & payment",
            color: "text-blue-600 dark:text-blue-400",
            bg: "bg-blue-50 dark:bg-blue-950/30",
            d: 0.15,
          },
          {
            id: "schedule" as TabId,
            icon: CalendarCheck,
            label: "Interviews & Tests",
            desc: "Schedule & results",
            color: "text-violet-600 dark:text-violet-400",
            bg: "bg-violet-50 dark:bg-violet-950/30",
            d: 0.2,
          },
          {
            id: "admission" as TabId,
            icon: FileText,
            label: "Admission Form",
            desc: "Admission details",
            color: "text-indigo-600 dark:text-indigo-400",
            bg: "bg-indigo-50 dark:bg-indigo-950/30",
            d: 0.25,
          },
          {
            id: "documents" as TabId,
            icon: ClipboardList,
            label: "Verification",
            desc: "Upload & verify",
            color: "text-amber-600 dark:text-amber-400",
            bg: "bg-amber-50 dark:bg-amber-950/30",
            d: 0.3,
          },
          {
            id: "payments" as TabId,
            icon: DollarSign,
            label: "Fee Payment",
            desc: "Fees & receipts",
            color: "text-emerald-600 dark:text-emerald-400",
            bg: "bg-emerald-50 dark:bg-emerald-950/30",
            d: 0.35,
          },
        ].map((c) => (
          <motion.div
            key={c.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: c.d }}
          >
            <Card
              className="shadow-sm hover:shadow-md transition-all cursor-pointer group active:scale-[0.98]"
              onClick={() => onNavigate(c.id)}
            >
              <CardContent className="p-4 flex flex-col items-start gap-2.5">
                <div className={`p-2 rounded-lg ${c.bg}`}>
                  <c.icon size={20} className={c.color} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                    {c.label}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{c.desc}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {overview.timeline.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
        >
          <Card className="shadow-sm">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Recent Activity</CardTitle>
                <CardDescription className="text-xs">
                  Latest updates
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7"
                onClick={() => onNavigate("tracker")}
              >
                View All
                <ArrowRight size={12} className="ml-1" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {overview.timeline.slice(0, 4).map((e) => (
                <div key={e.id} className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${e.status === "COMPLETED" ? "bg-emerald-500" : e.status === "CURRENT" ? "bg-primary animate-pulse" : "bg-muted-foreground/30"}`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground font-medium">
                      {e.title}
                    </p>
                    {e.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {e.description}
                      </p>
                    )}
                    {e.timestamp && (
                      <p className="text-[10px] text-muted-foreground/60 mt-1">
                        {new Date(e.timestamp).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}

const STEPS = [
  { key: "ENQUIRY", label: "Enquiry Submittied" },
  { key: "APPLICATION", label: "Application Form Filled" },
  { key: "INTERVIEW_COMPLETED", label: "Interview & Assessment" },
  { key: "ADMISSION_ACCEPTED", label: "Admission Form" },
  { key: "DOCUMENTS_VERIFIED", label: "Documents Verification" },
  { key: "PAYMENT_COMPLETED", label: "Fee Payment" },
  { key: "ENROLLED", label: "Enrolled" },
];
const ORDER = [
  "INQUIRY_SUBMITTED",
  "INQUIRY_REVIEWED",
  "REGISTRATION_PENDING",
  "REGISTRATION_IN_PROGRESS",
  "REGISTRATION_SUBMITTED",
  "INTERVIEW_SCHEDULED",
  "INTERVIEW_COMPLETED",
  "ASSESSMENT_SCHEDULED",
  "ASSESSMENT_COMPLETED",
  "ADMISSION_OFFERED",
  "ADMISSION_ACCEPTED",
  "DOCUMENTS_PENDING",
  "DOCUMENTS_SUBMITTED",
  "DOCUMENTS_VERIFIED",
  "PAYMENT_PENDING",
  "PAYMENT_PARTIAL",
  "PAYMENT_COMPLETED",
  "ENROLLED",
];

function ProgressSteps({ currentStatus }: { currentStatus: string }) {
  const ci = ORDER.indexOf(currentStatus);
  return (
    <div className="space-y-0">
      {STEPS.map((s, i) => {
        const si = ORDER.indexOf(s.key);
        const done = ci >= si;
        const cur =
          !done && (i === 0 || ci >= ORDER.indexOf(STEPS[i - 1]!.key));
        const last = i === STEPS.length - 1;
        return (
          <div key={s.key} className="flex items-start gap-3">
            <div className="flex flex-col items-center">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${done ? "bg-emerald-500 text-white" : cur ? "bg-primary text-primary-foreground ring-4 ring-primary/20" : "bg-muted border-2 border-border"}`}
              >
                {done ? (
                  <CheckCircle size={14} />
                ) : cur ? (
                  <Clock size={12} />
                ) : (
                  <span className="w-2 h-2 rounded-full bg-muted-foreground/30" />
                )}
              </div>
              {!last && (
                <div
                  className={`w-0.5 h-8 ${done ? "bg-emerald-500" : "bg-border"}`}
                />
              )}
            </div>
            <div className="pb-6">
              <p
                className={`text-sm font-medium ${done ? "text-foreground" : cur ? "text-primary font-semibold" : "text-muted-foreground"}`}
              >
                {s.label}
              </p>
              {cur && (
                <p className="text-[11px] text-primary/70 mt-0.5">
                  In progress
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
