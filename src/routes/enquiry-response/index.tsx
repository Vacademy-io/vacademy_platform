import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { useSuspenseQuery } from "@tanstack/react-query";
import { handleGetAudienceCampaign } from "./-services/enquiry-campaign-services";
import AudienceResponseForm from "./-components/enquiry-response-form";

const audienceParamsSchema = z.object({
  instituteId: z.string().min(1),
  enquiryId: z.string().min(1),
});

export const Route = createFileRoute("/enquiry-response/")({
  validateSearch: audienceParamsSchema,
  component: RouteComponent,
});

function RouteComponent() {
  const { instituteId, enquiryId } = Route.useSearch();

  const { data: campaignData } = useSuspenseQuery(
    handleGetAudienceCampaign({ instituteId, audienceId: enquiryId }),
  );

  return (
    <AudienceResponseForm
      campaignData={campaignData}
      instituteId={instituteId}
      audienceId={enquiryId}
    />
  );
}
