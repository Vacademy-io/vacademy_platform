import { AppleLogo } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

/**
 * "Sign in with Apple" button.
 *
 * Apple Human Interface Guidelines require the Apple logo, an approved title
 * ("Sign in with Apple" / "Continue with Apple"), and a black / white / white-
 * outline style presented as a peer to other sign-in options. We use the solid
 * black style here.
 */
export function AppleSignInButton({
  onClick,
  disabled,
  className,
  label = "Continue with Apple",
}: {
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex h-11 w-full items-center justify-center gap-2 rounded-md bg-black font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
    >
      <AppleLogo weight="fill" className="h-5 w-5" />
      <span className="text-sm">{label}</span>
    </button>
  );
}
