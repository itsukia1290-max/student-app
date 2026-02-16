// src/pages/MyPage.tsx
import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { useIsStaff } from "../hooks/useIsStaff";

import StudentGrades from "../components/StudentGrades";
import StudentGoals from "../components/StudentGoals";
import StudentStudyLogs from "../components/StudentStudyLogs";

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);

    onChange();
    if (mql.addEventListener) mql.addEventListener("change", onChange);
    else mql.addListener(onChange);

    return () => {
      if (mql.removeEventListener) mql.removeEventListener("change", onChange);
      else mql.removeListener(onChange);
    };
  }, [query]);

  return matches;
}

type StudySubject = {
  id: string;
  name: string;
  sort_order: number | null;
  scope: string | null;
  is_active: boolean | null;
};

const SCHOOL_YEARS = ["中1", "中2", "中3", "高1", "高2", "高3", "その他"] as const;
type SchoolYear = (typeof SCHOOL_YEARS)[number];

type Profile = {
  id: string;
  name: string;
  phone: string | null;
  memo: string | null;

  // ✅追加
  school: string | null;
  school_year: SchoolYear | null;
};

type Tab = "profile" | "goals" | "grades" | "records";
type GoalPeriod = "week" | "month";

type Props = {
  initialTab?: Tab;
  initialGoalPeriod?: GoalPeriod;
};

