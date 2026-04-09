"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import type { Announcement } from "@my-small-business/types";
import { Icon } from "@/components/Icon";
import { FaChevronLeft, FaChevronRight, FaTimes } from "react-icons/fa";
import Link from "next/link";

const DISMISSED_BY_ID_KEY = "announcements-dismissed-by-id";
const HIDDEN_IDS_KEY = "announcements-hidden-ids";

function loadHiddenIds(): Set<string> {
  try {
    const raw = localStorage.getItem(HIDDEN_IDS_KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((x): x is string => typeof x === "string"));
  } catch {
    return new Set();
  }
}

function saveHiddenIds(ids: Set<string>) {
  localStorage.setItem(HIDDEN_IDS_KEY, JSON.stringify([...ids]));
}

type DismissedMap = Record<string, number>;

function loadDismissedById(): DismissedMap {
  try {
    const raw = localStorage.getItem(DISMISSED_BY_ID_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const now = Date.now();
    const cleaned: DismissedMap = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === "number" && Number.isFinite(value) && value > now) {
        cleaned[key] = value;
      }
    }
    // Persist cleaned map (remove expired entries)
    localStorage.setItem(DISMISSED_BY_ID_KEY, JSON.stringify(cleaned));
    return cleaned;
  } catch {
    return {};
  }
}

function saveDismissedById(map: DismissedMap) {
  localStorage.setItem(DISMISSED_BY_ID_KEY, JSON.stringify(map));
}

export function AnnouncementModal({ announcements }: { announcements: Announcement[] }) {
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [dismissedById, setDismissedById] = useState<DismissedMap>({});
  const [index, setIndex] = useState(0);
  const [dontShowAgainChecked, setDontShowAgainChecked] = useState(false);

  useEffect(() => {
    try {
      setHiddenIds(loadHiddenIds());
      setDismissedById(loadDismissedById());
    } catch {
      setHiddenIds(new Set());
      setDismissedById({});
    }
  }, []);

  const visible = useMemo(() => {
    const now = Date.now();
    const filtered = announcements.filter((a) => {
      if (hiddenIds.has(a.id)) return false;
      const until = dismissedById[a.id];
      if (until && until > now) return false;
      return true;
    });
    // Keep a stable order: priority desc, then starts_at desc, then created_at desc.
    return filtered.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      const aStart = a.starts_at ? new Date(a.starts_at).getTime() : 0;
      const bStart = b.starts_at ? new Date(b.starts_at).getTime() : 0;
      if (bStart !== aStart) return bStart - aStart;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [announcements, hiddenIds]);

  useEffect(() => {
    if (index >= visible.length) setIndex(0);
  }, [index, visible.length]);

  useEffect(() => {
    setDontShowAgainChecked(false);
  }, [index, visible.length]);

  if (visible.length === 0) return null;

  const current = visible[Math.min(index, visible.length - 1)];

  const closeForOneDay = () => {
    if (dontShowAgainChecked) {
      hidePermanently();
      return;
    }
    const oneDayMs = 24 * 60 * 60 * 1000;
    const until = Date.now() + oneDayMs;
    setDismissedById((prev) => {
      const next = { ...prev, [current.id]: until };
      saveDismissedById(next);
      return next;
    });
  };

  const hidePermanently = () => {
    const next = new Set(hiddenIds);
    next.add(current.id);
    saveHiddenIds(next);
    setHiddenIds(next);
    // After hiding, index will be adjusted by the other effect when visible changes
  };

  const prev = () => setIndex((i) => (i === 0 ? visible.length - 1 : i - 1));
  const next = () => setIndex((i) => (i === visible.length - 1 ? 0 : i + 1));

  const hasAction = Boolean(current.action_button_text?.trim()) && Boolean(current.action_button_link?.trim());

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-3 sm:px-4 py-6 bg-black/50 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeForOneDay();
      }}
    >
      <div className="w-full max-w-xl sm:max-w-2xl h-[80vh] sm:h-auto sm:max-h-[85vh] flex flex-col rounded-2xl bg-white dark:bg-neutral-950 shadow-2xl border border-gray-200/80 dark:border-neutral-800/80 overflow-hidden">
        {/* Header */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-neutral-800 bg-gradient-to-r from-sky-500/5 via-sky-500/10 to-transparent dark:from-sky-500/10 dark:via-sky-500/15">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-300 text-xs font-semibold">
                  {visible.length > 1 ? `${index + 1}/${visible.length}` : "Info"}
                </span>
                <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white truncate">
                  {current.title}
                </h2>
              </div>
              {/* Intentionally not showing start/end times to public users */}
            </div>
            <button
              onClick={closeForOneDay}
              className="shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 dark:border-neutral-700 bg-white/80 dark:bg-neutral-900/80 hover:bg-gray-50 dark:hover:bg-neutral-800 transition"
              aria-label="Close for 1 day"
            >
              <Icon icon={FaTimes} className="w-3.5 h-3.5 text-gray-500 dark:text-gray-300" />
            </button>
          </div>
        </div>

        {/* Body (scrollable) */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
          {current.image_url ? (
            <div className="w-full rounded-xl overflow-hidden border border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-900">
              <Image
                src={current.image_url}
                alt={current.title}
                width={1200}
                height={800}
                className="w-full h-auto"
                sizes="100vw"
              />
            </div>
          ) : null}

          {current.body ? (
            <div className="text-sm sm:text-[15px] text-gray-700 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">
              {current.body}
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-200 dark:border-neutral-800 bg-gray-50/80 dark:bg-neutral-900/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center sm:justify-start gap-2">
            {hasAction ? (
              <Link
                href={current.action_button_link as string}
                onClick={closeForOneDay}
                className="inline-flex items-center justify-center h-9 px-4 rounded-full bg-sky-600 hover:bg-sky-700 text-white text-xs sm:text-sm font-semibold shadow-sm shadow-sky-500/25 transition"
              >
                {current.action_button_text}
              </Link>
            ) : null}

            {visible.length > 1 ? (
              <>
                <button
                  onClick={prev}
                  className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs sm:text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-neutral-800 transition"
                  aria-label="Previous announcement"
                >
                  <Icon icon={FaChevronLeft} className="w-3.5 h-3.5" />
                  Previous
                </button>
                <button
                  onClick={next}
                  className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs sm:text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-neutral-800 transition"
                  aria-label="Next announcement"
                >
                  Next
                  <Icon icon={FaChevronRight} className="w-3.5 h-3.5" />
                </button>
                <div className="hidden sm:flex items-center gap-1 ml-2">
                  {visible.map((a, i) => (
                    <button
                      key={a.id}
                      onClick={() => setIndex(i)}
                      className={`h-1.5 w-1.5 rounded-full transition ${
                        i === index ? "bg-gray-900 dark:bg-white" : "bg-gray-300 dark:bg-neutral-700"
                      }`}
                      aria-label={`Go to announcement ${i + 1}`}
                    />
                  ))}
                </div>
              </>
            ) : null}
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-2">
            <label className="inline-flex items-center gap-2 h-9 px-3 rounded-full border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs sm:text-sm text-gray-700 dark:text-gray-200 select-none">
              <input
                type="checkbox"
                checked={dontShowAgainChecked}
                onChange={(e) => setDontShowAgainChecked(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-sky-600 focus:ring-sky-500"
              />
              Don't show again
            </label>
            <button
              onClick={closeForOneDay}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-gray-900 text-white dark:bg-white dark:text-black text-xs sm:text-sm font-medium hover:opacity-90 transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

