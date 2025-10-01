"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminGuard } from "@/components/AdminGuard";
import { getSupabaseClient } from "@/lib/supabase/client";
import Link from "next/link";

type SmartPayRow = {
  transactionDate: string; // raw string from CSV
  terminalId: string;
  transactionType: string;
  cardType: string;
  last4: string;
  transactionAmount: number; // possibly includes surcharge; kept for reference
  purchase: number;
  surcharge: number;
  cashOut: number;
  tips: number;
  paymentStatus: string;
};

type ParsedPreviewRow = SmartPayRow & {
  importAmount: number; // computed amount we will insert as income
  isoDate: string; // YYYY-MM-DD
};

function parseCsv(content: string): string[][] {
  const rows: string[][] = [];
  let current: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const next = i + 1 < content.length ? content[i + 1] : "";

    if (inQuotes) {
      if (char === '"') {
        if (next === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        current.push(field);
        field = "";
      } else if (char === '\n') {
        current.push(field);
        rows.push(current);
        current = [];
        field = "";
      } else if (char === '\r') {
        // ignore
      } else {
        field += char;
      }
    }
  }
  // push last field/row if present
  if (field.length > 0 || current.length > 0) {
    current.push(field);
    rows.push(current);
  }
  return rows;
}

function parseNumber(value: string): number {
  const trimmed = value.trim().replace(/[$,]/g, "");
  const num = Number(trimmed);
  return Number.isFinite(num) ? num : 0;
}

function toIsoDate(dateTime: string): string {
  // Expected format: DD/MM/YYYY HH:mm:ss
  const [datePart] = dateTime.split(" ");
  const [dd, mm, yyyy] = datePart.split("/");
  if (!dd || !mm || !yyyy) return new Date().toISOString().split("T")[0];
  return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
}

