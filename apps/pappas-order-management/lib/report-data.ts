export type ReportPage<T> = {
  data: T[] | null;
  error: string | null;
};

const REPORT_PAGE_SIZE = 1_000;

export async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => Promise<ReportPage<T>>,
  pageSize = REPORT_PAGE_SIZE,
): Promise<ReportPage<T>> {
  const allRows: T[] = [];

  for (let from = 0; ; from += pageSize) {
    const page = await fetchPage(from, from + pageSize - 1);
    if (page.error) return { data: null, error: page.error };

    const rows = page.data || [];
    allRows.push(...rows);
    if (rows.length < pageSize) return { data: allRows, error: null };
  }
}
