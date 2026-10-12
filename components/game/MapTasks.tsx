"use client";

import { useState } from "react";
import {
  BriefcaseBusiness,
  Check,
  ChevronDown,
  ChevronUp,
  Clock3,
  MapPin,
} from "lucide-react";
import { formatNaira } from "@/lib/format";
import { MAP_TASKS, MAP_TASK_COOLDOWN_MS } from "@/lib/mapTasks";

export default function MapTasks({
  completedTasks,
  now,
}: {
  completedTasks: Record<string, number>;
  now: number;
}) {
  const [isCollapsed, setIsCollapsed] = useState(true);

  const availableCount = MAP_TASKS.filter(
    (task) =>
      (completedTasks[task.id] ?? 0) + MAP_TASK_COOLDOWN_MS <= now
  ).length;

  return (
    <section
      className={`absolute left-3 top-27 z-10 w-[min(290px,calc(100%-24px))] overflow-hidden rounded-lg border border-white/90 bg-white/95 shadow-[0_8px_28px_rgba(24,50,39,0.18)] backdrop-blur-md ${
        isCollapsed ? "max-w-[230px]" : ""
      }`}
    >
      <header className="flex items-center justify-between gap-2 border-b border-[#e4eae1] px-3 py-2.5">
        <button
          type="button"
          onClick={() => setIsCollapsed((previous) => !previous)}
          aria-expanded={!isCollapsed}
          aria-label={isCollapsed ? "Expand map tasks" : "Collapse map tasks"}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <BriefcaseBusiness
            size={15}
            className="shrink-0 text-[#26724f]"
          />

          <h2 className="truncate text-xs font-extrabold text-[#1b3329]">
            Map tasks
          </h2>

          <span className="shrink-0 text-[10px] font-bold tabular-nums text-[#718276]">
            {availableCount} ready
          </span>

          {isCollapsed ? (
            <ChevronDown size={15} className="ml-auto shrink-0 text-[#26724f]" />
          ) : (
            <ChevronUp size={15} className="ml-auto shrink-0 text-[#26724f]" />
          )}
        </button>
      </header>

      {!isCollapsed && (
        <ul className="max-h-[min(42dvh,360px)] divide-y divide-[#edf0eb] overflow-y-auto">
          {MAP_TASKS.map((task) => {
            const availableAt =
              (completedTasks[task.id] ?? 0) + MAP_TASK_COOLDOWN_MS;

            const coolingDown = availableAt > now;

            const hoursLeft = Math.max(
              1,
              Math.ceil((availableAt - now) / (60 * 60 * 1000))
            );

            return (
              <li key={task.id} className="px-3 py-2.5">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-[11px] font-bold leading-4 text-[#284b35]">
                    {task.title}
                  </h3>

                  <span className="shrink-0 text-[10px] font-extrabold tabular-nums text-[#26724f]">
                    {formatNaira(task.reward)}
                  </span>
                </div>

                <p className="mt-1 flex items-center gap-1 text-[10px] text-[#718276]">
                  <MapPin size={11} className="shrink-0" />
                  {task.targetBuildingName}
                </p>

                <p
                  className={`mt-1 flex items-center gap-1 text-[10px] font-semibold ${
                    coolingDown ? "text-[#859087]" : "text-[#26724f]"
                  }`}
                >
                  {coolingDown ? (
                    <Clock3 size={11} />
                  ) : (
                    <Check size={11} />
                  )}

                  {coolingDown ? `Ready in ${hoursLeft}h` : "Visit to collect"}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}