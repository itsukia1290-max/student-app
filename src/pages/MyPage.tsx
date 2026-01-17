/*
 * src/pages/MyPage.tsx
 * - スタッフ用: プロフィール編集のみ（最小）
 * - 生徒用: プロフィール / 目標 / 成績 / 記録（StudyLogs + Calendar）
 * - UIは MyPage が統一（カード/余白/タブ/ヘッダー）
 */

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { useIsStaff } from "../hooks/useIsStaff";

import StudentGrades from "../components/StudentGrades";
import StudentGoals from "../components/StudentGoals";
import StudentGroups from "../components/StudentGroups";
import StudentStudyLogs from "../components/StudentStudyLogs";
import CalendarBoard from "../components/CalendarBoard";
import type { CalendarPermissions } from "../components/CalendarBoard";

import StudentDashboardSummary from "../components/StudentDashboardSummary";

type Profile = {
  id: string;
  name: string;
  phone: string | null;
  memo: string | null;
};

type Tab = "profile" | "goals" | "grades" | "records";

export default function MyPage() {
  const { user } = useAuth();
  const { isStaff } = useIsStaff();
  const [tab, setTab] = useState<Tab>("profile");

  const [form, setForm] = useState<Profile | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // ===== Load profile =====
  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!user) return;
      setMsg(null);

      const { data, error } = await supabase
        .from("profiles")
        .select("id,name,phone,memo")
        .eq("id", user.id)
        .maybeSingle();

      if (cancelled) return;

      if (error) setMsg("読み込み失敗: " + error.message);
      else setForm((data as Profile) ?? null);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;

    setSaving(true);
    setMsg(null);

    const payload = {
      name: (form.name ?? "").trim(),
      phone: (form.phone ?? "").trim() || null,
      memo: (form.memo ?? "").trim() || null,
    };

    const { error } = await supabase.from("profiles").update(payload).eq("id", form.id);

    if (error) setMsg("保存失敗: " + error.message);
    else setMsg("保存しました。");

    setSaving(false);
  }

  // ===== Calendar permissions (必ず渡す) =====
  const calendarPermissions: CalendarPermissions = useMemo(() => {
    return {
      viewPersonal: true,
      editPersonal: true,
      viewSchool: true,
      editSchool: !!isStaff,
    };
  }, [isStaff]);

  // ================== styles ==================
  const pageBg: React.CSSProperties = {
    minHeight: "70vh",
    background:
      "linear-gradient(180deg, rgba(219,242,255,0.85) 0%, rgba(245,252,255,0.9) 35%, #ffffff 100%)",
  };

  const container: React.CSSProperties = {
    maxWidth: 980,
    margin: "0 auto",
    padding: "14px 14px 90px",
  };

  const topHeader: React.CSSProperties = {
    borderRadius: 20,
    padding: "16px 16px 14px",
    background: "rgba(255,255,255,0.78)",
    border: "1px solid rgba(148,163,184,0.20)",
    boxShadow: "0 12px 30px rgba(15,23,42,0.08)",
    backdropFilter: "blur(8px)",
  };

  const headerRow: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  };

  const userRow: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 12,
    minWidth: 0,
  };

  const avatar: React.CSSProperties = {
    width: 44,
    height: 44,
    borderRadius: 9999,
    background: "rgba(59,130,246,0.14)",
    color: "#2563eb",
    display: "grid",
    placeItems: "center",
    fontWeight: 900,
    flexShrink: 0,
    boxShadow: "0 10px 20px rgba(37,99,235,0.12)",
  };

  const titleWrap: React.CSSProperties = { minWidth: 0 };
  const title: React.CSSProperties = {
    fontSize: 20,
    fontWeight: 900,
    color: "#0f172a",
    lineHeight: 1.15,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };
  const subtitle: React.CSSProperties = {
    marginTop: 2,
    fontSize: 12,
    fontWeight: 800,
    color: "#64748b",
  };

  const tabPills: React.CSSProperties = {
    display: "flex",
    gap: 6,
    padding: 6,
    borderRadius: 9999,
    backgroundColor: "rgba(255,255,255,0.80)",
    border: "1px solid rgba(148,163,184,0.20)",
    boxShadow: "0 10px 26px rgba(15, 23, 42, 0.06)",
  };

  const body: React.CSSProperties = {
    marginTop: 14,
    display: "flex",
    flexDirection: "column",
    gap: 14,
  };

  // records layout
  const recordsGrid: React.CSSProperties = {
    display: "grid",
    gap: 14,
    gridTemplateColumns: "1fr",
  };

  const recordsLeft: React.CSSProperties = { minWidth: 0 };
  const recordsRight: React.CSSProperties = { minWidth: 0 };

  // ================== guard ==================
  if (!user) {
    return (
      <div style={pageBg}>
        <div style={container}>
          <Card title="マイページ">
            <InfoText>ログインしてください。</InfoText>
          </Card>
        </div>
      </div>
    );
  }

  // ================== staff view ==================
  if (isStaff) {
    return (
      <div style={pageBg}>
        <div style={container}>
          <div style={topHeader}>
            <div style={headerRow}>
              <div style={userRow}>
                <div style={avatar}>{(form?.name ?? "S").slice(0, 1)}</div>
                <div style={titleWrap}>
                  <div style={title}>マイページ（スタッフ）</div>
                  <div style={subtitle}>プロフィール編集</div>
                </div>
              </div>
            </div>
          </div>

          <div style={body}>
            <Card title="プロフィール">
              {!form ? (
                <InfoText>読み込み中...</InfoText>
              ) : (
                <ProfileForm
                  form={form}
                  setForm={setForm}
                  onSave={onSave}
                  saving={saving}
                  msg={msg}
                />
              )}
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // ================== student view ==================
  return (
    <div style={pageBg}>
      <div style={container}>
        {/* Header */}
        <div style={topHeader}>
          <div style={headerRow}>
            <div style={userRow}>
              <div style={avatar}>{(form?.name ?? "？").slice(0, 1)}</div>
              <div style={titleWrap}>
                <div style={title}>{form?.name ? `${form.name} のマイページ` : "マイページ"}</div>
                <div style={subtitle}>プロフィール / 目標 / 成績 / 記録</div>
              </div>
            </div>

            {/* Tabs */}
            <div style={tabPills}>
              <TabBtn active={tab === "profile"} onClick={() => setTab("profile")}>
                プロフィール
              </TabBtn>
              <TabBtn active={tab === "goals"} onClick={() => setTab("goals")}>
                目標
              </TabBtn>
              <TabBtn active={tab === "grades"} onClick={() => setTab("grades")}>
                成績
              </TabBtn>
              <TabBtn active={tab === "records"} onClick={() => setTab("records")}>
                記録
              </TabBtn>
            </div>
          </div>
        </div>

        {/* サマリ */}
        <div style={{ marginTop: 14 }}>
          <StudentDashboardSummary userId={user.id} />
        </div>

        {/* Body */}
        <div style={body}>
          {tab === "profile" && (
            <>
              <Card title="プロフィール">
                {!form ? (
                  <InfoText>読み込み中...</InfoText>
                ) : (
                  <ProfileForm
                    form={form}
                    setForm={setForm}
                    onSave={onSave}
                    saving={saving}
                    msg={msg}
                  />
                )}
              </Card>

              <Card title="所属グループ">
                <div
                  style={{
                    borderRadius: 14,
                    border: "1px solid rgba(148,163,184,0.22)",
                    background: "#ffffff",
                    padding: 12,
                  }}
                >
                  <StudentGroups userId={user.id} />
                </div>
              </Card>
            </>
          )}

          {tab === "goals" && (
            <Card title="目標">
              <StudentGoals userId={user.id} editable={true} />
            </Card>
          )}

          {tab === "grades" && (
            <Card title="成績（問題集）">
              <StudentGrades userId={user.id} editable={false} />
            </Card>
          )}

          {tab === "records" && (
            <>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  gap: 10,
                  padding: "2px 2px 0",
                }}
              >
                <div style={{ fontSize: 16, fontWeight: 900, color: "#0f172a" }}>
                  記録
                </div>
                <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b" }}>
                  勉強時間の記録とカレンダーをまとめて管理
                </div>
              </div>

              <div
                style={{
                  ...recordsGrid,
                  // 860px以上で2カラム
                  ...(window.innerWidth >= 860
                    ? { gridTemplateColumns: "1.35fr 1fr" }
                    : {}),
                }}
              >
                <div style={recordsLeft}>
                  <Card title="勉強時間の記録" right={<span style={{ fontSize: 12, fontWeight: 900, color: "#64748b" }}>入力 + 履歴</span>}>
                    <StudentStudyLogs userId={user.id} editable={true} />
                  </Card>
                </div>

                <div style={recordsRight}>
                  <Card
                    title="カレンダー"
                    right={
                      <span style={{ fontSize: 12, fontWeight: 900, color: "#64748b" }}>
                        個人=編集OK / 塾=閲覧
                      </span>
                    }
                  >
                    <div style={{ minHeight: 420 }}>
                      <CalendarBoard ownerUserId={user.id} permissions={calendarPermissions} />
                    </div>
                  </Card>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ================= UI parts ================= */

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
        backgroundColor: active ? "rgba(59,130,246,0.16)" : "transparent",
        color: active ? "#1d4ed8" : "#0f172a",
        borderRadius: 9999,
        padding: "10px 14px",
        fontWeight: 900,
        fontSize: 13,
        cursor: "pointer",
        whiteSpace: "nowrap",
        transition: "background-color 120ms ease",
      }}
    >
      {children}
    </button>
  );
}

