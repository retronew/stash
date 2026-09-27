import type { MediaTask, MediaTaskPage } from "@stash/shared";
import { usePagedList } from "#hooks/usePagedList";
import { tasksQuery, type TaskFilters } from "#lib/queries";

const tasksOf = (page: MediaTaskPage) => page.tasks;
const inFlight = (tasks: MediaTask[]) => tasks.some((t) => t.status === "pending" || t.status === "downloading");

/** Download tasks for the given filters; polls while any is still in flight. */
export function useTasks(filters: TaskFilters) {
  const list = usePagedList(tasksQuery(filters), tasksOf, { while: inFlight, ms: 5000 });
  return { ...list, tasks: list.rows };
}
