import { useNavigate } from "@tanstack/react-router";
import { CheckCircle, EnvelopeSimple } from "@phosphor-icons/react";
import { ModernCard } from "@/components/design-system/modern-card";
import { MyButton } from "@/components/design-system/button";

interface SuccessStepProps {
  orgName: string;
  adminEmail: string;
}

/** Final step — registration completed, credentials emailed to the admin. */
const SuccessStep = ({ orgName, adminEmail }: SuccessStepProps) => {
  const navigate = useNavigate();

  return (
    <ModernCard
      variant="glass"
      padding="lg"
      rounded="lg"
      className="border border-white/40 bg-white/90 shadow-lg backdrop-blur-md"
    >
      <div className="space-y-6 py-8 text-center">
        <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-success-50">
          <CheckCircle weight="fill" className="size-10 text-success-600" />
        </div>

        <div className="space-y-3">
          <h2 className="text-2xl font-bold text-neutral-700 sm:text-3xl">
            Your organization has been registered!
          </h2>
          {orgName && (
            <p className="text-lg text-neutral-600">
              <span className="font-semibold">{orgName}</span> is all set.
            </p>
          )}
          <div className="mx-auto flex max-w-md items-start justify-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-left">
            <EnvelopeSimple className="mt-0.5 size-5 flex-shrink-0 text-primary-500" />
            <p className="text-sm text-neutral-600">
              Login credentials have been emailed to{" "}
              <span className="font-semibold text-neutral-700">
                {adminEmail}
              </span>
              . Use them to sign in and get started.
            </p>
          </div>
        </div>

        <MyButton
          type="button"
          buttonType="primary"
          scale="large"
          layoutVariant="default"
          onClick={() => void navigate({ to: "/login" })}
          className="min-w-32"
        >
          Login
        </MyButton>
      </div>
    </ModernCard>
  );
};

export default SuccessStep;