export default function IncomeExpenseImportPage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [fileContent, setFileContent] = useState<string>("");
  const [rows, setRows] = useState<ParsedPreviewRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const checkAdmin = async () => {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setIsAdmin(false); return; }
      const { data: profile } = await supabase
        .from("profiles").select("role_slug").eq("id", user.id).single();
      setIsAdmin(profile?.role_slug === "admin");
    };
    void checkAdmin();
  }, []);

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setSuccess(null);
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      setFileContent(text);
    };
    reader.readAsText(file);
  }, []);

  const parseSmartPay = useCallback(() => {
    setLoading(true);
    setError(null);
    try {
      const table = parseCsv(fileContent);
      if (table.length === 0) { setRows([]); setLoading(false); return; }
      // Detect header row
      const header = table[0].map(h => h.trim().toLowerCase());
      const hasHeader = header.includes("transaction date") || header.includes("terminal id");
      const dataRows = hasHeader ? table.slice(1) : table;

      const parsed: ParsedPreviewRow[] = dataRows
        .map(cols => {
          const [c0, c1, c2, c3, c4, c5, c6, c7, c8, c9, c10] = cols;
          const row: SmartPayRow = {
            transactionDate: (c0 || "").trim(),
            terminalId: (c1 || "").trim(),
            transactionType: (c2 || "").trim(),
            cardType: (c3 || "").trim(),
            last4: (c4 || "").trim(),
            transactionAmount: parseNumber(c5 || "0"),
            purchase: parseNumber(c6 || "0"),
            surcharge: parseNumber(c7 || "0"),
            cashOut: parseNumber(c8 || "0"),
            tips: parseNumber(c9 || "0"),
            paymentStatus: (c10 || "").trim(),
          };
          const isoDate = toIsoDate(row.transactionDate);
          const importAmount = Math.max(0, row.purchase + row.surcharge + row.tips);
          return { ...row, isoDate, importAmount };
        })
        .filter(r => r.paymentStatus.toUpperCase() === "APPROVED");

      setRows(parsed);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to parse file");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [fileContent]);

  const totalAmount = useMemo(() => rows.reduce((sum, r) => sum + r.importAmount, 0), [rows]);

  const onImport = useCallback(async () => {
    setImporting(true);
    setError(null);
    setSuccess(null);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError("Not authenticated"); setImporting(false); return; }

      const res = await fetch("/api/income-expense/import/smartpay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentUserId: user.id, rows }),
      });
      const json: { success: boolean; error?: string; inserted?: number } = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error || "Import failed");
      } else {
        setSuccess(`Imported ${json.inserted || 0} transactions`);
        setRows([]);
        setFileContent("");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setImporting(false);
    }
  }, [rows]);

  if (isAdmin === null) {
    return <div className="p-6 text-gray-500">Checking access…</div>;
  }
  if (!isAdmin) {
    return <div className="p-6 text-red-600">Access restricted. Admins only.</div>;
  }

  return (
    <AdminGuard>
      <div className="p-3 sm:p-6 max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Import Income/Expense</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">Import data from providers and confirm before saving</p>
          </div>
          <Link href="/income-expense" className="text-blue-600 dark:text-blue-400 hover:underline">Back</Link>
        </div>

        <div className="grid gap-6">
          <div className="border rounded-xl p-4 dark:border-neutral-800">
            <h2 className="font-semibold mb-2">SmartPay</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Upload SmartPay CSV to create income transactions (Purchase + Surcharge + Tips, APPROVED only).</p>
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
              <input type="file" accept=".csv,text/csv" onChange={onFileChange} />
              <button
                onClick={parseSmartPay}
                disabled={!fileContent || loading}
                className="h-9 px-3 rounded-lg bg-blue-600 text-white disabled:opacity-60"
              >
                {loading ? "Parsing…" : "Parse"}
              </button>
            </div>
            {error && <div className="mt-3 text-sm text-red-600">{error}</div>}
            {success && <div className="mt-3 text-sm text-green-600">{success}</div>}
          </div>

          {rows.length > 0 && (
            <div className="border rounded-xl p-4 dark:border-neutral-800">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">Preview ({rows.length} rows)</h3>
                <div className="text-sm">Total Amount: <span className="font-semibold">${totalAmount.toFixed(2)}</span></div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-neutral-800">
                    <tr>
                      <th className="px-3 py-2 text-left">Date</th>
                      <th className="px-3 py-2 text-left">Terminal</th>
                      <th className="px-3 py-2 text-left">Type</th>
                      <th className="px-3 py-2 text-left">Card</th>
                      <th className="px-3 py-2 text-left">Last 4</th>
                      <th className="px-3 py-2 text-right">Purchase</th>
                      <th className="px-3 py-2 text-right">Surcharge</th>
                      <th className="px-3 py-2 text-right">Tips</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                      <th className="px-3 py-2 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, idx) => (
                      <tr key={`${r.transactionDate}-${r.last4}-${idx}`} className="border-b last:border-b-0 dark:border-neutral-800">
                        <td className="px-3 py-2">{r.transactionDate}</td>
                        <td className="px-3 py-2">{r.terminalId}</td>
                        <td className="px-3 py-2">{r.transactionType}</td>
                        <td className="px-3 py-2">{r.cardType}</td>
                        <td className="px-3 py-2">{r.last4}</td>
                        <td className="px-3 py-2 text-right">{r.purchase.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right">{r.surcharge.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right">{r.tips.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right font-semibold">{r.importAmount.toFixed(2)}</td>
                        <td className="px-3 py-2">{r.paymentStatus}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 dark:bg-neutral-800">
                    <tr>
                      <td className="px-3 py-2" colSpan={8}>Total</td>
                      <td className="px-3 py-2 text-right font-semibold">{totalAmount.toFixed(2)}</td>
                      <td className="px-3 py-2" />
                    </tr>
                  </tfoot>
                </table>
              </div>
              <div className="mt-4 flex items-center justify-end">
                <button
                  onClick={onImport}
                  disabled={importing}
                  className="h-10 px-4 rounded-lg bg-green-600 text-white disabled:opacity-60"
                >
                  {importing ? "Importing…" : "Confirm Import"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminGuard>
  );
}


