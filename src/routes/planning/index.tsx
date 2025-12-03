import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { LayoutContainer } from "@/components/common/layout-container/layout-container";
import { useNavHeadingStore } from "@/stores/layout-container/useNavHeadingStore";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, ClipboardList } from "lucide-react";

export const Route = createFileRoute("/planning/")({
  component: PlanningPage,
});

function PlanningPage() {
  const navigate = useNavigate();
  const { setNavHeading } = useNavHeadingStore();

  // Set navigation heading
  useEffect(() => {
    setNavHeading("Planning & Activity");
  }, [setNavHeading]);

  return (
    <LayoutContainer>
      <div className="container mx-auto space-y-4 p-2">
        {/* Header */}
        <div>
          <h2 className="text-2xl font-semibold">Planning & Activity</h2>
          <p className="mt-2 text-muted-foreground">
            View plannings and activities shared by your teachers
          </p>
        </div>

        {/* Cards */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card
            className="cursor-pointer transition-shadow hover:shadow-lg"
            onClick={() => navigate({ to: "/planning/planning-logs" } as never)}
          >
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-3">
                  <BookOpen className="size-6 text-primary" />
                </div>
                <div>
                  <CardTitle>Plannings</CardTitle>
                  <CardDescription>
                    View plannings from your teachers
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full">
                View Plannings
              </Button>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer transition-shadow hover:shadow-lg"
            onClick={() => navigate({ to: "/planning/activity-logs" } as never)}
          >
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-secondary/10 p-3">
                  <ClipboardList className="size-6 text-secondary-foreground" />
                </div>
                <div>
                  <CardTitle>Activities</CardTitle>
                  <CardDescription>
                    View activities from your teachers
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full">
                View activities
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </LayoutContainer>
  );
}
