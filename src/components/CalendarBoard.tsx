/*
 * src/components/CalendarBoard.tsx
 * Responsibility:
 * - 月カレンダー表示 / 日付選択 / 予定一覧表示 / 追加編集モーダル
 * - “誰が誰の予定を見ているか” などの判断は Props.permissions に集約
 *
 * Data model:
 * - calendar_events: scope = 'personal' | 'school'
 * - personal: owner_id = 生徒本人
 * - school:   owner_id = 作成者(先生)などでもOK（全員が閲覧する想定）
 */

import React, { useEffect, useMemo, useState } from "react";
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

export type CalendarPermissions = {
  viewPersonal: boolean;
  editPersonal: boolean;
  viewSchool: boolean;
  editSchool: boolean;
};

type Props = {
  ownerUserId: string; // 表示対象ユーザー（生徒なら自分、先生なら選択した生徒）
  permissions?: CalendarPermissions; // ★ ここが重要：optional にする
  selectedDay?: string;
  onSelectDay?: (ymd: string) => void;
};

const DEFAULT_PERMISSIONS: CalendarPermissions = {
  viewPersonal: false,
  editPersonal: false,
  viewSchool: false,
  editSchool: false,
};

/** ErrorBoundary：子コンポーネントが落ちても画面全体を真っ白にしない */
class SafeBoundary extends React.Component<
  { fallback?: React.ReactNode; children: React.ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { fallback?: React.ReactNode; children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: "" };
  }
  static getDerivedStateFromError(err: Error) {
    return { hasError: true, message: String(err?.message ?? err) };
  }
  componentDidCatch(err: Error) {
    console.error("❌ CalendarBoard child crashed:", err);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            border: "1px solid #fecaca",
            background: "#fff1f2",
            color: "#9f1239",
            borderRadius: 12,
            padding: 12,
            fontSize: 12,
            lineHeight: 1.6,
          }}
        >
          <div style={{ fontWeight: 900, marginBottom: 6 }}>
            画面の一部でエラーが発生しました（落ちないように保護中）
          </div>
          <div style={{ whiteSpace: "pre-wrap" }}>{this.state.message}</div>
          {this.props.fallback ?? null}
        </div>
      );
    }
    return this.props.children;
  }
}

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

function canAddOnDay(dayISO: string) {
  const today = toISODate(new Date());
  return dayISO >= today; // 未来/当日だけOK（過去追加は不可）
}

function navBtnStyle(color: string): React.CSSProperties {
  return {
    width: 48,
    height: 40,
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    backgroundColor: "#ffffff",
    fontSize: 24,
    color,
    display: "grid",
    placeItems: "center",
    cursor: "pointer",
    userSelect: "none",
  };
}

