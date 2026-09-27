import { useState } from "react";
import type { AttachmentKind, AttachmentStatus } from "@stash/shared";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "#components/ui/empty";
import { PageLoading } from "#components/PageLoading";
import { LoadMoreButton } from "#components/LoadMoreButton";
import { TaskSummary } from "#components/tasks/TaskSummary";
import { TasksFilterBar } from "#components/tasks/TasksFilterBar";
import { TaskRow } from "#components/tasks/TaskRow";
import { TaskDetailDialog } from "#components/tasks/TaskDetailDialog";
import { useTasks } from "#hooks/useTasks";
import { useAccounts } from "#hooks/useAccounts";
import { useMediaRetry } from "#hooks/useMediaRetry";
import { errorMessage } from "#lib/api";
import { m } from "#lib/i18n";

/** Every attachment download: summary, filters, per-task retry and details. */
export function TasksPage() {
  const [status, setStatus] = useState<AttachmentStatus>();
  const [kind, setKind] = useState<AttachmentKind>();
  const [account, setAccount] = useState("");
  const { accounts } = useAccounts();
  const retry = useMediaRetry();
  const list = useTasks({ status, kind, account: account || undefined });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-heading text-lg font-semibold">{m.nav_tasks()}</h1>
        <p className="text-muted-foreground text-sm">{m.media_description()}</p>
      </div>
      <TaskSummary onRetryAll={() => retry()} />
      <TasksFilterBar
        status={status}
        onStatusChange={setStatus}
        kind={kind}
        onKindChange={setKind}
        account={account}
        onAccountChange={setAccount}
        accounts={accounts ?? []}
      />
      {list.isLoading ? (
        <PageLoading />
      ) : list.error ? (
        <p className="text-destructive text-sm">{m.load_failed({ error: errorMessage(list.error) })}</p>
      ) : list.tasks.length === 0 ? (
        <Empty className="animate-fade-in">
          <EmptyHeader>
            <EmptyTitle>{m.tasks_empty()}</EmptyTitle>
            <EmptyDescription>{m.tasks_empty_hint()}</EmptyDescription>
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
