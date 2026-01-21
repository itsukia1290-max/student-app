/*
 * src/pages/StudentDetail.tsx
 * - 初期表示は「レポート」
 * - タブ順：レポート / 成績 / 目標 / プロフィール
 * - 所属グループ取得は 1クエリ（group_members → groups のJOIN）
 */

import { useEffect, useState } from "react";
import { useIsStaff } from "../hooks/useIsStaff";
import { supabase } from "../lib/supabase";
import StudentGrades from "../components/StudentGrades";
import StudentGoals from "../components/StudentGoals";
import ReportView from "../components/report/ReportView";
import CalendarBoard from "../components/CalendarBoard";

type Props = {
  student: {
    id: string;
    name: string | null;
    phone: string | null;
    memo: string | null;
  };
  onBack: () => void;
};

type Tab = "report" | "grades" | "goals" | "profile";

type GroupMini = {
  id: string;
  name: string;
  type: "class" | "dm" | string;
};

export default function StudentDetail({ student, onBack }: Props) {
  const { isStaff } = useIsStaff();
  const [tab, setTab] = useState<Tab>("report");

  // ===== profile form =====
  const [formName, setFormName] = useState(student.name ?? "");
  const [formPhone, setFormPhone] = useState(student.phone ?? "");
  const [formMemo, setFormMemo] = useState(student.memo ?? "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);

  useEffect(() => {
    setFormName(student.name ?? "");
    setFormPhone(student.phone ?? "");
    setFormMemo(student.memo ?? "");
  }, [student]);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!isStaff) return;

    setSavingProfile(true);
    setProfileMsg(null);

    const { error } = await supabase
      .from("profiles")
      .update({
        name: formName,
        phone: formPhone || null,
        memo: formMemo || null,
      })
      .eq("id", student.id);

    if (error) setProfileMsg("プロフィール保存に失敗しました: " + error.message);
    else setProfileMsg("プロフィールを保存しました。");
    setSavingProfile(false);
  }

  // ===== groups (1 query) =====
  const [groups, setGroups] = useState<GroupMini[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setGroupsLoading(true);

      // group_members から groups をJOINして取る（1回）
      const { data, error } = await supabase
        .from("group_members")
        .select("groups(id,name,type)")
        .eq("user_id", student.id);

      if (error) {
        console.error("❌ load student groups:", error.message);
        if (!cancelled) setGroups([]);
        setGroupsLoading(false);
        return;
      }

      const list: GroupMini[] = (data ?? [])
        .flatMap((r) => (Array.isArray(r?.groups) ? r.groups : r?.groups ? [r.groups] : []))
        .filter(Boolean)
        .map((g) => ({
          id: g.id as string,
          name: (g.name ?? "(名称未設定)") as string,
          type: (g.type ?? "class") as string,
        }))
        .sort((a, b) => a.name.localeCompare(b.name, "ja"));

      if (!cancelled) setGroups(list);
      setGroupsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [student.id]);

  return (
    <div style={{ padding: "16px", paddingBottom: "80px" }}>
      {/* ===== Top bar ===== */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
        <button
          onClick={onBack}
          style={{
            border: "1px solid rgba(148,163,184,0.35)",
            backgroundColor: "#ffffff",
            borderRadius: "9999px",
            padding: "10px 14px",
            fontWeight: 800,
            cursor: "pointer",
            boxShadow: "0 10px 30px rgba(15, 23, 42, 0.05)",
          }}
        >
          ← 一覧に戻る
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
          <div
            style={{
              width: "42px",
              height: "42px",
              borderRadius: "9999px",
              backgroundColor: "rgba(59,130,246,0.10)",
              display: "grid",
              placeItems: "center",
              color: "#2563eb",
              fontWeight: 900,
              fontSize: "16px",
              flexShrink: 0,
            }}
          >
            {(student.name ?? "？").slice(0, 1)}
          </div>

          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: "22px", fontWeight: 900, color: "#0f172a" }}>
              {student.name ?? "（未設定）"}
            </div>
            <div style={{ fontSize: "13px", color: "#64748b", fontWeight: 700 }}>
              生徒詳細（先生用）
            </div>
          </div>
        </div>

        {/* ===== Tabs (レポート/成績/目標/プロフィール) ===== */}
        <div
          style={{
            display: "flex",
            gap: "6px",
            padding: "6px",
            borderRadius: "9999px",
            backgroundColor: "rgba(255,255,255,0.75)",
            border: "1px solid rgba(148,163,184,0.20)",
            boxShadow: "0 10px 30px rgba(15, 23, 42, 0.05)",
          }}
        >
          <TabBtn active={tab === "report"} onClick={() => setTab("report")}>
            レポート
          </TabBtn>
          <TabBtn active={tab === "grades"} onClick={() => setTab("grades")}>
            成績
          </TabBtn>
          <TabBtn active={tab === "goals"} onClick={() => setTab("goals")}>
            目標
          </TabBtn>
          <TabBtn active={tab === "profile"} onClick={() => setTab("profile")}>
            プロフィール
          </TabBtn>
        </div>
      </div>

      {/* ===== Body ===== */}
      <div style={{ marginTop: "16px" }}>
        {tab === "report" && (
          <ReportView
            ownerUserId={student.id}
            mode="teacher"
            showTimeline={false}
            showGrades={true}
            showCalendar={true}
            calendarPermissions={{
              viewPersonal: true,
              editPersonal: false,
              viewSchool: true,
              editSchool: true,
            }}
          />
        )}

        {tab === "grades" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <Card>
              <div style={{ fontSize: "16px", fontWeight: 900, color: "#0f172a", marginBottom: "10px" }}>
                問題集の成績
              </div>
              <StudentGrades userId={student.id} editable={true} />
            </Card>
          </div>
        )}

        {tab === "goals" && (
          <Card>
            <div style={{ fontSize: "16px", fontWeight: 900, color: "#0f172a", marginBottom: "10px" }}>
              目標
            </div>
            <StudentGoals userId={student.id} editable={true} />
          </Card>
        )}

        {tab === "profile" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <Card>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
                <div style={{ fontSize: "16px", fontWeight: 900, color: "#0f172a" }}>
                  プロフィール
                </div>
                <div style={{ fontSize: "12px", color: "#64748b", fontWeight: 800 }}>
                  先生のみ編集可
                </div>
              </div>

              <form onSubmit={saveProfile} style={{ marginTop: "14px", display: "grid", gap: "12px", maxWidth: "720px" }}>
                <Field label="氏名">
                  <input
                    style={inputStyle()}
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                  />
                </Field>

                <Field label="電話番号">
                  <input
                    style={inputStyle()}
                    placeholder="例）090-xxxx-xxxx"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                  />
                </Field>

                <Field label="メモ">
                  <textarea
                    style={{ ...inputStyle(), minHeight: "120px", resize: "vertical" }}
                    value={formMemo}
                    onChange={(e) => setFormMemo(e.target.value)}
                  />
                </Field>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                  <button
                    type="submit"
                    disabled={savingProfile}
                    style={{
                      border: "none",
                      backgroundColor: "#60a5fa",
                      color: "#ffffff",
                      borderRadius: "9999px",
                      padding: "10px 16px",
                      fontWeight: 900,
                      cursor: "pointer",
                      opacity: savingProfile ? 0.6 : 1,
                    }}
                  >
                    {savingProfile ? "保存中..." : "保存"}
                  </button>
                </div>

                {profileMsg && (
                  <div style={{ fontSize: "13px", color: "#334155", fontWeight: 800 }}>
                    {profileMsg}
                  </div>
                )}
              </form>
            </Card>

            <Card>
              <div style={{ fontSize: "16px", fontWeight: 900, color: "#0f172a", marginBottom: "10px" }}>
                所属グループ
              </div>

              {groupsLoading ? (
                <div style={{ fontSize: "13px", color: "#64748b", fontWeight: 800 }}>
                  読み込み中...
                </div>
              ) : groups.length === 0 ? (
                <div style={{ fontSize: "13px", color: "#64748b", fontWeight: 800 }}>
                  所属グループはありません。
                </div>
              ) : (
                <ul style={{ marginTop: "8px", paddingLeft: "18px", display: "grid", gap: "6px" }}>
                  {groups.map((g) => (
                    <li key={g.id} style={{ fontSize: "14px", fontWeight: 800, color: "#0f172a" }}>
                      {g.name}
                      {g.type === "dm" && (
                        <span style={{ marginLeft: "8px", fontSize: "12px", color: "#64748b", fontWeight: 900 }}>
                          （DM）
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card tone="soft">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
                <div style={{ fontSize: "16px", fontWeight: 900, color: "#0f172a" }}>カレンダー</div>
                <div style={{ fontSize: "12px", color: "#64748b", fontWeight: 900 }}>
                  personal=閲覧 / 塾=編集（先生）
                </div>
              </div>

              <div style={{ marginTop: "12px" }}>
                <CalendarBoard
                  ownerUserId={student.id}
                  permissions={{
                    viewPersonal: true,
                    editPersonal: false,
                    viewSchool: true,
                    editSchool: true,
                  }}
                />
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

/* ================= UI helpers ================= */

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        border: "none",
        backgroundColor: active ? "rgba(59,130,246,0.14)" : "transparent",
        color: active ? "#1d4ed8" : "#0f172a",
        borderRadius: "9999px",
        padding: "10px 14px",
        fontWeight: 900,
        fontSize: "13px",
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}

function Card({
  children,
  tone = "white",
}: {
  children: React.ReactNode;
  tone?: "white" | "soft";
}) {
  const bg = tone === "soft" ? "rgba(243,246,255,0.70)" : "#ffffff";
  return (
    <section
      style={{
        borderRadius: "18px",
        backgroundColor: bg,
        padding: "16px",
        boxShadow: "0 10px 30px rgba(15, 23, 42, 0.06)",
        border: "1px solid rgba(148, 163, 184, 0.18)",
      }}
    >
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: "12px", alignItems: "start" }}>
      <div style={{ fontSize: "13px", fontWeight: 900, color: "#0f172a", paddingTop: "10px" }}>
        {label}
      </div>
      <div>{children}</div>
    </label>
  );
}

function inputStyle(): React.CSSProperties {
  return {
    width: "100%",
    border: "1px solid rgba(148,163,184,0.35)",
    borderRadius: "14px",
    padding: "12px 14px",
    fontSize: "14px",
    fontWeight: 800,
    outline: "none",
    backgroundColor: "rgba(255,255,255,0.9)",
  };
}
