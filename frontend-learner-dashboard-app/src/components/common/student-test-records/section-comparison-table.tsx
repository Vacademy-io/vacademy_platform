import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface SectionData {
  section_id: string;
  section_name: string;
  student_marks: number;
  section_total_marks: number;
  section_average_marks: number;
  section_highest_marks: number;
  cut_off_marks: number | null;
  student_accuracy: number;
  class_accuracy: number;
  passed: boolean;
}

interface SectionComparisonTableProps {
  sections: SectionData[];
}

export function SectionComparisonTable({
  sections,
}: SectionComparisonTableProps) {
  if (!sections || sections.length === 0) return null;

  const hasCutOff = sections.some((s) => s.cut_off_marks != null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Section-Wise Performance</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="text-left py-2 px-3">Section</th>
                <th className="text-left py-2 px-3">Your Marks</th>
                <th className="text-left py-2 px-3">Total</th>
                <th className="text-left py-2 px-3">Class Avg</th>
                <th className="text-left py-2 px-3">Accuracy</th>
                {hasCutOff && (
                  <>
                    <th className="text-left py-2 px-3">Cut-off</th>
                    <th className="text-left py-2 px-3">Status</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {sections.map((section) => {
                const accuracy = section.student_accuracy ?? (
                  section.section_total_marks > 0
                    ? Math.round((section.student_marks / section.section_total_marks) * 100)
                    : 0
                );

                return (
                  <tr key={section.section_id} className="border-b last:border-0">
                    <td className="py-2 px-3 font-medium">
                      {section.section_name}
                    </td>
                    <td className="py-2 px-3 font-bold">
                      {Math.round(section.student_marks * 10) / 10}
                    </td>
                    <td className="py-2 px-3">
                      {section.section_total_marks}
                    </td>
                    <td className="py-2 px-3">
                      {section.section_average_marks}
                    </td>
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-2">
                        <Progress value={accuracy} className="h-1.5 w-16" />
                        <span className="text-xs">{Math.round(accuracy)}%</span>
                      </div>
                    </td>
                    {hasCutOff && (
                      <>
                        <td className="py-2 px-3">
                          {section.cut_off_marks ?? "-"}
                        </td>
                        <td className="py-2 px-3">
                          {section.cut_off_marks != null && (
                            <Badge
                              variant={section.passed ? "default" : "destructive"}
                              className="text-xs"
                            >
                              {section.passed ? "PASS" : "FAIL"}
                            </Badge>
                          )}
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