function Card({
  title,
  right,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        borderRadius: 20,
        backgroundColor: "rgba(255,255,255,0.86)",
        padding: 16,
        boxShadow: "0 12px 34px rgba(15, 23, 42, 0.08)",
        border: "1px solid rgba(148, 163, 184, 0.18)",
        backdropFilter: "blur(8px)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          marginBottom: 12,
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 900, color: "#0f172a" }}>{title}</div>
        {right ?? null}
      </div>
      {children}
    </section>
  );
}

function InfoText({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 13, fontWeight: 800, color: "#64748b" }}>{children}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label
      style={{
        display: "grid",
        gridTemplateColumns: "160px 1fr",
        gap: 12,
        alignItems: "start",
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 900, color: "#0f172a", paddingTop: 10 }}>{label}</div>
      <div>{children}</div>
    </label>
  );
}

function inputStyle(): React.CSSProperties {
  return {
    width: "100%",
    border: "1px solid rgba(148,163,184,0.35)",
    borderRadius: 14,
    padding: "12px 14px",
    fontSize: 14,
    fontWeight: 800,
    outline: "none",
    backgroundColor: "rgba(255,255,255,0.95)",
  };
}

function ProfileForm({
  form,
  setForm,
  onSave,
  saving,
  msg,
}: {
  form: Profile;
  setForm: React.Dispatch<React.SetStateAction<Profile | null>>;
  onSave: (e: React.FormEvent) => Promise<void>;
  saving: boolean;
  msg: string | null;
}) {
  return (
    <form onSubmit={onSave} style={{ display: "grid", gap: 12, maxWidth: 720 }}>
      <Field label="氏名">
        <input
          style={inputStyle()}
          value={form.name ?? ""}
          onChange={(e) => setForm((prev) => (prev ? { ...prev, name: e.target.value } : prev))}
        />
      </Field>

      <Field label="電話番号">
        <input
          style={inputStyle()}
          placeholder="例）090-xxxx-xxxx"
          value={form.phone ?? ""}
          onChange={(e) =>
            setForm((prev) => (prev ? { ...prev, phone: e.target.value || null } : prev))
          }
        />
      </Field>

      <Field label="メモ">
        <textarea
          style={{ ...inputStyle(), minHeight: 120, resize: "vertical" }}
          value={form.memo ?? ""}
          onChange={(e) =>
            setForm((prev) => (prev ? { ...prev, memo: e.target.value || null } : prev))
          }
        />
      </Field>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <button
          type="submit"
          disabled={saving}
          style={{
            border: "none",
            backgroundColor: "#60a5fa",
            color: "#ffffff",
            borderRadius: 9999,
            padding: "10px 16px",
            fontWeight: 900,
            cursor: "pointer",
            opacity: saving ? 0.6 : 1,
            boxShadow: "0 10px 20px rgba(37, 99, 235, 0.18)",
          }}
        >
          {saving ? "保存中..." : "保存"}
        </button>
      </div>

      {msg && <div style={{ fontSize: 13, fontWeight: 800, color: "#334155" }}>{msg}</div>}
    </form>
  );
}
