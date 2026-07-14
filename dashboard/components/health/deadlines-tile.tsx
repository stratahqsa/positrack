import { CalendarClock, CircleCheck, CircleAlert } from "lucide-react";
import { StatTile } from "@/components/health/stat-tile";
import { cn } from "@/lib/utils";

/** This week's deadlines — due / done / late (thisWeekDeadlines()). */
export function DeadlinesTile({
  due,
  done,
  late,
}: {
  due: number;
  done: number;
  late: number;
}) {
  return (
    <StatTile
      label="This week's deadlines"
      icon={CalendarClock}
      tone={late > 0 ? "danger" : "info"}
      href="#"
      linkLabel="View Weekly Deadline"
    >
      <div className="tabular text-2xl font-bold leading-none text-fg">
        {due}
        <span className="ml-1 text-[12px] font-medium text-muted">due</span>
      </div>
      <div className="mt-1.5 flex items-center gap-3 text-[11.5px]">
        <span className="inline-flex items-center gap-1 text-good">
          <CircleCheck className="size-3.5" />
          {done} done
        </span>
        <span
          className={cn(
            "inline-flex items-center gap-1",
            late > 0 ? "text-danger" : "text-faint",
          )}
        >
          <CircleAlert className="size-3.5" />
          {late} late
        </span>
      </div>
    </StatTile>
  );
}
