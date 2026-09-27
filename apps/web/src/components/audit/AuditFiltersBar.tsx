import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { XIcon } from "lucide-react";
import { Input } from "#components/ui/input";
import { Button } from "#components/ui/button";
import { SingleSelectFilter } from "#components/filters/SingleSelectFilter";
import { auditFacetsQuery, type AuditFilters } from "#lib/queries";
import { AUDIT_CATEGORIES, actionLabel, actorLabel, categoryLabel } from "#lib/audit";
import { m } from "#lib/i18n";

export const EMPTY_AUDIT_FILTERS: AuditFilters = { q: "", category: "all", action: "all", actor: "all", result: "all" };

interface Props {
  filters: AuditFilters;
  onChange: (patch: Partial<AuditFilters>) => void;
  onClear: () => void;
  filtered: boolean;
  /** Changes whenever the list reloads, so the facet counts follow it. */
  reloadKey: number | null;
}

/** Keyword (debounced), category, action, actor and result, as on PickIt's audit page. */
export function AuditFiltersBar({ filters, onChange, onClear, filtered, reloadKey }: Props) {
  const { data: facets, refetch } = useQuery(auditFacetsQuery);
  useEffect(() => {
    if (reloadKey) refetch();
  }, [reloadKey, refetch]);

  const [keyword, setKeyword] = useState(filters.q);
  useEffect(() => setKeyword(filters.q), [filters.q]);
  useEffect(() => {
    if (keyword === filters.q) return;
    const timer = setTimeout(() => onChange({ q: keyword }), 300);
    return () => clearTimeout(timer);
  }, [keyword, filters.q, onChange]);

  const all = (label: string) => ({ value: "all", label });
  const categories = [all(m.audit_all_categories()), ...AUDIT_CATEGORIES.map((c) => ({ value: c, label: categoryLabel(c) }))];
  const actions = [
    all(m.audit_all_actions()),
    ...(facets?.actions ?? [])
      .filter((a) => filters.category === "all" || a.value.startsWith(`${filters.category}.`))
      .map((a) => ({ value: a.value, label: m.facet_count({ label: actionLabel(a.value), count: a.count }) })),
  ];
  const actors = [
    all(m.audit_all_actors()),
    ...(facets?.actors ?? []).map((a) => ({ value: a.value, label: m.facet_count({ label: actorLabel(a.value), count: a.count }) })),
  ];
  const results = [all(m.audit_all_results()), { value: "ok", label: m.audit_ok() }, { value: "error", label: m.audit_failed() }];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        size="sm"
        type="search"
        className="min-w-0 max-sm:w-full sm:w-56"
        placeholder={m.audit_search_placeholder()}
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
      />
      <SingleSelectFilter
        label={m.audit_all_categories()}
        options={categories}
        value={filters.category}
        onChange={(category) => onChange({ category, action: "all" })}
      />
      <SingleSelectFilter label={m.audit_all_actions()} options={actions} value={filters.action} onChange={(action) => onChange({ action })} />
      <SingleSelectFilter label={m.audit_all_actors()} options={actors} value={filters.actor} onChange={(actor) => onChange({ actor })} />
      <SingleSelectFilter label={m.audit_all_results()} options={results} value={filters.result} onChange={(result) => onChange({ result })} />
      {filtered && (
        <Button variant="ghost" size="sm" onClick={onClear}>
          <XIcon />
          {m.filter_clear_all()}
        </Button>
      )}
    </div>
  );
}
