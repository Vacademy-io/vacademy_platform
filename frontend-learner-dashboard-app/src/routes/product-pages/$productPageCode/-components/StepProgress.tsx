import { Check } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { useProductPageStore } from "../-stores/product-page-store";
import type { ProductPageStep } from "../-types/product-page-types";

interface StepDef {
  id: ProductPageStep;
  label: string;
}

/**
 * The browse step is part of the rail so the visitor can see the whole journey
 * from the first screen, rather than discovering a 3-step checkout only after
 * committing to a course.
 */
const CHECKOUT_STEPS: StepDef[] = [
  { id: "CATALOG", label: "Select Courses" },
  { id: "CART", label: "Review Cart" },
  { id: "FORM", label: "Your Details" },
  { id: "PAYMENT", label: "Review & Pay" },
];

const CPO_CHECKOUT_STEPS: StepDef[] = [
  { id: "CATALOG", label: "Select Courses" },
  { id: "CART", label: "Review Cart" },
  { id: "FORM", label: "Your Details" },
  { id: "CPO_INSTALLMENTS", label: "Installments" },
];

export const StepProgress = ({
  primaryColor = "#2563eb", // design-lint-ignore: page-builder default color
}: {
  primaryColor?: string;
}) => {
  const { step } = useProductPageStore();
  const isCpoFlow = step === "CPO_INSTALLMENTS";
  const steps = isCpoFlow ? CPO_CHECKOUT_STEPS : CHECKOUT_STEPS;
  const currentIndex = steps.findIndex((s) => s.id === step);

  return (
    <nav
      aria-label="Enrollment progress"
      className="flex items-start justify-center"
    >
      {steps.map((s, i) => {
        const done = i < currentIndex;
        const active = i === currentIndex;
        return (
          <div key={s.id} className="flex min-w-0 items-start">
            <div className="flex w-16 flex-col items-center gap-1.5 sm:w-24">
              <div
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-colors",
                  done && "bg-success-500 text-white",
                  !done && !active && "bg-gray-100 text-gray-400",
                )}
                style={
                  active
                    ? {
                        // Dynamic: the institute's own page colour, which only
                        // exists at runtime in page_json.globalSettings.
                        backgroundColor: primaryColor,
                        color: "white",
                        boxShadow: `0 0 0 4px ${primaryColor}33`,
                      }
                    : undefined
                }
                aria-current={active ? "step" : undefined}
              >
                {done ? <Check className="size-4" aria-hidden="true" /> : i + 1}
              </div>
              <span
                className={cn(
                  "text-center text-2xs font-medium leading-tight sm:text-caption",
                  done && "text-success-600",
                  !done && !active && "text-gray-400",
                )}
                // Dynamic: institute page colour, see above.
                style={active ? { color: primaryColor } : undefined}
              >
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={cn(
                  "mt-4 h-px w-4 shrink-0 sm:w-10",
                  i < currentIndex ? "bg-success-300" : "bg-gray-200",
                )}
                aria-hidden="true"
              />
            )}
          </div>
        );
      })}
    </nav>
  );
};
