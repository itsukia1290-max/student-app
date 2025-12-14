// src/components/SchoolCalendar.tsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type CalEvent = {
  id: string;
  scope: "school";
  owner_id: string | null;
  title: string;
  description: string | null;
  start_at: string;
  end_at: string | null;
  all_day: boolean;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}
function toYMD(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}
function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}
function startOfCalendarGrid(month: Date) {
  const s = startOfMonth(month);
  const dow = s.getDay();
  return addDays(s, -dow);
}
function endOfCalendarGrid(month: Date) {
  const e = endOfMonth(month);
  const dow = e.getDay();
  return addDays(e, 6 - dow);
}

export default function SchoolCalendar() {
  const [month, setMonth] = useState(() => new Date());
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [saving, setSaving] = useState(false);

  const range = useMemo(() => {
    const start = startOfCalendarGrid(month);
    const end = endOfCalendarGrid(month);
    return { start, end };
  }, [month]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);

      const startIso = new Date(
        range.start.getFullYear(),
        range.start.getMonth(),
        range.start.getDate(),
        0,
        0,
        0
      ).toISOString();

      const endIso = new Date(
        range.end.getFullYear(),
        range.end.getMonth(),
        range.end.getDate(),
        23,
        59,
        59
      ).toISOString();

      const { data, error } = await supabase
        .from("calendar_events")
        .select("id,scope,owner_id,title,description,start_at,end_at,all_day")
        .eq("scope", "school")
        .gte("start_at", startIso)
        .lte("start_at", endIso)
        .order("start_at", { ascending: true });

      if (error) console.error("❌ school events load:", error.message);
      if (!cancelled) setEvents((data ?? []) as CalEvent[]);

      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [month, range.start, range.end]);

  const gridDays = useMemo(() => {
    const days: Date[] = [];
    const cur = new Date(range.start);
    while (cur <= range.end) {
      days.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }
    return days;
  }, [range.start, range.end]);

  const countByDate = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of events) {
      const d = toYMD(new Date(e.start_at));
      map[d] = (map[d] ?? 0) + 1;
    }
    return map;
  }, [events]);

  const selectedEvents = useMemo(() => {
    if (!selectedDate) return [];
    return events.filter((e) => toYMD(new Date(e.start_at)) === selectedDate);
  }, [events, selectedDate]);

  function moveMonth(delta: number) {
    setSelectedDate(null);
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));
  }

  async function addSchoolEvent() {
    if (!selectedDate) return;
    const t = title.trim();
    if (!t) return;

    setSaving(true);
    try {
      const start = new Date(`${selectedDate}T00:00:00`);
      const { error } = await supabase.from("calendar_events").insert({
        scope: "school",
        owner_id: null,
        title: t,
        description: desc.trim() || null,
        start_at: start.toISOString(),
        end_at: null,
        all_day: true,
      });
      if (error) throw error;

      setTitle("");
      setDesc("");
      setMonth((m) => new Date(m));
    } catch (e) {
      alert("塾予定の追加に失敗: " + (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteSchoolEvent(id: string) {
    const ok = confirm("この塾予定を削除しますか？");
    if (!ok) return;
    const { error } = await supabase.from("calendar_events").delete().eq("id", id);
    if (error) return alert("削除失敗: " + error.message);
    setMonth((m) => new Date(m));
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border rounded-2xl p-4">
        <div className="flex items-center justify-between">
          <div className="font-bold">塾カレンダー</div>
          <div className="flex items-center gap-2">
            <button className="border rounded px-2 py-1" onClick={() => moveMonth(-1)}>
              ←
            </button>
            <div className="text-sm font-semibold">
              {month.getFullYear()}年 {month.getMonth() + 1}月
            </div>
            <button className="border rounded px-2 py-1" onClick={() => moveMonth(1)}>
              →
            </button>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-7 text-xs text-center text-gray-500">
          {["日","月","火","水","木","金","土"].map((d) => (
            <div key={d} className="py-2">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {gridDays.map((d) => {
            const ymd = toYMD(d);
            const inMonth = d.getMonth() === month.getMonth();
            const isSelected = selectedDate === ymd;
            const count = countByDate[ymd] ?? 0;

            return (
              <button
                key={ymd}
                onClick={() => setSelectedDate(ymd)}
                className={[
                  "rounded-lg border bg-white p-2 text-left min-h-[64px]",
                  inMonth ? "" : "opacity-40",
                  isSelected ? "border-black" : "border-gray-200",
                ].join(" ")}
              >
                <div className="flex items-start justify-between">
                  <div className="text-sm font-semibold">{d.getDate()}</div>
                  {count > 0 && <div className="text-[10px] text-gray-500">●{count}</div>}
                </div>
              </button>
            );
          })}
        </div>

        {loading && <div className="text-sm text-gray-500 mt-3">読み込み中...</div>}
      </div>

      {selectedDate && (
        <div className="bg-white border rounded-2xl p-4 space-y-3">
          <div className="font-bold">{selectedDate}</div>

          {selectedEvents.length === 0 ? (
            <div className="text-sm text-gray-500">塾予定はありません</div>
          ) : (
            <ul className="space-y-2">
              {selectedEvents.map((e) => (
                <li key={e.id} className="border rounded-xl p-3">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">{e.title}</div>
                    <button
                      className="text-xs border rounded px-2 py-1 text-red-600"
                      onClick={() => deleteSchoolEvent(e.id)}
                    >
                      削除
                    </button>
                  </div>
                  {e.description && (
                    <div className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">
                      {e.description}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          <div className="border rounded-2xl p-3">
            <div className="text-sm font-semibold mb-2">塾予定を追加</div>
            <input
              className="w-full border rounded px-3 py-2 text-sm"
              placeholder="タイトル"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <textarea
              className="w-full border rounded px-3 py-2 text-sm mt-2 h-20"
              placeholder="説明（任意）"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
            />
            <button
              className="mt-2 w-full bg-black text-white rounded py-2 text-sm disabled:opacity-50"
              disabled={saving}
              onClick={addSchoolEvent}
            >
              {saving ? "追加中..." : "追加"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
