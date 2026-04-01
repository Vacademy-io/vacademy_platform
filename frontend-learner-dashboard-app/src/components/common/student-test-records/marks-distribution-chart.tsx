import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface MarksDistributionChartProps {
  distribution: Array<{
    marks: number;
    rank: number;
    no_of_participants: number;
    percentile: number;
  }>;
  studentMarks: number | null;
  totalParticipants: number;
}

export function MarksDistributionChart({
  distribution,
  studentMarks,
  totalParticipants,
}: MarksDistributionChartProps) {
  if (!distribution || distribution.length === 0) return null;

  // Create buckets of 10-mark ranges
  const buckets: { label: string; count: number; min: number; max: number }[] = [];
  const maxMark = Math.max(...distribution.map((d) => d.marks || 0));
  const bucketSize = 10;
  const numBuckets = Math.ceil((maxMark + 1) / bucketSize);

  for (let i = 0; i < numBuckets; i++) {
    const min = i * bucketSize;
    const max = min + bucketSize - 1;
    buckets.push({ label: `${min}-${max}`, count: 0, min, max });
  }

  // Fill buckets
  for (const d of distribution) {
    const marks = d.marks || 0;
    const bucketIndex = Math.floor(marks / bucketSize);
    if (bucketIndex >= 0 && bucketIndex < buckets.length) {
      buckets[bucketIndex].count += d.no_of_participants || 1;
    }
  }

  const maxCount = Math.max(...buckets.map((b) => b.count), 1);

  // Find student's bucket
  const studentBucketIndex =
    studentMarks != null ? Math.floor(studentMarks / bucketSize) : -1;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Marks Distribution (All Students)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-1" style={{ height: "128px" }}>
          {buckets.map((bucket, i) => {
            const heightPx = Math.max((bucket.count / maxCount) * 112, 4);
            const isStudentBucket = i === studentBucketIndex;

            return (
              <div
                key={bucket.label}
                className="flex-1 flex flex-col items-center justify-end h-full"
              >
                <span className="text-[10px] text-muted-foreground mb-1">
                  {bucket.count}
                </span>
                <div
                  className={`w-full rounded-t transition-all ${
                    isStudentBucket
                      ? "bg-primary"
                      : "bg-muted-foreground/20"
                  }`}
                  style={{ height: `${heightPx}px` }}
                />
                <span
                  className={`text-[9px] mt-1 ${
                    isStudentBucket
                      ? "font-bold text-primary"
                      : "text-muted-foreground"
                  }`}
                >
                  {bucket.label}
                  {isStudentBucket && " ★"}
                </span>
              </div>
            );
          })}
        </div>
        <div className="flex gap-4 justify-center mt-3 text-xs text-muted-foreground">
          <span>★ = Your score range</span>
          <span>|</span>
          <span>Total: {totalParticipants} students</span>
        </div>
      </CardContent>
    </Card>
  );
}
