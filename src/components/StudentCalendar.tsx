// src/components/StudentCalendar.tsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useIsStaff } from "../hooks/useIsStaff";

type CalEvent = {
  id: string;
  scope: "personal" | "school";
  owner_id: string | null;
  title: string;
  description: string | null;
  start_at: string;
  end_at: string | null;
  all_day: boolean;
};

type StudyLog = {
  id: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  subject: string;
  minutes: number;
  memo: string | null;
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
  const dow = s.getDay(); // 0=Sun
  return addDays(s, -dow);
}
function endOfCalendarGrid(month: Date) {
  const e = endOfMonth(month);
  const dow = e.getDay();
  return addDays(e, 6 - dow);
}

function minutesToHhMm(total: number) {
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}分`;
  if (m === 0) return `${h}時間`;
  return `${h}時間${m}分`;
}

type Props = {
  userId: string; // 生徒ID（生徒本人の時も user.id を渡す）
  canEditPersonal: boolean; // 生徒本人 true / 先生が見るとき false 推奨（必要なら true でもOK）
  title?: string;
};

export default function StudentCalendar({
  userId,
  canEditPersonal,
  title = "カレンダー",
}: Props) {
  const { isStaff } = useIsStaff();

  const [month, setMonth] = useState(() => new Date());
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [logs, setLogs] = useState<StudyLog[]>([]);
  const [loading, setLoading] = useState(false);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // 追加フォーム（予定）
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [savingEvent, setSavingEvent] = useState(false);

  // 追加フォーム（勉強時間）
  const [subject, setSubject] = useState("");
  const [minutes, setMinutes] = useState<number>(60);
  const [memo, setMemo] = useState("");
  const [savingLog, setSavingLog] = useState(false);

  const range = useMemo(() => {
    const start = startOfCalendarGrid(month);
    const end = endOfCalendarGrid(month);
    return { start, end };
  }, [month]);

  // 月範囲のデータ読み込み：予定（personal+school）と勉強ログ
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

      const { data: ev, error: e1 } = await supabase
        .from("calendar_events")
        .select("id,scope,owner_id,title,description,start_at,end_at,all_day")
        .gte("start_at", startIso)
        .lte("start_at", endIso)
        .order("start_at", { ascending: true });

      if (e1) {
        console.error("❌ calendar_events load:", e1.message);
      }

      // 学習ログは date で範囲
      const startYmd = toYMD(range.start);
      const endYmd = toYMD(range.end);

      const { data: lg, error: e2 } = await supabase
        .from("study_logs")
        .select("id,user_id,date,subject,minutes,memo")
        .eq("user_id", userId)
        .gte("date", startYmd)
        .lte("date", endYmd)
        .order("date", { ascending: true });

      if (e2) {
        console.error("❌ study_logs load:", e2.message);
      }

      if (!cancelled) {
        // イベントは「生徒個人(owner_id=userId)」+「塾(school)」だけに絞る
        const evAll = (ev ?? []) as CalEvent[];
        const filtered = evAll.filter(
          (x) => x.scope === "school" || x.owner_id === userId
        );
        setEvents(filtered);
        setLogs((lg ?? []) as StudyLog[]);
      }

      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [month, range.start, range.end, userId]);

  // 日別合計（分）
  const totalMinutesByDate = useMemo(() => {
    const map: Record<string, number> = {};
    for (const l of logs) {
      map[l.date] = (map[l.date] ?? 0) + (l.minutes ?? 0);
    }
    return map;
  }, [logs]);

  // 日別イベント数（丸印に使う）
  const eventCountByDate = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of events) {
      const d = toYMD(new Date(e.start_at));
      map[d] = (map[d] ?? 0) + 1;
    }
    return map;
  }, [events]);

  const gridDays = useMemo(() => {
    const days: Date[] = [];
    const cur = new Date(range.start);
    while (cur <= range.end) {
      days.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }
    return days;
  }, [range.start, range.end]);

  const selectedEvents = useMemo(() => {
    if (!selectedDate) return [];
    return events.filter((e) => toYMD(new Date(e.start_at)) === selectedDate);
  }, [events, selectedDate]);

  const selectedLogs = useMemo(() => {
    if (!selectedDate) return [];
    return logs.filter((l) => l.date === selectedDate);
  }, [logs, selectedDate]);

  const selectedLogTotal = useMemo(() => {
    if (!selectedDate) return 0;
    return totalMinutesByDate[selectedDate] ?? 0;
  }, [selectedDate, totalMinutesByDate]);

  async function addPersonalEvent() {
    if (!selectedDate) return;
    if (!canEditPersonal) return;
    const t = newTitle.trim();
    if (!t) return;

    setSavingEvent(true);
    try {
      const start = new Date(`${selectedDate}T00:00:00`);
      const { error } = await supabase.from("calendar_events").insert({
        scope: "personal",
        owner_id: userId,
        title: t,
        description: newDesc.trim() || null,
        start_at: start.toISOString(),
        end_at: null,
        all_day: true,
      });

      if (error) throw error;

      setNewTitle("");
      setNewDesc("");
      // リロード（軽く再取得）
      setMonth((m) => new Date(m));
    } catch (e) {
      alert("予定追加に失敗: " + (e as Error).message);
    } finally {
      setSavingEvent(false);
    }
  }

  async function deleteEvent(evId: string) {
    // 生徒本人: 自分の personal なら削除可。先生は（ポリシー上は削除可）だが、UIは控えめに。
    const ok = confirm("この予定を削除しますか？");
    if (!ok) return;

    const { error } = await supabase.from("calendar_events").delete().eq("id", evId);
    if (error) {
      alert("削除失敗: " + error.message);
      return;
    }
    setMonth((m) => new Date(m));
  }

  async function addStudyLog() {
    if (!selectedDate) return;
    if (!canEditPersonal) return;

    const sub = subject.trim();
    const mins = Number(minutes);
    if (!sub || !Number.isFinite(mins) || mins <= 0) return;

    setSavingLog(true);
    try {
      const { error } = await supabase.from("study_logs").insert({
        user_id: userId,
        date: selectedDate,
        subject: sub,
        minutes: mins,
        memo: memo.trim() || null,
      });

      if (error) throw error;

      setSubject("");
      setMinutes(60);
      setMemo("");
      setMonth((m) => new Date(m));
    } catch (e) {
      alert("学習記録の追加に失敗: " + (e as Error).message);
    } finally {
      setSavingLog(false);
    }
  }

  function moveMonth(delta: number) {
    setSelectedDate(null);
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border rounded-2xl p-4">
        <div className="flex items-center justify-between">
          <div className="font-bold">{title}</div>
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
            const evCount = eventCountByDate[ymd] ?? 0;
            const totalMin = totalMinutesByDate[ymd] ?? 0;

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
                  {evCount > 0 && (
                    <div className="text-[10px] text-gray-500">
                      ●{evCount}
                    </div>
                  )}
                </div>
                <div className="mt-1 text-[11px] text-gray-700">
                  {totalMin > 0 ? minutesToHhMm(totalMin) : ""}
                </div>
              </button>
            );
          })}
        </div>

        {loading && <div className="text-sm text-gray-500 mt-3">読み込み中...</div>}
      </div>

      {/* 日詳細 */}
      {selectedDate && (
        <div className="bg-white border rounded-2xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="font-bold">{selectedDate}</div>
            <div className="text-sm text-gray-600">
              勉強合計：<span className="font-semibold">{minutesToHhMm(selectedLogTotal)}</span>
            </div>
          </div>

          {/* 予定 */}
          <div className="space-y-2">
            <div className="font-semibold text-sm">予定（個人 + 塾）</div>
            {selectedEvents.length === 0 ? (
              <div className="text-sm text-gray-500">予定はありません</div>
            ) : (
              <ul className="space-y-2">
                {selectedEvents.map((e) => (
                  <li key={e.id} className="border rounded-xl p-3">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold">
                        {e.title}
                        <span className="ml-2 text-xs text-gray-500">
                          {e.scope === "school" ? "（塾）" : "（個人）"}
                        </span>
                      </div>
                      {/* 生徒本人は personal を削除可。先生は一旦 UI では削除ボタン出さない */}
                      {canEditPersonal && e.scope === "personal" && (
                        <button
                          className="text-xs border rounded px-2 py-1 text-red-600"
                          onClick={() => deleteEvent(e.id)}
                        >
                          削除
                        </button>
                      )}
                      {isStaff && e.scope === "school" && (
                        <span className="text-xs text-gray-400">※塾予定の編集UIは別コンポーネント</span>
                      )}
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

            {/* 個人予定追加（生徒本人用） */}
            {canEditPersonal && (
              <div className="border rounded-2xl p-3 mt-2">
                <div className="text-sm font-semibold mb-2">個人予定を追加</div>
                <input
                  className="w-full border rounded px-3 py-2 text-sm"
                  placeholder="タイトル"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                />
                <textarea
                  className="w-full border rounded px-3 py-2 text-sm mt-2 h-20"
                  placeholder="説明（任意）"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                />
                <button
                  className="mt-2 w-full bg-black text-white rounded py-2 text-sm disabled:opacity-50"
                  disabled={savingEvent}
                  onClick={addPersonalEvent}
                >
                  {savingEvent ? "追加中..." : "追加"}
                </button>
              </div>
            )}
          </div>

          {/* 勉強内訳 */}
          <div className="space-y-2">
            <div className="font-semibold text-sm">勉強時間（内訳）</div>

            {selectedLogs.length === 0 ? (
              <div className="text-sm text-gray-500">記録はありません</div>
            ) : (
              <ul className="space-y-2">
                {selectedLogs.map((l) => (
                  <li key={l.id} className="border rounded-xl p-3">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold">{l.subject}</div>
                      <div className="text-sm">{minutesToHhMm(l.minutes)}</div>
                    </div>
                    {l.memo && (
                      <div className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{l.memo}</div>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {/* 勉強時間追加（生徒本人用） */}
            {canEditPersonal && (
              <div className="border rounded-2xl p-3 mt-2">
                <div className="text-sm font-semibold mb-2">勉強時間を追加</div>
                <input
                  className="w-full border rounded px-3 py-2 text-sm"
                  placeholder="教科（例：英語）"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
                <input
                  className="w-full border rounded px-3 py-2 text-sm mt-2"
                  type="number"
                  min={1}
                  placeholder="分（例：90）"
                  value={minutes}
                  onChange={(e) => setMinutes(Number(e.target.value))}
                />
                <textarea
                  className="w-full border rounded px-3 py-2 text-sm mt-2 h-20"
                  placeholder="メモ（任意）"
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                />
                <button
                  className="mt-2 w-full bg-black text-white rounded py-2 text-sm disabled:opacity-50"
                  disabled={savingLog}
                  onClick={addStudyLog}
                >
                  {savingLog ? "追加中..." : "追加"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
