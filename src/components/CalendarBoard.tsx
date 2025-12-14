import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import Button from "./ui/Button";
import Input, { Textarea } from "./ui/Input";
import StudySummaryForDate from "./StudySummaryForDate";

type Scope = "personal" | "school";

type EventRow = {
  id: string;
  scope: Scope;
  owner_id: string;
  title: string;
  description: string | null;
  start_at: string; // timestamptz
  end_at: string; // timestamptz
  all_day: boolean;
  day: string | null; // date
  start_time: string | null; // time
  end_time: string | null; // time
  created_at: string;
};

type Props = {
  viewerRole: "student" | "teacher" | "admin";
  ownerUserId: string; // 表示対象ユーザー（生徒なら自分、先生なら選択した生徒）
  canEditPersonal: boolean; // 生徒本人ならtrue
  canEditSchool: boolean; // teacher/adminならtrue
  // optional control from parent
  selectedDay?: string;
  onSelectDay?: (ymd: string) => void;
};

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function startOfCalendarGrid(month: Date): Date {
  const first = startOfMonth(month);
  const dow = first.getDay(); // 0 Sun
  return new Date(first.getFullYear(), first.getMonth(), first.getDate() - dow);
}

function formatHM(ts: string) {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export default function CalendarBoard({
  viewerRole,
  ownerUserId,
  canEditPersonal,
  canEditSchool,
  selectedDay,
  onSelectDay,
}: Props) {
  // viewerRole is accepted for future logic (permissions/UI) but currently unused
  void viewerRole;

  const [month, setMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [selectedDate, setSelectedDate] = useState<string>(() =>
    toISODate(new Date())
  );
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<EventRow | null>(null);

  const [formScope, setFormScope] = useState<Scope>("personal");
  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formAllDay, setFormAllDay] = useState(true);
  const [formStartTime, setFormStartTime] = useState("09:00");
  const [formEndTime, setFormEndTime] = useState("10:00");

  const monthRange = useMemo(() => {
    // grid 用に少し広めに取る
    const gridStart = startOfCalendarGrid(month);
    const gridEnd = new Date(
      gridStart.getFullYear(),
      gridStart.getMonth(),
      gridStart.getDate() + 41
    );
    return {
      start: gridStart.toISOString(),
      end: new Date(gridEnd.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      label: `${month.getFullYear()}年${month.getMonth() + 1}月`,
      gridStart,
    };
  }, [month]);

  const canCreatePersonal = canEditPersonal;
  const canCreateSchool = canEditSchool;

  const dateToEvents = useMemo(() => {
    const map: Record<string, EventRow[]> = {};
    for (const ev of events) {
      const day = ev.day ?? toISODate(new Date(ev.start_at));
      if (!map[day]) map[day] = [];
      map[day].push(ev);
    }
    Object.values(map).forEach((arr) =>
      arr.sort(
        (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
      )
    );
    return map;
  }, [events]);

  async function loadEvents() {
    if (!ownerUserId) return;
    setLoading(true);

    // personal(ownerUserId) + school(全員分)
    const { data, error } = await supabase
      .from("calendar_events")
      .select(
        "id,scope,owner_id,title,description,start_at,end_at,all_day,day,details,start_time,end_time,created_at"
      )
      .or(`and(scope.eq.personal,owner_id.eq.${ownerUserId}),scope.eq.school`)
      .gte("start_at", monthRange.start)
      .lte("start_at", monthRange.end)
      .order("start_at", { ascending: true });

    if (error) {
      console.error("❌ calendar_events load:", error.message);
      setEvents([]);
    } else {
      setEvents((data ?? []) as EventRow[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerUserId, monthRange.start, monthRange.end]);

  // If parent controls selectedDay, sync it into local state
  useEffect(() => {
    if (selectedDay && selectedDay !== selectedDate) setSelectedDate(selectedDay);
  }, [selectedDay, selectedDate]);

  function selectDate(ymd: string) {
    setSelectedDate(ymd);
    if (onSelectDay) onSelectDay(ymd);
  }

  function openNew(scope: Scope) {
    setEditing(null);
    setFormScope(scope);
    setFormTitle("");
    setFormDesc("");
    setFormAllDay(true);
    setFormStartTime("09:00");
    setFormEndTime("10:00");
    setOpenForm(true);
  }

  function openEdit(ev: EventRow) {
    setEditing(ev);
    setFormScope(ev.scope);
    setFormTitle(ev.title ?? "");
    setFormDesc(ev.description ?? "");
    setFormAllDay(!!ev.all_day);
    setFormStartTime(ev.start_time ?? formatHM(ev.start_at));
    setFormEndTime(ev.end_time ?? formatHM(ev.end_at));
    setOpenForm(true);
  }

  function closeForm() {
    setOpenForm(false);
    setEditing(null);
  }

  async function save() {
    if (!ownerUserId) return;

    // 権限ガード（UIだけでなく安全側）
    if (formScope === "personal" && !canEditPersonal) {
      alert("この生徒の個人予定は編集できません。");
      return;
    }
    if (formScope === "school" && !canEditSchool) {
      alert("塾予定は教師/管理者のみ編集できます。");
      return;
    }

    const day = selectedDate;
    const startAt = formAllDay
      ? new Date(`${day}T00:00:00`).toISOString()
      : new Date(`${day}T${formStartTime}:00`).toISOString();

    const endAt = formAllDay
      ? new Date(`${day}T23:59:59`).toISOString()
      : new Date(`${day}T${formEndTime}:00`).toISOString();

    const payload: Partial<EventRow> = {
      scope: formScope,
      // personal は ownerUserId（=生徒本人）で固定
      // school は作成者をowner_idにする（teacher/adminのuid）
      owner_id:
        formScope === "personal"
          ? ownerUserId
          : (await supabase.auth.getUser()).data.user?.id ?? ownerUserId,
      title: formTitle.trim() || "(無題)",
      description: formDesc.trim() || null,
      all_day: formAllDay,
      day,
      start_time: formAllDay ? null : formStartTime,
      end_time: formAllDay ? null : formEndTime,
      start_at: startAt,
      end_at: endAt,
    };

    const res = editing
      ? await supabase.from("calendar_events").update(payload).eq("id", editing.id)
      : await supabase.from("calendar_events").insert(payload);

    if (res.error) {
      alert("保存失敗: " + res.error.message);
      return;
    }

    closeForm();
    await loadEvents();
  }

  async function remove(ev: EventRow) {
    if (!confirm(`「${ev.title}」を削除しますか？`)) return;

    // 権限ガード
    if (ev.scope === "personal" && !canEditPersonal) {
      alert("この生徒の個人予定は削除できません。");
      return;
    }
    if (ev.scope === "school" && !canEditSchool) {
      alert("塾予定は教師/管理者のみ削除できます。");
      return;
    }

    const { error } = await supabase.from("calendar_events").delete().eq("id", ev.id);
    if (error) return alert("削除失敗: " + error.message);

    await loadEvents();
  }

  // 42セル(6週)のカレンダー生成
  const cells = useMemo(() => {
    const arr: { dateISO: string; inMonth: boolean }[] = [];
    const base = monthRange.gridStart;
    for (let i = 0; i < 42; i++) {
      const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i);
      const iso = toISODate(d);
      arr.push({
        dateISO: iso,
        inMonth: d.getMonth() === month.getMonth(),
      });
    }
    return arr;
  }, [monthRange.gridStart, month]);

  const selectedEvents = dateToEvents[selectedDate] ?? [];

  return (
    <div className="space-y-6">
      {/* Header（矢印を大きく＆中央寄せ） */}
      <div className="bg-white rounded-2xl">
        <div className="flex items-center justify-center gap-6 px-3 py-3">
          <button
            className="w-12 h-10 rounded-xl border bg-white text-2xl text-blue-600 grid place-items-center"
            aria-label="前の月"
            onClick={() => setMonth(addMonths(month, -1))}
          >
            ‹
          </button>

          <div className="text-center font-extrabold text-gray-900 min-w-[120px]">
            {monthRange.label}
          </div>

          <button
            className="w-12 h-10 rounded-xl border bg-white text-2xl text-blue-600 grid place-items-center"
            aria-label="次の月"
            onClick={() => setMonth(addMonths(month, 1))}
          >
            ›
          </button>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1 text-center text-xs">
        {["日", "月", "火", "水", "木", "金", "土"].map((w) => (
          <div key={w} className="py-2 font-semibold text-gray-600">
            {w}
          </div>
        ))}

        {cells.map((c) => {
          const evs = dateToEvents[c.dateISO] ?? [];
          const isSelected = c.dateISO === selectedDate;
          const dayNum = Number(c.dateISO.split("-")[2]);

          return (
            <button
              key={c.dateISO}
              onClick={() => selectDate(c.dateISO)}
              className={[
                  "min-h-[54px] rounded border text-center px-1 py-1",
                  c.inMonth ? "bg-white border-gray-200" : "bg-gray-50 text-gray-400 border-gray-100",
                  isSelected ? "ring-2 ring-blue-500 border-blue-500 bg-blue-50" : "",
                ].join(" ")}
            >
              <div className="text-xs font-semibold">{dayNum}</div>
              {evs.length > 0 && (
                <div className="text-[10px] text-gray-500 mt-1">{evs.length}件</div>
              )}

              {/* 予定の簡易表示（最大2件） */}
              <div className="mt-1 space-y-1">
                {evs.slice(0, 2).map((e) => (
                  <div
                    key={e.id}
                    className={[
                      "text-[10px] truncate rounded px-1 py-px",
                        e.scope === "school" ? "bg-blue-100 text-blue-700" : "bg-black text-white",
                    ].join(" ")}
                  >
                    {e.title}
                  </div>
                ))}
              </div>
            </button>
          );
        })}
      </div>

      {/* Create buttons（カレンダーの下側に移動） */}
      <div className="flex flex-wrap gap-2 pt-2">
        <button
          className={["btn-ghost px-3 py-2 text-sm font-semibold", !canCreatePersonal ? "opacity-50 cursor-not-allowed" : ""].join(" ")}
          onClick={() => {
            selectDate(toISODate(new Date()));
            openNew("personal");
          }}
          disabled={!canCreatePersonal}
        >
          ＋ 個人予定を追加
        </button>

        <button
          className={["btn-ghost px-3 py-2 text-sm font-semibold text-blue-600", !canCreateSchool ? "opacity-50 cursor-not-allowed" : ""].join(" ")}
          onClick={() => {
            selectDate(toISODate(new Date()));
            openNew("school");
          }}
          disabled={!canCreateSchool}
        >
          ＋ 塾予定を追加（先生）
        </button>

        {loading && (
          <span className="text-sm text-gray-500 ml-1">読み込み中...</span>
        )}
      </div>

      {/* Selected day panel */}
      <div className="bg-white border rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-bold text-blue-700">{selectedDate}</div>
            <StudySummaryForDate userId={ownerUserId} dateISO={selectedDate} />
          </div>
        </div>

        {selectedEvents.length === 0 ? (
          <p className="text-sm text-gray-500">予定はありません。</p>
        ) : (
          <ul className="space-y-2">
            {selectedEvents.map((e) => {
              const editable =
                (e.scope === "personal" && canEditPersonal) ||
                (e.scope === "school" && canEditSchool);

              return (
                <li key={e.id} className="border rounded-xl p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={[
                            "text-[10px] px-2 py-1 rounded-full",
                            e.scope === "school"
                              ? "bg-gray-100"
                              : "bg-black text-white",
                          ].join(" ")}
                        >
                          {e.scope === "school" ? "塾" : "個人"}
                        </span>
                        <div className="font-semibold truncate">{e.title}</div>
                      </div>

                      <div className="text-xs text-gray-600 mt-1">
                        {e.all_day
                          ? "終日"
                          : `${formatHM(e.start_at)} - ${formatHM(e.end_at)}`}
                      </div>

                      {e.description && (
                        <div className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">
                          {e.description}
                        </div>
                      )}
                    </div>

                    {editable && (
                      <div className="flex gap-2 shrink-0">
                        <button
                          className="border rounded px-3 py-1 text-sm"
                          onClick={() => openEdit(e)}
                        >
                          編集
                        </button>
                        <button
                          className="border rounded px-3 py-1 text-sm text-red-600"
                          onClick={() => remove(e)}
                        >
                          削除
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Form modal */}
      {openForm && (
        <div className="fixed inset-0 bg-black/40 grid place-items-center p-4 z-50">
          <div className="w-full max-w-lg bg-white rounded-2xl border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-bold">
                {editing ? "予定を編集" : "予定を追加"}（{selectedDate}）
              </div>
              <button className="border rounded px-3 py-1" onClick={closeForm}>
                閉じる
              </button>
            </div>

            <div className="flex gap-2">
              <button
                className={`px-3 py-2 rounded border text-sm ${
                  formScope === "personal" ? "bg-black text-white" : ""
                }`}
                onClick={() => setFormScope("personal")}
                disabled={!canCreatePersonal}
              >
                個人
              </button>
              <button
                className={`px-3 py-2 rounded border text-sm ${
                  formScope === "school" ? "bg-black text-white" : ""
                }`}
                onClick={() => setFormScope("school")}
                disabled={!canCreateSchool}
              >
                塾（先生）
              </button>
            </div>

            <div>
              <label className="block text-sm">タイトル</label>
              <Input
                className="mt-1"
                value={formTitle}
                onChange={(e) =>
                  setFormTitle((e.target as HTMLInputElement).value)
                }
              />
            </div>

            <div>
              <label className="block text-sm">詳細</label>
              <Textarea
                className="mt-1 h-24"
                value={formDesc}
                onChange={(e) =>
                  setFormDesc((e.target as HTMLTextAreaElement).value)
                }
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                id="allDay"
                type="checkbox"
                checked={formAllDay}
                onChange={(e) => setFormAllDay(e.target.checked)}
              />
              <label htmlFor="allDay" className="text-sm">
                終日
              </label>
            </div>

            {!formAllDay && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm">開始</label>
                  <input
                    type="time"
                    className="mt-1 w-full border rounded px-3 py-2"
                    value={formStartTime}
                    onChange={(e) => setFormStartTime(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm">終了</label>
                  <input
                    type="time"
                    className="mt-1 w-full border rounded px-3 py-2"
                    value={formEndTime}
                    onChange={(e) => setFormEndTime(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <Button onClick={save}>{editing ? "更新" : "追加"}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
