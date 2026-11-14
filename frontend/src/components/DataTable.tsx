import { useState, useMemo, type ReactNode } from 'react';
import {
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Inbox,
} from 'lucide-react';

export interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => ReactNode;
  /** If false, column header cannot be clicked to sort. Defaults to true if key != 'actions'. */
  sortable?: boolean;
  /** Custom sort value extractor. Defaults to item[key]. */
  sortValue?: (item: T) => string | number | boolean | Date | null | undefined;
  /** Extra th/td classNames */
  className?: string;
  headerClassName?: string;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor?: (item: T) => string;
  /** Bulk action button label, e.g. "Delete Selected" */
  bulkActionLabel?: string;
  /** Called when bulk action button is clicked */
  onBulkAction?: (keys: string[]) => void;
  /** Extra custom bulk action buttons */
  bulkActionsSlot?: (selectedKeys: string[]) => ReactNode;
  /** Custom filter controls rendered alongside the search bar */
  filterSlot?: ReactNode;
  loading?: boolean;
  emptyMessage?: string;
  /** Initial rows per page (default 10) */
  initialPageSize?: number;
  /** Hide checkbox column entirely if false (default true) */
  selectable?: boolean;
}

export default function DataTable<T>({
  columns,
  data,
  keyExtractor = (item: any) => item?.id ?? String(Math.random()),
  bulkActionLabel = 'Delete Selected',
  onBulkAction,
  bulkActionsSlot,
  filterSlot,
  loading = false,
  emptyMessage = 'No data found.',
  initialPageSize = 10,
  selectable = true,
}: DataTableProps<T>) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [pageSize, setPageSize] = useState<number>(initialPageSize);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Search filter
  const filtered = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter((item) =>
      columns.some((col) => {
        const val = (item as Record<string, unknown>)[col.key];
        return String(val ?? '').toLowerCase().includes(q);
      }),
    );
  }, [data, columns, search]);

  // Sort
  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const col = columns.find((c) => c.key === sortKey);
    return [...filtered].sort((a, b) => {
      const valA: any = col?.sortValue
        ? col.sortValue(a)
        : (a as Record<string, unknown>)[sortKey];
      const valB: any = col?.sortValue
        ? col.sortValue(b)
        : (b as Record<string, unknown>)[sortKey];

      if (valA === valB) return 0;
      if (valA === null || valA === undefined) return 1;
      if (valB === null || valB === undefined) return -1;

      if (typeof valA === 'string' && typeof valB === 'string') {
        const res = valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
        return sortDir === 'asc' ? res : -res;
      }

      if (valA instanceof Date && valB instanceof Date) {
        return sortDir === 'asc'
          ? valA.getTime() - valB.getTime()
          : valB.getTime() - valA.getTime();
      }

      return sortDir === 'asc'
        ? valA > valB
          ? 1
          : -1
        : valA < valB
        ? 1
        : -1;
    });
  }, [filtered, sortKey, sortDir, columns]);

  // Pagination calculations
  const totalEntries = sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalEntries / pageSize));
  const validCurrentPage = Math.min(currentPage, totalPages);

  const paginatedData = useMemo(() => {
    const startIdx = (validCurrentPage - 1) * pageSize;
    return sorted.slice(startIdx, startIdx + pageSize);
  }, [sorted, validCurrentPage, pageSize]);

  // Key tracking
  const visibleKeys = useMemo(
    () => paginatedData.map((item) => keyExtractor(item)),
    [paginatedData, keyExtractor],
  );

  const allVisibleSelected =
    visibleKeys.length > 0 && visibleKeys.every((k) => selected.has(k));
  const someVisibleSelected = visibleKeys.some((k) => selected.has(k));

  const toggleAllVisible = () => {
    const next = new Set(selected);
    if (allVisibleSelected) {
      visibleKeys.forEach((k) => next.delete(k));
    } else {
      visibleKeys.forEach((k) => next.add(k));
    }
    setSelected(next);
  };

  const toggleOne = (key: string) => {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelected(next);
  };

  const handleSort = (key: string, sortable?: boolean) => {
    if (sortable === false || key === 'actions') return;
    if (sortKey === key) {
      if (sortDir === 'asc') {
        setSortDir('desc');
      } else {
        setSortKey(null);
        setSortDir('asc');
      }
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const handleBulkAction = () => {
    if (!onBulkAction || selected.size === 0) return;
    onBulkAction(Array.from(selected));
    setSelected(new Set());
  };

  const startEntry = totalEntries === 0 ? 0 : (validCurrentPage - 1) * pageSize + 1;
  const endEntry = Math.min(validCurrentPage * pageSize, totalEntries);

  const primaryCol = columns[0];
  const actionsCol = columns.find((c) => c.key === 'actions');
  const detailCols = columns.slice(1).filter((c) => c.key !== 'actions');

  return (
    <div className="w-full space-y-3">
      {/* ── Top Bar: Search, Filters & Bulk Actions ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-1">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#656D76] pointer-events-none" />
            <input
              type="text"
              placeholder="Search records..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm bg-white border border-[#D0D7DE] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0969DA] focus:border-[#0969DA] transition-all shadow-2xs"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#656D76] hover:text-[#1F2328]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {filterSlot && <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">{filterSlot}</div>}
        </div>

        {/* Bulk Action Controls */}
        {selectable && selected.size > 0 && (
          <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2 bg-[#EEF2F6] border border-[#D0D7DE] px-3 py-1.5 rounded-lg animate-enter">
            {bulkActionsSlot ? (
              bulkActionsSlot(Array.from(selected))
            ) : onBulkAction ? (
              <button
                onClick={handleBulkAction}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#CF222E] text-white text-xs font-semibold rounded-md hover:bg-[#A40E26] transition-colors cursor-pointer"
              >
                {bulkActionLabel} ({selected.size})
              </button>
            ) : null}
            <button
              onClick={() => setSelected(new Set())}
              className="text-xs text-[#656D76] hover:text-[#1F2328] underline cursor-pointer"
            >
              Clear selection
            </button>
          </div>
        )}
      </div>

      {/* ── Mobile Select-All Bar (< md) ── */}
      {selectable && !loading && paginatedData.length > 0 && (
        <div className="md:hidden flex items-center justify-between bg-white border border-[#D0D7DE] rounded-lg px-3.5 py-2 text-xs shadow-2xs">
          <label className="inline-flex items-center gap-2 font-semibold text-[#1F2328] cursor-pointer">
            <input
              type="checkbox"
              checked={allVisibleSelected}
              ref={(el) => {
                if (el) el.indeterminate = someVisibleSelected && !allVisibleSelected;
              }}
              onChange={toggleAllVisible}
              className="rounded border-[#D0D7DE] text-[#0969DA] focus:ring-[#0969DA] cursor-pointer"
            />
            <span>Select all on page ({paginatedData.length})</span>
          </label>
          {selected.size > 0 && (
            <span className="text-[11px] font-semibold text-[#0969DA]">
              {selected.size} selected
            </span>
          )}
        </div>
      )}

      {/* ── Mobile Stacked Card View (< md) ── */}
      <div className="md:hidden space-y-2.5">
        {loading ? (
          <div className="bg-white border border-[#D0D7DE] rounded-xl p-10 text-center shadow-xs">
            <div className="w-6 h-6 border-2 border-[#0969DA] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <span className="text-xs font-medium text-[#656D76]">Loading records...</span>
          </div>
        ) : paginatedData.length === 0 ? (
          <div className="bg-white border border-[#D0D7DE] rounded-xl p-8 text-center shadow-xs">
            <div className="w-10 h-10 rounded-full bg-[#EEF2F6] border border-[#D0D7DE] flex items-center justify-center text-[#656D76] mx-auto mb-2">
              <Inbox className="w-4 h-4" />
            </div>
            <p className="text-xs font-semibold text-[#1F2328]">{emptyMessage}</p>
            {search && (
              <p className="text-[11px] text-[#656D76] mt-0.5">
                Try adjusting your search or filters.
              </p>
            )}
          </div>
        ) : (
          paginatedData.map((item) => {
            const key = keyExtractor(item);
            const isChecked = selected.has(key);
            return (
              <div
                key={key}
                className={`bg-white border rounded-xl p-3.5 shadow-xs transition-colors space-y-2.5 ${
                  isChecked
                    ? 'border-[#0969DA] bg-[#DDF4FF]/25'
                    : 'border-[#D0D7DE]'
                }`}
              >
                {/* Primary Row */}
                {primaryCol && (
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      {selectable && (
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleOne(key)}
                          className="mt-0.5 rounded border-[#D0D7DE] text-[#0969DA] focus:ring-[#0969DA] cursor-pointer shrink-0"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-[#656D76] mb-0.5">
                          {primaryCol.header}
                        </div>
                        <div className="text-sm font-bold text-[#1F2328] break-words">
                          {primaryCol.render
                            ? primaryCol.render(item)
                            : String((item as Record<string, unknown>)[primaryCol.key] ?? '')}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Detail Rows */}
                {detailCols.length > 0 && (
                  <div className="pt-2 border-t border-[#E1E4E8] grid grid-cols-1 gap-1.5">
                    {detailCols.map((col) => (
                      <div
                        key={col.key}
                        className="flex items-start justify-between gap-3 text-xs"
                      >
                        <span className="text-[11px] font-semibold text-[#656D76] shrink-0">
                          {col.header}
                        </span>
                        <div className="text-right font-medium text-[#1F2328] min-w-0 break-words">
                          {col.render
                            ? col.render(item)
                            : String((item as Record<string, unknown>)[col.key] ?? '')}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Actions Footer */}
                {actionsCol && (
                  <div className="pt-2.5 border-t border-[#E1E4E8] flex flex-wrap items-center justify-end gap-2">
                    {actionsCol.render
                      ? actionsCol.render(item)
                      : String((item as Record<string, unknown>)[actionsCol.key] ?? '')}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ── Desktop Table View (md+) ── */}
      <div className="hidden md:block border border-[#D0D7DE] rounded-xl overflow-hidden bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-[#F6F8FA] border-b border-[#D0D7DE] text-[#656D76] text-[11px] font-bold uppercase tracking-wider select-none">
              <tr>
                {selectable && (
                  <th className="px-4 py-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = someVisibleSelected && !allVisibleSelected;
                      }}
                      onChange={toggleAllVisible}
                      className="rounded border-[#D0D7DE] text-[#0969DA] focus:ring-[#0969DA] cursor-pointer"
                    />
                  </th>
                )}
                {columns.map((col) => {
                  const isSortable = col.sortable !== false && col.key !== 'actions';
                  const isSorted = sortKey === col.key;
                  return (
                    <th
                      key={col.key}
                      onClick={() => handleSort(col.key, col.sortable)}
                      className={`px-4 py-3 whitespace-nowrap ${
                        isSortable ? 'cursor-pointer hover:bg-[#EAEEF2] transition-colors' : ''
                      } ${col.headerClassName || ''}`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>{col.header}</span>
                        {isSortable && (
                          <span className="text-[#8C959F]">
                            {isSorted ? (
                              sortDir === 'asc' ? (
                                <ArrowUp className="w-3.5 h-3.5 text-[#0969DA]" />
                              ) : (
                                <ArrowDown className="w-3.5 h-3.5 text-[#0969DA]" />
                              )
                            ) : (
                              <ArrowUpDown className="w-3 h-3 opacity-40 hover:opacity-100" />
                            )}
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E1E4E8] text-[#1F2328]">
              {loading ? (
                <tr>
                  <td
                    colSpan={columns.length + (selectable ? 1 : 0)}
                    className="px-4 py-12 text-center text-[#656D76]"
                  >
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-6 h-6 border-2 border-[#0969DA] border-t-transparent rounded-full animate-spin" />
                      <span className="text-sm">Loading records...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length + (selectable ? 1 : 0)}
                    className="px-4 py-10 text-center text-[#656D76]"
                  >
                    <div className="flex flex-col items-center justify-center gap-1">
                      <p className="font-medium text-[#1F2328]">{emptyMessage}</p>
                      {search && (
                        <p className="text-xs text-[#656D76]">
                          Try adjusting your search or filters.
                        </p>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedData.map((item) => {
                  const key = keyExtractor(item);
                  const isChecked = selected.has(key);
                  return (
                    <tr
                      key={key}
                      className={`transition-colors hover:bg-[#F6F8FA] ${
                        isChecked ? 'bg-[#DDF4FF]/40' : ''
                      }`}
                    >
                      {selectable && (
                        <td className="px-4 py-3 w-10 text-center">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleOne(key)}
                            className="rounded border-[#D0D7DE] text-[#0969DA] focus:ring-[#0969DA] cursor-pointer"
                          />
                        </td>
                      )}
                      {columns.map((col) => (
                        <td
                          key={col.key}
                          className={`px-4 py-3 text-xs sm:text-sm ${col.className || ''}`}
                        >
                          {col.render
                            ? col.render(item)
                            : String((item as Record<string, unknown>)[col.key] ?? '')}
                        </td>
                      ))}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Pagination Footer (Mobile & Desktop) ── */}
      <div className="px-3.5 sm:px-4 py-2.5 sm:py-3 bg-white border border-[#D0D7DE] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-[#656D76] shadow-2xs">
        <div className="flex flex-wrap items-center justify-between sm:justify-start gap-3">
          <span>
            Showing <strong className="text-[#1F2328]">{startEntry}</strong>–
            <strong className="text-[#1F2328]">{endEntry}</strong> of{' '}
            <strong className="text-[#1F2328]">{totalEntries}</strong>
            {search && ` (filtered)`}
          </span>

          <div className="flex items-center gap-1.5">
            <span>Rows:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-[#F6F8FA] border border-[#D0D7DE] rounded-md px-2 py-0.5 text-xs text-[#1F2328] focus:outline-none focus:ring-1 focus:ring-[#0969DA]"
            >
              {[5, 10, 25, 50, 100].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Page navigation */}
        <div className="flex items-center justify-between sm:justify-end gap-1.5">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={validCurrentPage <= 1}
            className="inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-md border border-[#D0D7DE] bg-[#F6F8FA] text-[#1F2328] font-semibold hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            title="Previous page"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span className="sm:hidden">Prev</span>
          </button>

          <span className="px-2 text-[#1F2328] font-semibold">
            Page {validCurrentPage} of {totalPages}
          </span>

          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={validCurrentPage >= totalPages}
            className="inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-md border border-[#D0D7DE] bg-[#F6F8FA] text-[#1F2328] font-semibold hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            title="Next page"
          >
            <span className="sm:hidden">Next</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
