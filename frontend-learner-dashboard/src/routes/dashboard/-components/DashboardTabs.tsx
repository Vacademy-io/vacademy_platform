import { PlayCircle } from "@/assets/svgs";
import { Slide } from "@/types/dashbaord/types";

interface DashboardTabsProps {
  title: string;
  count?: number;
  button?: boolean;
  buttonText?: string;
  list?: Slide[];
}

export function DashboardTabs({
  title,
  count,
  button,
  buttonText,
  list = [],
}: DashboardTabsProps) {
  return (
    <div className="border rounded-md bg-sidebar-background p-4 flex flex-col">
      <div className="flex flex-row justify-between text-subtitle font-semibold">
        <div>{title}</div>
        <div className="text-primary-500">{count}</div>
      </div>
      {list?.length > 0 && (
        <div className="flex flex-col gap-2 my-4">
          {list?.map((item, idx) => (
            <div key={idx} className="flex flex-row gap-5 items-start">
              <PlayCircle />
              <div>{item.slide_title}</div>
            </div>
          ))}
        </div>
      )}

      {button && (
        <div className="w-full flex items-center justify-center mt-4">
          <button className="border py-2 w-40 rounded-md text-body">
            {buttonText}
          </button>
        </div>
      )}
    </div>
  );
}
