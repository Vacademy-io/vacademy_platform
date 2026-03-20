import { Slide } from "@/types/dashbaord/types";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Book, FileText, ClipboardList, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface DashboardTabsProps {
  title: string;
  count?: number;
  button?: boolean;
  buttonText?: string;
  list?: Slide[];
  icon?: React.ReactNode;
}

const getIcon = (title: string) => {
  if (title.toLowerCase().includes('subject')) return <Book className="w-5 h-5" />;
  if (title.toLowerCase().includes('homework')) return <FileText className="w-5 h-5" />;
  if (title.toLowerCase().includes('test')) return <ClipboardList className="w-5 h-5" />;
  return <Book className="w-5 h-5" />;
};

export function DashboardTabs({
  title,
  count = 0,
  button,
  buttonText,
  list = [],
  icon,
}: DashboardTabsProps) {
  const displayIcon = icon || getIcon(title);

  return (
    <Card className={cn(
      "hover:shadow-md transition-shadow duration-200 h-full flex flex-col",
      // Vibrant Styles - Flat Pastel
      "[.ui-vibrant_&]:bg-violet-50/50 dark:[.ui-vibrant_&]:bg-violet-950/20",
      "[.ui-vibrant_&]:border-violet-200/50 dark:[.ui-vibrant_&]:border-violet-800/30"
    )}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-3">
          <div className={cn(
            "p-2 bg-primary/10 rounded-lg text-primary",
            "[.ui-vibrant_&]:bg-white/90 [.ui-vibrant_&]:text-violet-600 dark:[.ui-vibrant_&]:bg-violet-500/10 dark:[.ui-vibrant_&]:text-violet-300"
          )}>
            {displayIcon}
          </div>
          <div className="text-base font-semibold text-foreground">
            {title}
          </div>
        </div>
        <Badge variant={count > 0 ? "secondary" : "outline"} className="text-xs">
          {count}
        </Badge>
      </CardHeader>

      <CardContent className="pt-4 flex-grow">
        <div className="text-sm text-muted-foreground mb-4">
          <span className="inline-flex items-center gap-2">
            <div className={cn(
              "w-2 h-2 rounded-full",
              count === 0 ? 'bg-muted' : 'bg-primary [.ui-vibrant_&]:bg-violet-500'
            )}></div>
            {count === 0 ? 'No items available' : `${count} ${count === 1 ? 'item' : 'items'} ready`}
          </span>
        </div>

        {list?.length > 0 && (
          <div className="space-y-2">
            {list?.slice(0, 3).map((item, idx) => (
              <div
                key={idx}
                className={cn(
                  "flex items-center gap-3 py-2 px-3 bg-accent/50 rounded-lg hover:bg-accent transition-colors duration-150",
                  "[.ui-vibrant_&]:bg-violet-100/30 [.ui-vibrant_&]:hover:bg-violet-100/60 dark:[.ui-vibrant_&]:bg-violet-900/10 dark:[.ui-vibrant_&]:hover:bg-violet-900/20"
                )}
              >
                <div className="w-2 h-2 rounded-full flex-shrink-0 bg-primary [.ui-vibrant_&]:bg-violet-500"></div>
                <div className="truncate text-sm font-medium text-foreground">{item.slide_title}</div>
              </div>
            ))}
            {list.length > 3 && (
              <div className="text-xs text-muted-foreground pl-5 pt-1">
                +{list.length - 3} more items
              </div>
            )}
          </div>
        )}
      </CardContent>

      {button && (
        <CardFooter>
          <Button className="w-full">
            {buttonText} <ChevronRight className="ml-2 w-4 h-4" />
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}

