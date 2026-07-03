/**
 * DataTable — a reusable table component that adheres to the Shinaa Design System.
 *
 * Every data table in TruMark MUST include:
 * 1. A global search bar at the top.
 * 2. A checkbox column on the left for row selection.
 * 3. A bulk action menu that activates when rows are selected.
 */
import { useState, useMemo, type ReactNode } from 'react';

export interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => ReactNode;
  /** If true, column renders the raw value of item[key] as a string. */
  raw?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  /** Label for the bulk action button, e.g. "Delete Selected" */
  bulkActionLabel?: string;
  /** Called with an array of selected row keys */
  onBulkAction?: (keys: string[]) => void;
  loading?: boolean;
}

export default function DataTable<T>({
  columns,
  data,
  keyExtractor,
  bulkActionLabel = 'Delete Selected',
  onBulkAction,
  loading = false,
}: DataTableProps<T>) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Filter data by search query across all string columns
  const filtered = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter((item) =>
      columns.some((col) => {
        const val = (item as Record<string, unknown>)[col.key];
        return String(val ?? '').toLowerCase().includes(q);
      }),
    );
  }, [data, search, columns]);

  const allVisibleKeys = filtered.map(keyExtractor);
  const allSelected = allVisibleKeys.every((k) => selected.has(k));
  const someSelected = allVisibleKeys.some((k) => selected.has(k));

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(allVisibleKeys));
    }
  };

  const toggleOne = (key: string) => {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelected(next);
  };

  const handleBulkAction = () => {
    if (!onBulkAction || selected.size === 0) return;
    onBulkAction(Array.from(selected));
    setSelected(new Set());
  };

  return (
    <div>
      {/* ── Search bar ── */}
      <div className="mb-3 flex items-center gap-3">
        <input
          type="text"
          placeholder="Search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-[#D0D7DE] rounded-md px-3 py-1.5 text-sm w-full max-w-xs focus:outline-none focus:ring-2 focus:ring-[#0969DA] focus:border-transparent shadow-sm"
        />
        {selected.size > 0 && (
          <button
            onClick={handleBulkAction}
            className="bg-[#0969DA] text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-[#0353A4] transition-colors"
          >
            {bulkActionLabel} ({selected.size})
          </button>
        )}
      </div>

      {/* ── Table ── */}
      <div className="border border-[#D0D7DE] rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#F6F8FA] border-b border-[#D0D7DE]">
            <tr>
              <th className="px-4 py-2 text-left w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  // Indeterminate when some (but not all) visible rows are selected
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected && !allSelected;
                  }}
                  onChange={toggleAll}
                  className="cursor-pointer"
                />
              </th>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="px-4 py-2 text-left text-[#656D76] font-medium whitespace-nowrap"
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length + 1} className="px-4 py-8 text-center text-[#656D76]">
                  Loading…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1} className="px-4 py-8 text-center text-[#656D76]">
                  No data found.
                </td>
              </tr>
            ) : (
              filtered.map((item) => {
                const key = keyExtractor(item);
                return (
                  <tr
                    key={key}
                    className="border-b border-[#D0D7DE] last:border-b-0 hover:bg-[#F6F8FA] transition-colors"
                  >
                    <td className="px-4 py-2">
                      <input
                        type="checkbox"
                        checked={selected.has(key)}
                        onChange={() => toggleOne(key)}
                        className="cursor-pointer"
                      />
                    </td>
                    {columns.map((col) => (
                      <td key={col.key} className="px-4 py-2 text-[#1F2328]">
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

      <p className="text-xs text-[#656D76] mt-2">
        {filtered.length} result{filtered.length !== 1 ? 's' : ''}
        {search && ` (filtered from ${data.length})`}
      </p>
    </div>
  );
}
