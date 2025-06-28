import { createFileRoute } from "@tanstack/react-router";
import { TestNewSlides } from "@/components/common/study-library/level-material/subject-material/module-material/chapter-material/slide-material/test-new-slides";

export const Route = createFileRoute("/test-slides")({
  component: TestSlides,
});

function TestSlides() {
  return <TestNewSlides />;
}