export default function CalendarBoard({
  ownerUserId,
  permissions,
  selectedDay,
  onSelectDay,
}: Props) {
  // ★ ここが最重要：permissions が undefined でも絶対落ちない
  const perms = permissions ?? DEFAULT_PERMISSIONS;
  const { viewPersonal, editPersonal, viewSchool, editSchool } = perms;

  const [month, setMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [selectedDate, setSelectedDate] = useState<string>(() =>
    selectedDay ? selectedDay : toISODate(new Date())
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

    const ors: string[] = [];
    if (viewPersonal) ors.push(`and(scope.eq.personal,owner_id.eq.${ownerUserId})`);
    if (viewSchool) ors.push(`scope.eq.school`);

    if (ors.length === 0) {
      setEvents([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("calendar_events")
      .select(
        "id,scope,owner_id,title,description,start_at,end_at,all_day,day,start_time,end_time,created_at"
      )
      .or(ors.join(","))
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
  }, [ownerUserId, monthRange.start, monthRange.end, viewPersonal, viewSchool]);

  useEffect(() => {
    if (selectedDay && selectedDay !== selectedDate) setSelectedDate(selectedDay);
  }, [selectedDay, selectedDate]);

  function selectDate(ymd: string) {
    setSelectedDate(ymd);
    onSelectDay?.(ymd);
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

  function canEditScope(scope: Scope) {
    return scope === "personal" ? editPersonal : editSchool;
  }

  function canEditOnSelectedDay() {
    return canAddOnDay(selectedDate);
  }

  async function save() {
    if (!ownerUserId) return;

    if (!canEditOnSelectedDay()) {
      alert("過去の日付には追加できません。未来の日付を選んでください。");
      return;
    }

    if (!canEditScope(formScope)) {
      alert(
        formScope === "personal"
          ? "個人予定は編集できません。"
          : "塾予定は編集できません。"
      );
      return;
    }

    const day = selectedDate;
    const startAt = formAllDay
      ? new Date(`${day}T00:00:00`).toISOString()
      : new Date(`${day}T${formStartTime}:00`).toISOString();

    const endAt = formAllDay
      ? new Date(`${day}T23:59:59`).toISOString()
      : new Date(`${day}T${formEndTime}:00`).toISOString();

    const currentUserId =
      (await supabase.auth.getUser()).data.user?.id ?? ownerUserId;

    const payload: Partial<EventRow> = {
      scope: formScope,
      owner_id: formScope === "personal" ? ownerUserId : currentUserId,
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

    if (!canEditScope(ev.scope)) {
      alert(
        ev.scope === "personal"
          ? "個人予定は削除できません。"
          : "塾予定は削除できません。"
      );
      return;
    }

    const { error } = await supabase
      .from("calendar_events")
      .delete()
      .eq("id", ev.id);
    if (error) return alert("削除失敗: " + error.message);

    await loadEvents();
  }

  const cells = useMemo(() => {
    const arr: { dateISO: string; inMonth: boolean }[] = [];
    const base = monthRange.gridStart;
    for (let i = 0; i < 42; i++) {
      const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i);
      const iso = toISODate(d);
      arr.push({ dateISO: iso, inMonth: d.getMonth() === month.getMonth() });
    }
    return arr;
  }, [monthRange.gridStart, month]);

  const selectedEvents = dateToEvents[selectedDate] ?? [];
  const canCreatePersonal = editPersonal && canEditOnSelectedDay();
  const canCreateSchool = editSchool && canEditOnSelectedDay();

  const nothingViewable = !viewPersonal && !viewSchool;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* permissions未設定 / 全false のときに「白紙っぽい」を防ぐ */}
      {nothingViewable && (
        <div
          style={{
            border: "1px solid #fde68a",
            background: "#fffbeb",
            color: "#92400e",
            borderRadius: 12,
            padding: 12,
            fontSize: 12,
            lineHeight: 1.6,
          }}
        >
          <div style={{ fontWeight: 900, marginBottom: 6 }}>
            カレンダー権限がありません（permissions が未設定 or 全て false）
          </div>
          <div>
            呼び出し側で <code>permissions</code> を渡してください。
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ backgroundColor: "#ffffff", borderRadius: 16 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 24,
            padding: 12,
          }}
        >
          <button
            style={navBtnStyle("#3b82f6")}
            aria-label="前の月"
            onClick={() => setMonth(addMonths(month, -1))}
          >
            ‹
          </button>

          <div style={{ textAlign: "center", fontWeight: 900, color: "#0f172a", minWidth: 120 }}>
            {monthRange.label}
          </div>

          <button
            style={navBtnStyle("#3b82f6")}
            aria-label="次の月"
            onClick={() => setMonth(addMonths(month, 1))}
          >
            ›
          </button>
        </div>
      </div>

      {/* Calendar grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, textAlign: "center" }}>
        {["日", "月", "火", "水", "木", "金", "土"].map((w) => (
          <div key={w} style={{ padding: "8px 0", fontWeight: 700, color: "#6b7280", fontSize: 12 }}>
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
              style={{
                minHeight: 60,
                borderRadius: 12,
                border: "1px solid",
                borderColor: c.inMonth ? (isSelected ? "#3b82f6" : "#e5e7eb") : "#e5e7eb",
                padding: 8,
                backgroundColor: isSelected ? "#eff6ff" : c.inMonth ? "#ffffff" : "#f9fafb",
                color: c.inMonth ? "#0f172a" : "#94a3b8",
                cursor: "pointer",
                boxShadow: isSelected ? "0 0 0 2px rgba(59,130,246,0.35)" : "none",
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 900 }}>{dayNum}</div>

              {evs.length > 0 && (
                <div style={{ fontSize: 10, color: "#64748b", marginTop: 4, fontWeight: 800 }}>
                  {evs.length}件
                </div>
              )}

              <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                {evs.slice(0, 2).map((e) => (
                  <div
                    key={e.id}
                    style={{
                      fontSize: 10,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      borderRadius: 8,
                      padding: "3px 6px",
                      backgroundColor: e.scope === "school" ? "rgba(59,130,246,0.14)" : "#0f172a",
                      color: e.scope === "school" ? "#1d4ed8" : "#ffffff",
                      fontWeight: 800,
                    }}
                    title={e.title}
                  >
                    {e.title}
                  </div>
                ))}
              </div>
            </button>
          );
        })}
      </div>

      {/* Create buttons */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        {viewPersonal && (
          <button
            onClick={() => openNew("personal")}
            disabled={!canCreatePersonal}
            title={!canEditOnSelectedDay() ? "過去の日付には追加できません" : undefined}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              background: "#ffffff",
              fontWeight: 800,
              fontSize: 12,
              opacity: canCreatePersonal ? 1 : 0.5,
              cursor: canCreatePersonal ? "pointer" : "not-allowed",
            }}
          >
            ＋ 個人予定を追加
          </button>
        )}

        {viewSchool && (
          <button
            onClick={() => openNew("school")}
            disabled={!canCreateSchool}
            title={!canEditOnSelectedDay() ? "過去の日付には追加できません" : undefined}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              background: "#ffffff",
              fontWeight: 900,
              fontSize: 12,
              color: "#2563eb",
              opacity: canCreateSchool ? 1 : 0.5,
              cursor: canCreateSchool ? "pointer" : "not-allowed",
            }}
          >
            ＋ 塾予定を追加
          </button>
        )}

        {loading && <span style={{ fontSize: 12, color: "#6b7280" }}>読み込み中...</span>}
      </div>

      {/* Selected day panel */}
      <div style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 16 }}>
        <div style={{ fontWeight: 900, color: "#1d4ed8", marginBottom: 8 }}>{selectedDate}</div>

        <SafeBoundary
          fallback={
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 8 }}>
              （StudySummaryForDate が原因ならここに出ます）
            </div>
          }
        >
          <StudySummaryForDate userId={ownerUserId} dateISO={selectedDate} />
        </SafeBoundary>

        {selectedEvents.length === 0 ? (
          <div style={{ marginTop: 10, fontSize: 12, color: "#6b7280" }}>予定はありません。</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
            {selectedEvents.map((e) => {
              const editable = canEditScope(e.scope);
              return (
                <div key={e.id} style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span
                          style={{
                            fontSize: 10,
                            padding: "4px 8px",
                            borderRadius: 999,
                            background: e.scope === "school" ? "#eff6ff" : "#0f172a",
                            color: e.scope === "school" ? "#1d4ed8" : "#ffffff",
                            fontWeight: 900,
                          }}
                        >
                          {e.scope === "school" ? "塾" : "個人"}
                        </span>

                        <div
                          style={{
                            fontWeight: 900,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {e.title}
                        </div>
                      </div>

                      <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                        {e.all_day ? "終日" : `${formatHM(e.start_at)} - ${formatHM(e.end_at)}`}
                      </div>

                      {e.description && (
                        <div style={{ marginTop: 8, fontSize: 13, color: "#334155", whiteSpace: "pre-wrap" }}>
                          {e.description}
                        </div>
                      )}
                    </div>

                    {editable && (
                      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                        <button
                          onClick={() => openEdit(e)}
                          style={{
                            padding: "8px 10px",
                            borderRadius: 10,
                            border: "1px solid #e5e7eb",
                            background: "#ffffff",
                            fontWeight: 800,
                            fontSize: 12,
                            cursor: "pointer",
                          }}
                        >
                          編集
                        </button>
                        <button
                          onClick={() => remove(e)}
                          style={{
                            padding: "8px 10px",
                            borderRadius: 10,
                            border: "1px solid #e5e7eb",
                            background: "#ffffff",
                            fontWeight: 900,
                            fontSize: 12,
                            color: "#dc2626",
                            cursor: "pointer",
                          }}
                        >
                          削除
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Form modal */}
      {openForm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "grid",
            placeItems: "center",
            padding: 16,
            zIndex: 50,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 680,
              background: "#ffffff",
              borderRadius: 16,
              border: "1px solid #e5e7eb",
              padding: 16,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <div style={{ fontWeight: 900 }}>
                {editing ? "予定を編集" : "予定を追加"}（{selectedDate}）
              </div>
              <button
                onClick={closeForm}
                style={{
                  padding: "8px 10px",
                  borderRadius: 10,
                  border: "1px solid #e5e7eb",
                  background: "#ffffff",
                  fontWeight: 800,
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                閉じる
              </button>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setFormScope("personal")}
                disabled={!editPersonal}
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid #e5e7eb",
                  background: formScope === "personal" ? "#0f172a" : "#ffffff",
                  color: formScope === "personal" ? "#ffffff" : "#0f172a",
                  fontWeight: 900,
                  opacity: editPersonal ? 1 : 0.5,
                  cursor: editPersonal ? "pointer" : "not-allowed",
                }}
              >
                個人
              </button>

              <button
                onClick={() => setFormScope("school")}
                disabled={!editSchool}
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid #e5e7eb",
                  background: formScope === "school" ? "#0f172a" : "#ffffff",
                  color: formScope === "school" ? "#ffffff" : "#0f172a",
                  fontWeight: 900,
                  opacity: editSchool ? 1 : 0.5,
                  cursor: editSchool ? "pointer" : "not-allowed",
                }}
              >
                塾
              </button>
            </div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 6 }}>タイトル</div>
              <Input
                value={formTitle}
                onChange={(e) => setFormTitle((e.target as HTMLInputElement).value)}
              />
            </div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 6 }}>詳細</div>
              <Textarea
                className="h-24"
                value={formDesc}
                onChange={(e) => setFormDesc((e.target as HTMLTextAreaElement).value)}
              />
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 800 }}>
              <input
                type="checkbox"
                checked={formAllDay}
                onChange={(e) => setFormAllDay(e.target.checked)}
              />
              終日
            </label>

            {!formAllDay && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 6 }}>開始</div>
                  <input
                    type="time"
                    value={formStartTime}
                    onChange={(e) => setFormStartTime(e.target.value)}
                    style={{
                      width: "100%",
                      border: "1px solid #e5e7eb",
                      borderRadius: 12,
                      padding: "10px 12px",
                      fontWeight: 800,
                    }}
                  />
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 6 }}>終了</div>
                  <input
                    type="time"
                    value={formEndTime}
                    onChange={(e) => setFormEndTime(e.target.value)}
                    style={{
                      width: "100%",
                      border: "1px solid #e5e7eb",
                      borderRadius: 12,
                      padding: "10px 12px",
                      fontWeight: 800,
                    }}
                  />
                </div>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <Button onClick={save}>{editing ? "更新" : "追加"}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
