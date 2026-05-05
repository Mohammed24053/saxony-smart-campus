/**
 * Tiny client-side CSV exporter used by every list page.
 *
 * Quotes per RFC 4180 — wraps every cell in double quotes, escapes embedded
 * quotes by doubling them. Empty/undefined/null become empty cells. The
 * first row is the header, in the order of `columns`.
 */
export interface CsvColumn<T> {
  header: string;
  /** Either a key on T or a function returning the cell value. */
  value: keyof T | ((row: T) => string | number | null | undefined);
}

function cell(v: unknown): string {
  if (v === null || v === undefined) return '""';
  const s = typeof v === 'string' ? v : String(v);
  return `"${s.replace(/"/g, '""')}"`;
}

export function rowsToCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const header = columns.map((c) => cell(c.header)).join(',');
  const body = rows
    .map((row) =>
      columns
        .map((c) => {
          const raw = typeof c.value === 'function' ? c.value(row) : (row[c.value] as unknown);
          return cell(raw);
        })
        .join(','),
    )
    .join('\n');
  return `${header}\n${body}`;
}

export function downloadCsv(filename: string, csv: string) {
  if (typeof window === 'undefined') return;
  // BOM so Excel recognizes UTF-8 and Arabic renders correctly.
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 0);
}

export function exportRowsToCsv<T>(filename: string, rows: T[], columns: CsvColumn<T>[]) {
  downloadCsv(filename, rowsToCsv(rows, columns));
}
