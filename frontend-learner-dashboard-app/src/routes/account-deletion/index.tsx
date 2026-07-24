import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Trash,
  Envelope,
  ListChecks,
  Database,
  Archive,
  Clock,
} from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { Preferences } from "@capacitor/preferences";

export const Route = createFileRoute("/account-deletion/")({
  component: AccountDeletion,
});

const SUPPORT_EMAIL = "support@vacademy.io";

/**
 * Public, logged-OUT account-deletion page.
 *
 * Google Play requires the "Delete account URL" on a store listing to be
 * reachable without signing in, to name the app, to spell out the steps to
 * request deletion, and to state what is deleted, what is kept, and for how
 * long. The in-app flow at /delete-user cannot serve that purpose: it is
 * permission-gated and bounces anonymous visitors to /dashboard.
 */
function AccountDeletion() {
  const [appName, setAppName] = useState<string>("");

  // The learner app is multi-tenant: domain routing resolves the institute at
  // bootstrap and caches it. Name the resolved institute so the page reads as
  // this app's own policy rather than a generic one.
  useEffect(() => {
    (async () => {
      try {
        const instituteId =
          (await Preferences.get({ key: "InstituteId" })).value || "";
        if (!instituteId) return;
        const stored = await Preferences.get({
          key: `LEARNER_${instituteId}`,
        });
        if (!stored?.value) return;
        const parsed = JSON.parse(stored.value);
        if (parsed?.instituteName) setAppName(parsed.instituteName);
      } catch {
        // Fall back to the generic wording below.
      }
    })();
  }, []);

  const subject = encodeURIComponent("Account deletion request");

  const sections = [
    {
      id: "how-to-request",
      title: "How to request deletion",
      icon: ListChecks,
      content: [
        {
          subtitle: "From inside the app",
          text: "Sign in, open the profile menu in the top navigation bar, and choose Delete Account. Confirm when prompted. Your account is closed immediately and you are signed out on every device.",
        },
        {
          subtitle: "By email, if you cannot sign in",
          text: `Email ${SUPPORT_EMAIL} from the email address registered on your account, with the subject "Account deletion request". Tell us the name of your institute so we can locate your record. We acknowledge every request within 7 days.`,
        },
      ],
    },
    {
      id: "data-deleted",
      title: "Data that is deleted",
      icon: Database,
      content: [
        {
          subtitle: "Deleted within 30 days of your request",
          text: "Your profile information (name, email address, phone number and profile photo), the doubts and messages you posted, your enrolment records, your learning progress, and your assessment attempts and scores.",
        },
      ],
    },
    {
      id: "data-kept",
      title: "Data that is kept, and for how long",
      icon: Archive,
      content: [
        {
          subtitle: "Payment and invoice records",
          text: "Where you have made a payment, we are required to retain the invoice and transaction record under Indian tax and accounting law. These are kept for 8 years from the end of the relevant financial year and are not deleted on request.",
        },
        {
          subtitle: "Anonymised usage statistics",
          text: "Aggregate statistics that can no longer be linked back to you (for example, how many learners completed a course) are retained. These contain no personal information.",
        },
      ],
    },
    {
      id: "timeline",
      title: "Timeline",
      icon: Clock,
      content: [
        {
          subtitle: "What happens when",
          text: "Access ends immediately once the request is made. Personal data is erased within 30 days. Records we are legally required to keep are retained for the periods described above and for no longer than necessary.",
        },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 lg:py-14">
        {/* Page header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="w-16 h-16 bg-gray-900 rounded-xl mx-auto flex items-center justify-center mb-4">
            <Trash className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
            Delete your account
          </h1>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto">
            {appName
              ? `This page explains how to request deletion of your ${appName} account and the data associated with it.`
              : "This page explains how to request deletion of your account and the data associated with it."}
          </p>
        </motion.div>

        {/* Sections */}
        <div className="space-y-6">
          {sections.map((section, index) => (
            <motion.div
              key={section.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + index * 0.1 }}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 lg:p-8"
            >
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-10 h-10 bg-gray-900 rounded-lg flex items-center justify-center">
                  <section.icon className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">
                  {section.title}
                </h2>
              </div>

              <div className="space-y-4">
                {section.content.map((item) => (
                  <div key={item.subtitle}>
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">
                      {item.subtitle}
                    </h3>
                    <p className="text-gray-700 leading-relaxed">{item.text}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Contact */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 lg:p-8 mt-6"
        >
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-10 bg-gray-900 rounded-lg flex items-center justify-center">
              <Envelope className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Contact</h2>
          </div>
          <p className="text-gray-700 leading-relaxed">
            Deletion requests and questions about them are handled by{" "}
            <a
              href={`mailto:${SUPPORT_EMAIL}?subject=${subject}`}
              className="font-medium text-gray-900 underline underline-offset-2"
            >
              {SUPPORT_EMAIL}
            </a>
            .
          </p>
        </motion.div>
      </div>
    </div>
  );
}
