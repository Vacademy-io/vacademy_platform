import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/auth-transfer/")({
  component: AuthTransferComponent,
});

/**
 * Landing route when redirecting from teacher portal with tokens in URL.
 * __root beforeLoad handles ?accessToken=...&refreshToken=... and redirects;
 * this component only renders if no tokens are present (e.g. after redirect).
 */
function AuthTransferComponent() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <p className="text-muted-foreground">Signing you in...</p>
    </div>
  );
}
