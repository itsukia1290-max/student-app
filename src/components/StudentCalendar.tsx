import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type Props = {
  ownerId: string;                 // このカレンダーの所有者（生徒ID）
  editable: boolean;               // 生徒本人なら true、先生が閲覧なら false（先生が編集もしたいなら true）
  scope: "student" | "school";     // 生徒個人予定 or 塾予定
};

type CalEvent = {
  id: string;
  owner_id: string | null;
  scope: "student" | "school";
  day: string; // YYYY-MM-DD
  title: string;
  details: string | null;
  start_time: string | null; // "HH:MM:SS"
  end_time: string | null;
  created_at: string;
};

function toYmd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function firstDayOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function daysInMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

export default function StudentCalendar({ ownerId, editable, scope }: Props) {
  const [month, setMonth] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState(() => toYmd(new Date()));
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(false);

  // 追加フォーム
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  const monthStart = useMemo(() => firstDayOfMonth(month), [month]);
  const monthKey = useMemo(
    () =>
      `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`,
    [month]
  );

  useEffect(() => {
    // 月が変わったら1日を選択
    const d = new Date(month.getFullYear(), month.getMonth(), 1);
    setSelectedDay(toYmd(d));
  }, [monthKey]);

  async function loadMonth() {
    setLoading(true);

    const start = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(
      2,
      "0"
    )}-01`;
    const end = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(daysInMonth(month)).padStart(2, "0")}`;

    let q = supabase
      .from("calendar_events")
      .select(
        "id,owner_id,scope,day,title,details,start_time,end_time,created_at"
      )
      .eq("scope", scope)
      .gte("day", start)
      .lte("day", end)
      .order("day", { ascending: true });

    // 生徒個人予定は owner_id で絞る
    if (scope === "student") q = q.eq("owner_id", ownerId);

    const { data, error } = await q;
    if (error) {
      console.error("❌ calendar load:", error.message);
      setEvents([]);
    } else {
      setEvents((data ?? []) as CalEvent[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadMonth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthKey, ownerId, scope]);

  const eventsByDay = useMemo(() => {
    const map: Record<string, CalEvent[]> = {};
    for (const e of events) (map[e.day] ||= []).push(e);
    return map;
  }, [events]);

  const dayEvents = eventsByDay[selectedDay] ?? [];

  async function addEvent() {
    const t = title.trim();
    if (!t) return;

    const payload = {
      scope,
      day: selectedDay,
      title: t,
      details: details.trim() || null,
      start_time: startTime ? `${startTime}:00` : null,
      end_time: endTime ? `${endTime}:00` : null,
      owner_id: scope === "student" ? ownerId : null, // 塾予定は owner_id null
    };

    const { error } = await supabase.from("calendar_events").insert(payload);
    if (error) {
      alert("追加失敗: " + error.message);
      return;
    }

    setTitle("");
    setDetails("");
    setStartTime("");
    setEndTime("");
    await loadMonth();
  }

  async function deleteEvent(id: string) {
    if (!confirm("この予定を削除しますか？")) return;
    const { error } = await supabase
      .from("calendar_events")
      .delete()
      .eq("id", id);
    if (error) {
      alert("削除失敗: " + error.message);
      return;
    }
    await loadMonth();
  }

  // カレンダーグリッド
  const grid = useMemo(() => {
    const first = monthStart.getDay(); // 0=Sun
    const total = daysInMonth(month);
    const cells: Array<{ ymd: string | null; label: string }> = [];
    for (let i = 0; i < first; i++) cells.push({ ymd: null, label: "" });
    for (let d = 1; d <= total; d++) {
      const date = new Date(month.getFullYear(), month.getMonth(), d);
      cells.push({ ymd: toYmd(date), label: String(d) });
    }
    return cells;
  }, [monthStart, month]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button
          className="border rounded px-3 py-1"
          onClick={() =>
            setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
          }
        >
          ←
        </button>

        <div className="font-semibold">
          {month.getFullYear()} / {month.getMonth() + 1}
          {loading && <span className="ml-2 text-xs text-gray-500">読込中</span>}
        </div>

        <button
          className="border rounded px-3 py-1"
          onClick={() =>
            setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
          }
        >
          →
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-sm">
        {["日", "月", "火", "水", "木", "金", "土"].map((w) => (
          <div key={w} className="text-gray-600">
            {w}
          </div>
        ))}

        {grid.map((c, idx) => {
          if (!c.ymd) return <div key={idx} className="h-10" />;
          const has = (eventsByDay[c.ymd]?.length ?? 0) > 0;
          const active = c.ymd === selectedDay;
          return (
            <button
              key={idx}
              className={`h-10 rounded border text-sm ${
                active ? "bg-black text-white" : "bg-white"
              } ${has && !active ? "font-semibold" : ""}`}
              onClick={() => setSelectedDay(c.ymd!)}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      <div className="bg-white border rounded-2xl p-3">
        <div className="flex items-center justify-between">
          <div className="font-semibold">{selectedDay}</div>
        </div>

        {dayEvents.length === 0 ? (
          <p className="text-sm text-gray-500 mt-2">予定はありません。</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {dayEvents.map((e) => (
              <li key={e.id} className="border rounded-lg p-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{e.title}</div>

                    {(e.start_time || e.end_time) && (
                      <div className="text-xs text-gray-500">
                        {e.start_time?.slice(0, 5) ?? "--:--"} -{" "}
                        {e.end_time?.slice(0, 5) ?? "--:--"}
                      </div>
                    )}

                    {e.details && (
                      <div className="text-xs text-gray-600 mt-1 whitespace-pre-wrap">
                        {e.details}
                      </div>
                    )}
                  </div>

                  {editable && (
                    <button
                      className="text-xs border rounded px-2 py-1 text-red-600"
                      onClick={() => deleteEvent(e.id)}
                    >
                      削除
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {editable && (
          <div className="mt-3 border-t pt-3 space-y-2">
            <div className="text-sm font-semibold">予定を追加</div>

            <input
              className="w-full border rounded px-3 py-2"
              placeholder="タイトル"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />

            <textarea
              className="w-full border rounded px-3 py-2 h-20"
              placeholder="詳細（任意）"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
            />

            <div className="flex gap-2">
              <input
                type="time"
                className="border rounded px-3 py-2 w-full"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
              <input
                type="time"
                className="border rounded px-3 py-2 w-full"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>

            <button
              className="w-full bg-black text-white rounded py-2"
              onClick={addEvent}
            >
              追加
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
