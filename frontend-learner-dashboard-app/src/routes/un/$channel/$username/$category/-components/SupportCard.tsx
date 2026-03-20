import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BASE_URL_LEARNER_DASHBOARD } from "@/constants/urls";

interface SupportCardProps {
  supportEmail: string;
  isError: boolean;
  isPending: boolean;
  onRetry: () => void;
}

export const SupportCard = ({
  supportEmail,
  isError,
  isPending,
  onRetry,
}: SupportCardProps) => {
  return (
    <Card className="border border-slate-200 bg-white/95 shadow-lg backdrop-blur">
      <CardContent className="flex h-full flex-col justify-between p-8">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-slate-900">
            Need something else?
          </h3>
          <p className="text-sm text-slate-600">
            Reach out to our support team and we&apos;ll help you adjust any of
            your communication preferences.
          </p>
        </div>
        <div className="mt-6 space-y-3 text-sm text-slate-500">
          <p>
            Email{" "}
            <a
              className="font-medium text-primary underline-offset-4 hover:underline"
              href={`mailto:${supportEmail}`}
            >
              {supportEmail}
            </a>{" "}
            and include the subject of the message you received.
          </p>
        </div>
        <div className="mt-8 flex flex-col gap-3">
          {isError ? (
            <Button onClick={onRetry} disabled={isPending}>
              {isPending ? "Retrying…" : "Try again"}
            </Button>
          ) : (
            <Button asChild variant="outline">
              <a href={BASE_URL_LEARNER_DASHBOARD}>Return to Vacademy</a>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

