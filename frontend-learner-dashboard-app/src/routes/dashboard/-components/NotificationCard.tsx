import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Bell, CaretRight, Clock } from "@phosphor-icons/react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

interface NotifcationCardProps {
  title?: string;
  description?: string;
  date?: string;
  isNew?: boolean;
}

export function NotifcationCard({
  title,
  description,
  date,
  isNew = true,
}: NotifcationCardProps) {
  const { t } = useTranslation("dashboard");
  return (
    <Card
      className={cn(
        "relative overflow-hidden transition-all duration-300 hover:shadow-md cursor-pointer group",
        isNew ? "border-primary/20 bg-primary/5" : "border-border shadow-sm",
        // Vibrant Styles
        "[.ui-vibrant_&]:hover:shadow-lg [.ui-vibrant_&]:hover:border-primary/30",
        isNew && "[.ui-vibrant_&]:bg-gradient-to-br [.ui-vibrant_&]:from-primary/5 [.ui-vibrant_&]:to-primary/10",
        // Play Styles — bg/shadow/border handled by .ui-play .card rule (and notification-card-new for new state)
        "[.ui-play_&]:font-bold",
        // info-soft unread surface (play-theme.css) carries ink text now
        isNew && "notification-card-new [.ui-play_&]:text-play-info-soft-ink"
      )}
    >
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start gap-3 md:gap-4">
          <div className={`p-2 rounded-md flex-shrink-0 ${isNew ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
            }`}>
            <Bell size={18} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1">
              <h3 className="text-sm sm:text-base font-semibold text-foreground leading-tight line-clamp-1">
                {title}
              </h3>
              {isNew && (
                <Badge variant="secondary" className="bg-primary/10 text-primary text-caption px-1.5 h-5 flex-shrink-0">
                  {t("notifications.newBadge")}
                </Badge>
              )}
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2 mb-3">
              {description}
            </p>

            <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-3 mt-1">
              <div className="flex items-center gap-1.5">
                <Clock size={12} />
                <span>{date}</span>
              </div>

              <div className="flex items-center gap-1 group-hover:text-primary transition-colors">
                <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                  {t("notifications.viewDetails")}
                </span>
                <CaretRight size={14} weight="bold" className="transform group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

