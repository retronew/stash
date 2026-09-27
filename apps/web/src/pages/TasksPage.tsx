import { useQueryClient } from "@tanstack/react-query";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "#components/ui/empty";
import { PageLoading } from "#components/PageLoading";
import { LoadMoreButton } from "#components/LoadMoreButton";
import { LiveRefreshControls } from "#components/LiveRefreshControls";
import { TaskSummary } from "#components/tasks/TaskSummary";
import { EMPTY_TASK_FILTERS, TasksFilterBar } from "#components/tasks/TasksFilterBar";
import { TaskRow } from "#components/tasks/TaskRow";
import { TaskDetailDialog } from "#components/tasks/TaskDetailDialog";
import { useTasks } from "#hooks/useTasks";
import { useAccounts } from "#hooks/useAccounts";
import { useMediaRetry } from "#hooks/useMediaRetry";
import { useFilterState } from "#hooks/useFilterState";
import { usePersistentFlag } from "#hooks/usePersistentFlag";
import { mediaStatsQuery } from "#lib/queries";
import { errorMessage } from "#lib/api";
import { m } from "#lib/i18n";

/** Every attachment download: summary, filters, live refresh, per-task retry and details. */
export function TasksPage() {
  const queryClient = useQueryClient();
  const { filters, set, clear, filtered } = useFilterState(EMPTY_TASK_FILTERS);
  const [live, setLive] = usePersistentFlag("stash-tasks-live", true);
  const { accounts } = useAccounts();
  const retry = useMediaRetry();
  const list = useTasks(filters, live);

  function refresh() {
    list.refresh();
    queryClient.invalidateQueries({ queryKey: mediaStatsQuery.queryKey });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-heading font-semibold text-lg">{m.nav_tasks()}</h1>
          <p className="text-muted-foreground text-xs">{m.media_description()}</p>
        </div>
        <LiveRefreshControls
          live={live}
          onLiveChange={setLive}
          onRefresh={refresh}
          refreshing={list.refreshing}
          updatedAt={list.updatedAt}
        />
      </div>
      <TaskSummary live={live} onRetryAll={() => retry()} />
      <TasksFilterBar filters={filters} onChange={set} onClear={clear} accounts={accounts ?? []} />
      {list.isLoading ? (
        <PageLoading />
      ) : list.error ? (
        <p className="text-destructive text-sm">{m.load_failed({ error: errorMessage(list.error) })}</p>
      ) : list.tasks.length === 0 ? (
        <Empty className="animate-fade-in">
          <EmptyHeader>
            <EmptyTitle>{filtered ? m.list_empty_filtered() : m.tasks_empty()}</EmptyTitle>
            <EmptyDescription>{filtered ? m.list_empty_filtered_hint() : m.tasks_empty_hint()}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid animate-fade-in gap-2">
          {list.tasks.map((t) => (
            <TaskRow
              key={t.id}
              task={t}
              onOpen={(task) => TaskDetailDialog.call({ id: task.id, onRetry: (id) => retry([id]) })}
              onRetry={(id) => retry([id])}
            />
          ))}
          <LoadMoreButton hasMore={list.hasMore} loading={list.loadingMore} onLoadMore={list.loadMore} />
        </div>
      )}
      <TaskDetailDialog />
    </div>
  );
}
