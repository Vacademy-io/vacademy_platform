import { Ban } from "lucide-react";

import { Card, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BASE_URL_LEARNER_DASHBOARD } from "@/constants/urls";

interface InvalidLinkNoticeProps {

}

export const InvalidLinkNotice = ({

}: InvalidLinkNoticeProps) => {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-16">
      <div className="mx-auto flex max-w-lg flex-col items-center text-center">
        <Ban className="h-12 w-12 text-rose-500" />
        <h1 className="mt-6 text-3xl font-semibold text-slate-900 sm:text-4xl">
          Link unavailable
        </h1>
        <p className="mt-4 text-base text-slate-600">
          This unsubscribe link is missing required information or may have
          expired. Reach out to our support team and we&apos;ll update your
          preferences manually.
        </p>

        <Card className="mt-10 w-full border border-slate-200 bg-white/90 shadow-lg backdrop-blur">

          <CardFooter className="border-t border-slate-100 bg-slate-50 px-8 py-6">
            <Button asChild variant="outline" className="w-full sm:w-auto">
              <a href={BASE_URL_LEARNER_DASHBOARD}>Return to Vacademy</a>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </main>
  );
};

