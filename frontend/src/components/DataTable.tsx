import { useState, useMemo, type ReactNode } from 'react';
import {
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
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
      let valA: any = col?.sortValue
        ? col.sortValue(a)
        : (a as Record<string, unknown>)[sortKey];
      let valB: any = col?.sortValue
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

  return (
    <div className="w-full space-y-3">
      {/* ── Top Bar: Search, Filters & Bulk Actions ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#656D76]" />
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-8 py-1.5 text-sm bg-white border border-[#D0D7DE] rounded-md focus:outline-none focus:ring-2 focus:ring-[#0969DA] focus:border-transparent transition-all shadow-sm"
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

          {filterSlot && <div className="flex items-center gap-2">{filterSlot}</div>}
        </div>

        {/* Bulk Action Controls */}
        {selectable && selected.size > 0 && (
          <div className="flex items-center gap-2 animate-in fade-in duration-150">
            {bulkActionsSlot ? (
              bulkActionsSlot(Array.from(selected))
            ) : onBulkAction ? (
              <button
                onClick={handleBulkAction}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#CF222E] text-white text-xs font-semibold rounded-md hover:bg-[#A40E26] shadow-sm transition-colors"
              >
                {bulkActionLabel} ({selected.size})
              </button>
            ) : null}
            <button
              onClick={() => setSelected(new Set())}
              className="text-xs text-[#656D76] hover:text-[#1F2328] underline"
            >
              Clear selection
            </button>
          </div>
        )}
      </div>

      {/* ── Responsive Table ── */}
      <div className="border border-[#D0D7DE] rounded-lg overflow-hidden bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-[#F6F8FA] border-b border-[#D0D7DE] text-[#656D76] text-xs font-semibold uppercase tracking-wider select-none">
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
            <tbody className="divide-y divide-[#D0D7DE] text-[#1F2328]">
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
                          className={`px-4 py-3 text-sm ${col.className || ''}`}
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

        {/* ── Pagination Footer ── */}
        <div className="px-4 py-3 bg-[#F6F8FA] border-t border-[#D0D7DE] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-[#656D76]">
          <div className="flex items-center gap-4">
            <span>
              Showing <strong className="text-[#1F2328]">{startEntry}</strong> to{' '}
              <strong className="text-[#1F2328]">{endEntry}</strong> of{' '}
              <strong className="text-[#1F2328]">{totalEntries}</strong> entries
              {search && ` (filtered from ${data.length} total)`}
            </span>

            <div className="flex items-center gap-1.5">
              <span>Per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-white border border-[#D0D7DE] rounded px-2 py-0.5 text-xs text-[#1F2328] focus:outline-none focus:ring-1 focus:ring-[#0969DA]"
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
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={validCurrentPage <= 1}
              className="inline-flex items-center justify-center p-1.5 rounded border border-[#D0D7DE] bg-white text-[#1F2328] hover:bg-[#F6F8FA] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="px-2 text-[#1F2328] font-medium">
              Page {validCurrentPage} of {totalPages}
            </span>

            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={validCurrentPage >= totalPages}
              className="inline-flex items-center justify-center p-1.5 rounded border border-[#D0D7DE] bg-white text-[#1F2328] hover:bg-[#F6F8FA] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
