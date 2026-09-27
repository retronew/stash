import { usePagedList } from "#hooks/usePagedList";
import { auditQuery, type AuditFilters } from "#lib/queries";
import type { AuditPage } from "#lib/audit";

const entriesOf = (page: AuditPage) => page.entries;

/** The audit trail for the given filters; live refetches every 5 s. */
export function useAudit(filters: AuditFilters, live: boolean) {
  const list = usePagedList(auditQuery(filters), entriesOf, { live });
  return { ...list, entries: list.rows };
}
