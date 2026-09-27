import type { MediaTask, MediaTaskPage } from "@stash/shared";
import { usePagedList } from "#hooks/usePagedList";
import { tasksQuery, type TaskFilters } from "#lib/queries";

const tasksOf = (page: MediaTaskPage) => page.tasks;
const inFlight = (tasks: MediaTask[]) => tasks.some((t) => t.status === "pending" || t.status === "downloading");

/** Download tasks for the given filters. Live: refetch every 5 s; otherwise only while downloads are in flight. */
export function useTasks(filters: TaskFilters, live: boolean) {
  const list = usePagedList(tasksQuery(filters), tasksOf, { pollWhile: inFlight, live });
  return { ...list, tasks: list.rows };
}
