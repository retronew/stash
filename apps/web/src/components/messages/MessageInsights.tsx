import { useState } from "react";
import { ChevronDownIcon, SparklesIcon } from "lucide-react";
import { FIELD_KEYS, type Message, type MessageFields } from "@stash/shared";
import { Badge } from "#components/ui/badge";
import { Spinner } from "#components/ui/spinner";
import { CopyButton } from "#components/CopyButton";
import { m } from "#lib/i18n";
import { cn } from "#lib/utils";

const FIELD_LABELS: Record<keyof MessageFields, () => string> = {
  amounts: () => m.field_amounts(),
  dates: () => m.field_dates(),
  phones: () => m.field_phones(),
  emails: () => m.field_emails(),
  urls: () => m.field_urls(),
  addresses: () => m.field_addresses(),
  codes: () => m.field_codes(),
  people: () => m.field_people(),
};

/** A category or tag clicked on a card, to filter the list by it. */
export type LabelPick = { category: string } | { tag: string };

/** Makes a badge a button when the list can filter by it. */
function pickable(onPick: ((label: LabelPick) => void) | undefined, label: LabelPick) {
  if (!onPick) return {};
  return {
    render: <button type="button" onClick={() => onPick(label)} />,
    className: "cursor-pointer hover:bg-accent",
    title: m.insights_filter_by(),
  };
}

/** What AI analysis found: category, tags, summary, and on demand the image text and key fields. */
export function MessageInsights({ message, onPick }: { message: Message; onPick?: (label: LabelPick) => void }) {
  const [open, setOpen] = useState(false);
  const fields = FIELD_KEYS.filter((k) => message.fields[k].length > 0);
  const hasDetails = !!message.ocrText || fields.length > 0;

  if (message.aiStatus === "pending" || message.aiStatus === "running") {
    return (
      <p className="flex items-center gap-1.5 text-muted-foreground text-xs">
        <Spinner className="size-3" />
        {m.insights_analyzing()}
      </p>
    );
  }
  if (!message.category && !message.summary && message.tags.length === 0) {
    return message.aiStatus === "failed" ? (
      <p className="truncate text-destructive-foreground text-xs" title={message.aiError}>
        {m.insights_failed({ error: message.aiError })}
      </p>
    ) : null;
  }

  return (
    <div className="space-y-1.5 rounded-lg bg-muted/40 px-3 py-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <SparklesIcon className="size-3.5 text-muted-foreground" />
        {message.category && (
          <Badge variant="info" {...pickable(onPick, { category: message.category })}>
            {message.category}
          </Badge>
        )}
        {message.tags.map((t) => (
          <Badge key={t} variant="outline" {...pickable(onPick, { tag: t })}>
            #{t}
          </Badge>
        ))}
        {hasDetails && (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="ms-auto inline-flex cursor-pointer items-center gap-0.5 text-muted-foreground text-xs hover:text-foreground"
          >
            {m.insights_details()}
            <ChevronDownIcon className={cn("size-3.5 transition-transform", open && "rotate-180")} />
          </button>
        )}
      </div>
      {message.summary && <p className="text-sm">{message.summary}</p>}
      {open && (
        <div className="animate-fade-in space-y-2 pt-1">
          {fields.length > 0 && (
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
              {fields.map((k) => (
                <div key={k} className="contents">
                  <dt className="text-muted-foreground">{FIELD_LABELS[k]()}</dt>
                  <dd className="flex min-w-0 flex-wrap gap-1">
                    {message.fields[k].map((v) => (
                      <span key={v} className="inline-flex max-w-full items-center gap-0.5 rounded bg-background px-1.5 py-0.5">
                        <span className="break-all">{v}</span>
                        <CopyButton text={v} aria-label={m.action_copy()} className="size-5 sm:size-5" />
                      </span>
                    ))}
                  </dd>
                </div>
              ))}
            </dl>
          )}
          {message.ocrText && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-muted-foreground text-xs">
                {m.insights_image_text()}
                <CopyButton text={message.ocrText} aria-label={m.action_copy()} />
              </div>
              <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded bg-background px-2 py-1.5 font-sans text-xs">
                {message.ocrText}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
