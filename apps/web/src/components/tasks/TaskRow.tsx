import { RotateCwIcon } from "lucide-react";
import type { MediaTask } from "@stash/shared";
import { Badge } from "#components/ui/badge";
import { Button } from "#components/ui/button";
import { Spinner } from "#components/ui/spinner";
import { TaskThumb } from "#components/tasks/TaskThumb";
import { kindLabel, statusLabel, statusVariant } from "#lib/labels";
import { formatBytes, formatDateTime, formatRelative } from "#lib/format";
import { m } from "#lib/i18n";

interface Props {
  task: MediaTask;
  onOpen: (task: MediaTask) => void;
  onRetry: (id: number) => void;
}

/** One download in the task list; the row opens its details. */
export function TaskRow({ task, onOpen, onRetry }: Props) {
  const size = task.storedSize ?? task.size;
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-lg border px-3 py-2 transition-colors hover:bg-accent/40">
      <button type="button" className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-start" onClick={() => onOpen(task)}>
        <TaskThumb attachment={task} />
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="truncate text-sm">{task.filename || kindLabel(task.kind)}</p>
          <p className="truncate text-muted-foreground text-xs">
            {[task.senderName, task.text].filter(Boolean).join(" · ") || m.task_no_text()}
          </p>
          {task.status !== "stored" && task.lastError && (
            <p className="truncate text-destructive-foreground text-xs">{task.lastError}</p>
          )}
        </div>
        <div className="hidden shrink-0 text-end text-muted-foreground text-xs sm:block">
          <p>{size ? formatBytes(size) : "—"}</p>
          <p title={formatDateTime(task.createdAt)}>{formatRelative(task.createdAt)}</p>
        </div>
      </button>
      <Badge variant={statusVariant(task.status)} className="shrink-0">
        {task.status === "downloading" && <Spinner className="size-3" />}
        {statusLabel(task.status)}
        {task.attempts > 1 && ` ×${task.attempts}`}
      </Badge>
      {task.status === "failed" && (
        <Button size="icon-xs" variant="ghost" aria-label={m.action_retry()} onClick={() => onRetry(task.id)}>
          <RotateCwIcon />
        </Button>
      )}
    </div>
  );
}
