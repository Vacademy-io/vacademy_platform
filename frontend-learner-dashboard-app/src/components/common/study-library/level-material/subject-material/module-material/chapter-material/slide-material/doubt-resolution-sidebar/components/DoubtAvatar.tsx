import { cn } from "@/lib/utils";
import { SmallDummyProfile } from "@/assets/svgs";

/** Circular author avatar with a neutral placeholder — sized for compact rows. */
export const DoubtAvatar = ({
  name,
  url,
  className,
}: {
  name?: string;
  url?: string;
  className?: string;
}) => (
  <div
    className={cn(
      "size-8 shrink-0 overflow-hidden rounded-full bg-neutral-100",
      className
    )}
  >
    {url ? (
      <img src={url} alt={name || ""} className="size-full object-cover" />
    ) : (
      <SmallDummyProfile />
    )}
  </div>
);
