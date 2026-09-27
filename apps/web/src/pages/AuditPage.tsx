import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "#components/ui/empty";
import { PageLoading } from "#components/PageLoading";
import { LoadMoreButton } from "#components/LoadMoreButton";
import { LiveRefreshControls } from "#components/LiveRefreshControls";
import { AuditEntryRow } from "#components/audit/AuditEntryRow";
import { AuditFiltersBar, EMPTY_AUDIT_FILTERS } from "#components/audit/AuditFiltersBar";
import { useAudit } from "#hooks/useAudit";
import { useFilterState } from "#hooks/useFilterState";
import { usePersistentFlag } from "#hooks/usePersistentFlag";
import { errorMessage } from "#lib/api";
import { m } from "#lib/i18n";

/** Who did what: API writes, exports, MCP calls and sign-ins, as on PickIt's audit page. */
export function AuditPage() {
  const { filters, set, clear, filtered } = useFilterState(EMPTY_AUDIT_FILTERS);
  const [live, setLive] = usePersistentFlag("stash-audit-live", true);
  const log = useAudit(filters, live);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-heading font-semibold text-lg">{m.nav_audit()}</h1>
          <p className="text-muted-foreground text-xs">{m.audit_description()}</p>
        </div>
        <LiveRefreshControls
          live={live}
          onLiveChange={setLive}
          onRefresh={log.refresh}
          refreshing={log.refreshing}
          updatedAt={log.updatedAt}
        />
      </div>
      <AuditFiltersBar filters={filters} onChange={set} onClear={clear} filtered={filtered} reloadKey={log.updatedAt} />
      {log.isLoading ? (
        <PageLoading />
      ) : log.error ? (
        <p className="text-destructive text-sm">{m.load_failed({ error: errorMessage(log.error) })}</p>
      ) : log.entries.length === 0 ? (
        <Empty className="animate-fade-in">
          <EmptyHeader>
            <EmptyTitle>{filtered ? m.list_empty_filtered() : m.audit_empty()}</EmptyTitle>
            <EmptyDescription>{filtered ? m.list_empty_filtered_hint() : m.audit_empty_hint()}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="animate-fade-in space-y-3">
          <ul className="overflow-hidden rounded-xl border">
            {log.entries.map((e) => (
              <AuditEntryRow key={e.id} entry={e} />
            ))}
          </ul>
          <LoadMoreButton hasMore={log.hasMore} loading={log.loadingMore} onLoadMore={log.loadMore} />
        </div>
      )}
    </div>
  );
}
