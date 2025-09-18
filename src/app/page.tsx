import Image from "next/image";

export default function Home() {
  return (
    <div className="px-6 py-16 max-w-6xl mx-auto">
      <div className="relative overflow-hidden rounded-3xl border p-10 bg-gradient-to-tr from-violet-50 to-fuchsia-50 dark:from-[#0f0f14] dark:to-[#140f14]">
        <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-fuchsia-500/20 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-violet-500/20 blur-3xl" />
        <h1 className="text-4xl font-semibold tracking-tight">Run your team on ShiftFlow</h1>
        <p className="mt-3 text-gray-600 max-w-xl">Modern staff and shift management with a sleek weekly calendar, smart availability, and quick editing.</p>
        <div className="mt-8 flex gap-3">
          <a className="h-11 px-5 rounded-xl bg-black text-white dark:bg-white dark:text-black inline-flex items-center" href="/calendar">Open Calendar</a>
          <a className="h-11 px-5 rounded-xl border inline-flex items-center" href="/staff">Manage Staff</a>
        </div>
      </div>

      <div className="mt-10 grid sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border p-6 bg-white/60 dark:bg-black/20">
          <div className="text-xs uppercase tracking-wide text-gray-500">Scheduling</div>
          <div className="text-xl font-semibold mt-1">Drag, edit, assign</div>
        </div>
        <div className="rounded-2xl border p-6 bg-white/60 dark:bg-black/20">
          <div className="text-xs uppercase tracking-wide text-gray-500">Team</div>
          <div className="text-xl font-semibold mt-1">Rates & availability</div>
        </div>
        <div className="rounded-2xl border p-6 bg-white/60 dark:bg-black/20">
          <div className="text-xs uppercase tracking-wide text-gray-500">Secure</div>
          <div className="text-xl font-semibold mt-1">Supabase auth & RLS</div>
        </div>
      </div>
    </div>
  );
}