export default function MyPage({ initialTab = "profile", initialGoalPeriod = "week" }: Props) {
  const { user } = useAuth();
  const { isStaff } = useIsStaff();
  const isMobile = useMediaQuery("(max-width: 520px)");
  const [tab, setTab] = useState<Tab>(initialTab);

  // ★ Report→MyPage遷移時に確実に反映
  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const [form, setForm] = useState<Profile | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // ✅教科
  const [allSubjects, setAllSubjects] = useState<StudySubject[]>([]);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [loadingExtra, setLoadingExtra] = useState(false);

  function toggleSubject(id: string) {
    setSelectedSubjectIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  // ===== Load profile + extra =====
  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!user) return;
      setMsg(null);
      setLoadingExtra(true);

      // 1) profiles
      const { data, error } = await supabase
        .from("profiles")
        .select("id,name,phone,memo,school,school_year")
        .eq("id", user.id)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        setMsg("読み込み失敗: " + error.message);
        setLoadingExtra(false);
        return;
      }

      setForm((data as Profile) ?? null);

      // 2) study_subjects（junior固定・active）
      const { data: subs, error: se } = await supabase
        .from("study_subjects")
        .select("id,name,sort_order,scope,is_active")
        .eq("scope", "junior")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      if (!cancelled) {
        if (!se) setAllSubjects((subs ?? []) as StudySubject[]);
      }

      // 3) profile_subjects（本人の選択済み）
      const { data: ps, error: pse } = await supabase
        .from("profile_subjects")
        .select("subject_id")
        .eq("user_id", user.id);

      if (!cancelled) {
        if (!pse) {
          const ids = (ps ?? [])
            .map((r: Record<string, unknown>) => String(r.subject_id))
            .filter(Boolean);
          setSelectedSubjectIds(ids);
        }
      }

      if (!cancelled) setLoadingExtra(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form || !user) return;

    setSaving(true);
    setMsg(null);

    // 1) profiles update
    const payload = {
      name: (form.name ?? "").trim(),
      phone: (form.phone ?? "").trim() || null,
      memo: (form.memo ?? "").trim() || null,
      school: (form.school ?? "").trim() || null,
      school_year: (form.school_year ?? null) as SchoolYear | null,
    };

    const { error: ue } = await supabase.from("profiles").update(payload).eq("id", form.id);
    if (ue) {
      setMsg("保存失敗: " + ue.message);
      setSaving(false);
      return;
    }

    // 2) profile_subjects 入れ替え（安全に delete → insert）
    const { error: de } = await supabase.from("profile_subjects").delete().eq("user_id", user.id);
    if (de) {
      setMsg("教科の保存に失敗（削除）: " + de.message);
      setSaving(false);
      return;
    }

    if (selectedSubjectIds.length > 0) {
      const ins = selectedSubjectIds.map((sid) => ({ user_id: user.id, subject_id: sid }));
      const { error: ie } = await supabase.from("profile_subjects").insert(ins);
      if (ie) {
        setMsg("教科の保存に失敗（追加）: " + ie.message);
        setSaving(false);
        return;
      }
    }

    setMsg("保存しました。");
    setSaving(false);
  }

  // ================== styles ==================
  const pageBg: React.CSSProperties = {
    minHeight: "70vh",
    background: "#f8fafc",
    padding: isMobile ? "8px" : "16px",
  };

  const container: React.CSSProperties = {
    maxWidth: 980,
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
    gap: isMobile ? 10 : 14,
    paddingBottom: 90,
  };

  const topHeader: React.CSSProperties = {
    borderRadius: isMobile ? 16 : 22,
    padding: isMobile ? 12 : 16,
    background: "#ffffff",
    border: "1px solid rgba(148,163,184,0.18)",
    boxShadow: "0 12px 34px rgba(15, 23, 42, 0.08)",
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
    gap: isMobile ? 4 : 6,
    padding: isMobile ? 4 : 6,
    borderRadius: 9999,
    backgroundColor: "rgba(255,255,255,0.80)",
    border: "1px solid rgba(148,163,184,0.20)",
    boxShadow: "0 10px 26px rgba(15, 23, 42, 0.06)",
    flexWrap: "wrap",
  };



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

          <div>
            <Card title="プロフィール">
              {!form ? (
                <InfoText>読み込み中...</InfoText>
              ) : (
                <ProfileForm form={form} setForm={setForm} onSave={onSave} saving={saving} msg={msg} allSubjects={[]} selectedSubjectIds={[]} toggleSubject={() => {}} loadingExtra={false} />
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

        {/* Body */}
        <div>
          {tab === "profile" && (
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
                  allSubjects={allSubjects}
                  selectedSubjectIds={selectedSubjectIds}
                  toggleSubject={toggleSubject}
                  loadingExtra={loadingExtra}
                />
              )}
            </Card>
          )}

          {tab === "goals" && (
            <Card title="目標">
              <StudentGoals userId={user.id} editable={true} initialPeriodType={initialGoalPeriod} />
            </Card>
          )}

          {tab === "grades" && (
            <Card title="成績（問題集）">
              <StudentGrades userId={user.id} editable={false} />
            </Card>
          )}

          {tab === "records" && (
            <Card title="勉強時間の記録">
              <StudentStudyLogs userId={user.id} editable={true} />
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

/* ================= UI parts ================= */

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
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

function Card({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  const isMobile = useMediaQuery("(max-width: 520px)");
  return (
    <section
      style={{
        borderRadius: isMobile ? 16 : 22,
        backgroundColor: "#ffffff",
        padding: isMobile ? 12 : 16,
        boxShadow: "0 12px 34px rgba(15, 23, 42, 0.08)",
        border: "1px solid rgba(148,163,184,0.18)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
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
  const isMobile = useMediaQuery("(max-width: 520px)");
  return (
    <label style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "160px 1fr", gap: 12, alignItems: "start" }}>
      <div style={{ fontSize: 13, fontWeight: 900, color: "#0f172a", paddingTop: isMobile ? 0 : 10 }}>{label}</div>
      <div style={{ minWidth: 0 }}>{children}</div>
    </label>
  );
}

function inputStyle(): React.CSSProperties {
  return {
    width: "100%",
    boxSizing: "border-box",
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
  allSubjects,
  selectedSubjectIds,
  toggleSubject,
  loadingExtra,
}: {
  form: Profile;
  setForm: React.Dispatch<React.SetStateAction<Profile | null>>;
  onSave: (e: React.FormEvent) => Promise<void>;
  saving: boolean;
  msg: string | null;
  allSubjects: StudySubject[];
  selectedSubjectIds: string[];
  toggleSubject: (id: string) => void;
  loadingExtra: boolean;
}) {
  const isMobile = useMediaQuery("(max-width: 520px)");
  const canShowExtra = true; // for non-staff students
  
  return (
    <form onSubmit={onSave} style={{ display: "grid", gap: 12, maxWidth: 720 }}>
      <Field label="氏名">
        <input style={inputStyle()} value={form.name ?? ""} onChange={(e) => setForm((prev) => (prev ? { ...prev, name: e.target.value } : prev))} />
      </Field>

      <Field label="学校">
        <input
          style={inputStyle()}
          placeholder="例）○○中学校"
          value={form.school ?? ""}
          onChange={(e) => setForm((prev) => (prev ? { ...prev, school: e.target.value || null } : prev))}
        />
      </Field>

      {canShowExtra && (
        <Field label="学年">
          <select
            style={inputStyle()}
            value={form.school_year ?? ""}
            onChange={(e) => setForm((prev) => (prev ? { ...prev, school_year: (e.target.value as SchoolYear) || null } : prev))}
          >
            <option value="">選択してください</option>
            {SCHOOL_YEARS.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </Field>
      )}

      <Field label="電話番号">
        <input
          style={inputStyle()}
          placeholder="例）090-xxxx-xxxx"
          value={form.phone ?? ""}
          onChange={(e) => setForm((prev) => (prev ? { ...prev, phone: e.target.value || null } : prev))}
        />
      </Field>

      {canShowExtra && (
        <Field label="教科">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(3, 1fr)",
              gap: 8,
            }}
          >
            {allSubjects.map((subj) => (
              <button
                key={subj.id}
                type="button"
                onClick={() => toggleSubject(subj.id)}
                disabled={loadingExtra}
                style={{
                  ...inputStyle(),
                  backgroundColor: selectedSubjectIds.includes(subj.id) ? "rgba(59,130,246,0.16)" : "rgba(255,255,255,0.95)",
                  color: selectedSubjectIds.includes(subj.id) ? "#1d4ed8" : "#0f172a",
                  fontWeight: selectedSubjectIds.includes(subj.id) ? 900 : 800,
                  border: selectedSubjectIds.includes(subj.id) ? "2px solid #3b82f6" : "1px solid rgba(148,163,184,0.35)",
                  cursor: loadingExtra ? "not-allowed" : "pointer",
                  opacity: loadingExtra ? 0.6 : 1,
                  transition: "all 120ms ease",
                  padding: "10px 12px",
                }}
              >
                {subj.name}
              </button>
            ))}
          </div>
        </Field>
      )}

      <Field label="メモ">
        <textarea
          style={{ ...inputStyle(), minHeight: 120, resize: "vertical" }}
          value={form.memo ?? ""}
          onChange={(e) => setForm((prev) => (prev ? { ...prev, memo: e.target.value || null } : prev))}
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
