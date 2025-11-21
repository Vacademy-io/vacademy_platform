import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { useSuspenseQuery } from "@tanstack/react-query";
import { handleGetAudienceCampaign } from "./-services/audience-campaign-services";
import AudienceResponseForm from "./-components/audience-response-form";

const audienceParamsSchema = z.object({
  instituteId: z.string().min(1),
  audienceId: z.string().min(1),
});

export const Route = createFileRoute("/audience-response/")({
  validateSearch: audienceParamsSchema,
  component: RouteComponent,
});

function RouteComponent() {
  const { instituteId, audienceId } = Route.useSearch();

  const { data: campaignData } = useSuspenseQuery(
    handleGetAudienceCampaign({ instituteId, audienceId })
  );

  return (
    <AudienceResponseForm
      campaignData={campaignData}
      instituteId={instituteId}
      audienceId={audienceId}
    />
  );
}

