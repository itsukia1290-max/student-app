/*
 * src/pages/StudentDetail.tsx
 * - 先生が生徒1人を閲覧/編集する画面
 * - 初期表示: レポート
 * - タブ順: レポート / 成績 / 目標 / プロフィール
 * - 今回: プロフィールの見やすさ改善 + 学校/学年/受講教科（study_subjects）追加
 * - 今回: 所属グループ/カレンダーは一旦削除（後で戻せる）
 */

import { useEffect, useState } from "react";
import { useIsStaff } from "../hooks/useIsStaff";
import { supabase } from "../lib/supabase";
import StudentGrades from "../components/StudentGrades";
import StudentGoals from "../components/StudentGoals";
import Report from "./Report";
import TeacherGradesPanel from "../components/report/TeacherGradesPanel";

const SCHOOL_YEARS = ["中1", "中2", "中3", "高1", "高2", "高3", "その他"];

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

type StudySubject = {
  id: string;
  scope: string | null;
  name: string;
  sort_order: number | null;
  is_active: boolean | null;
  color: string | null;
};

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

export default function StudentDetail({ student, onBack }: Props) {
  const { isStaff } = useIsStaff();
  const isMobile = useMediaQuery("(max-width: 520px)");
  const [tab, setTab] = useState<Tab>("report");

  // ===== profile fields =====
  const [formName, setFormName] = useState(student.name ?? "");
  const [formPhone, setFormPhone] = useState(student.phone ?? "");
  const [formMemo, setFormMemo] = useState(student.memo ?? "");

  // new
  const [formSchool, setFormSchool] = useState("");
  const [formGrade, setFormGrade] = useState(""); // "中1" 等もOK（text）
  const [allSubjects, setAllSubjects] = useState<StudySubject[]>([]);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);

  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [deleteMsg, setDeleteMsg] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [loadingProfileExtra, setLoadingProfileExtra] = useState(false);

  useEffect(() => {
    setFormName(student.name ?? "");
    setFormPhone(student.phone ?? "");
    setFormMemo(student.memo ?? "");
  }, [student]);

  // ===== load: profile extra + subjects =====
  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!student.id) return;
      setLoadingProfileExtra(true);

      // 1) profiles（追加列）
      const { data: p, error: pe } = await supabase
        .from("profiles")
        .select("school,school_year")
        .eq("id", student.id)
        .maybeSingle();

      if (!cancelled) {
        if (!pe && p) {
          setFormSchool((p.school ?? "") as string);
          setFormGrade((p.school_year ?? "") as string);
        }
      }

      // 2) study_subjects（junior固定 / is_active）
      const { data: subs, error: se } = await supabase
        .from("study_subjects")
        .select("id,scope,name,sort_order,is_active,color")
        .eq("scope", "junior")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      if (!cancelled) {
        if (!se) setAllSubjects((subs ?? []) as StudySubject[]);
      }

      // 3) profile_subjects（選択済み）
      const { data: ps, error: pse } = await supabase
        .from("profile_subjects")
        .select("subject_id")
        .eq("user_id", student.id);

      if (!cancelled) {
        if (!pse) {
          const ids = (ps ?? [])
            .map((r: Record<string, unknown>) => String(r.subject_id))
            .filter(Boolean);
          setSelectedSubjectIds(ids);
        }
      }

      if (!cancelled) setLoadingProfileExtra(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [student.id]);

  function toggleSubject(id: string) {
    setSelectedSubjectIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!isStaff) return;

    setSavingProfile(true);
    setProfileMsg(null);

    // 1) profiles update
    const { error: ue } = await supabase
      .from("profiles")
      .update({
        name: formName.trim(),
        phone: formPhone.trim() || null,
        memo: formMemo.trim() || null,
        school: formSchool.trim() || null,
        school_year: formGrade.trim() || null,
      })
      .eq("id", student.id);

    if (ue) {
      setProfileMsg("プロフィール保存に失敗しました: " + ue.message);
      setSavingProfile(false);
      return;
    }

    // 2) profile_subjects update（シンプルに入れ替え）
    // ここはRPCでトランザクション化もできるけど、まずは堅実に。
    const { error: de } = await supabase.from("profile_subjects").delete().eq("user_id", student.id);
    if (de) {
      setProfileMsg("教科の保存に失敗しました（削除）: " + de.message);
      setSavingProfile(false);
      return;
    }

    if (selectedSubjectIds.length > 0) {
      const payload = selectedSubjectIds.map((sid) => ({
        user_id: student.id,
        subject_id: sid,
      }));

      const { error: ie } = await supabase.from("profile_subjects").insert(payload);
      if (ie) {
        setProfileMsg("教科の保存に失敗しました（追加）: " + ie.message);
        setSavingProfile(false);
        return;
      }
    }

    setProfileMsg("プロフィールを保存しました。");
    setSavingProfile(false);
  }

  async function softDeleteStudent() {
    if (!isStaff) return;

    const ok = window.confirm(
      `生徒「${student.name ?? "（未設定）"}」を削除（無効化）します。\n` +
        "この操作で生徒は一覧から消え、ログイン/利用を停止させられます。\n" +
        "よろしいですか？"
    );
    if (!ok) return;

    setDeleting(true);
    setDeleteMsg(null);

    // RPC: process_approval(p_action='withdrawn') を使う前提（あなたの設計に合わせる）
    const { error } = await supabase.rpc("process_approval", {
      p_user_id: student.id,
      p_action: "withdrawn",
    });

    if (error) {
      setDeleteMsg("削除に失敗しました: " + error.message);
      setDeleting(false);
      return;
    }

    setDeleteMsg("削除（無効化）しました。一覧に戻ります。");
    setDeleting(false);
    onBack();
  }

  const page: React.CSSProperties = {
    padding: isMobile ? "10px" : "16px",
    paddingBottom: "calc(96px + env(safe-area-inset-bottom))",
    boxSizing: "border-box",
    background: "#f8fafc",
    minHeight: "100vh",
  };

  const container: React.CSSProperties = {
    maxWidth: 1040,
    margin: "0 auto",
    display: "grid",
    gap: 12,
  };

  return (
    <div style={page}>
      <div style={container}>
        {/* ===== Top ===== */}
        <div style={topHeader(isMobile)}>
          <div style={topRow()}>
            <button onClick={onBack} style={backBtn()}>
              ← 一覧に戻る
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
              <div style={avatarCircle()}>{(student.name ?? "？").slice(0, 1)}</div>
              <div style={{ minWidth: 0 }}>
                <div style={pageTitle()}>{student.name ?? "（未設定）"}</div>
                <div style={pageSubTitle()}>生徒詳細（先生用）</div>
              </div>
            </div>

            <div style={tabWrap(isMobile)}>
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
        </div>

        {/* ===== Body ===== */}
        {tab === "report" && (
          <Card>
            <Report ownerUserId={student.id} mode="student" viewerRole="staff" />
          </Card>
        )}

        {tab === "grades" && (
          <Card>
            <div style={sectionHeader()}>
              <div style={sectionTitle()}>問題集の成績</div>
              <div style={sectionHint()}>{isStaff ? "先生：編集" : "生徒：閲覧/自己編集（許可時）"}</div>
            </div>

            <div style={{ marginTop: 12 }}>
              {isStaff ? <TeacherGradesPanel ownerUserId={student.id} /> : <StudentGrades userId={student.id} editable={true} />}
            </div>
          </Card>
        )}

        {tab === "goals" && (
          <Card>
            <div style={sectionHeader()}>
              <div style={sectionTitle()}>目標</div>
              <div style={sectionHint()}>週 / 月の目標</div>
            </div>
            <div style={{ marginTop: 12 }}>
              <StudentGoals userId={student.id} editable={true} />
            </div>
          </Card>
        )}

        {tab === "profile" && (
          <Card>
            <div style={sectionHeader()}>
              <div style={sectionTitle()}>プロフィール</div>
              <div style={sectionHint()}>先生のみ編集可</div>
            </div>

            <div style={{ marginTop: 10, borderTop: "1px solid rgba(148,163,184,0.18)", paddingTop: 12 }}>
              {loadingProfileExtra ? (
                <div style={mutedText()}>読み込み中...</div>
              ) : (
                <form onSubmit={saveProfile} style={{ display: "grid", gap: 12 }}>
                  <div style={formGrid(isMobile)}>
                    <Field label="氏名">
                      <input style={inputStyle()} value={formName} onChange={(e) => setFormName(e.target.value)} />
                    </Field>

                    <Field label="電話番号">
                      <input
                        style={inputStyle()}
                        placeholder="例）090-xxxx-xxxx"
                        value={formPhone}
                        onChange={(e) => setFormPhone(e.target.value)}
                      />
                    </Field>

                    <Field label="学校">
                      <input
                        style={inputStyle()}
                        placeholder="例）〇〇中学校"
                        value={formSchool}
                        onChange={(e) => setFormSchool(e.target.value)}
                      />
                    </Field>

                    <Field label="学年">
                      <select
                        style={inputStyle()}
                        value={formGrade}
                        onChange={(e) => setFormGrade(e.target.value)}
                      >
                        <option value="">選択してください</option>
                        {SCHOOL_YEARS.map((year) => (
                          <option key={year} value={year}>
                            {year}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>

                  <Field label="受講教科">
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {allSubjects.map((s) => {
                        const active = selectedSubjectIds.includes(s.id);
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => toggleSubject(s.id)}
                            style={subjectChip(active)}
                            title={s.name}
                          >
                            {s.name}
                          </button>
                        );
                      })}
                      {allSubjects.length === 0 && <div style={mutedText()}>教科マスタ（study_subjects）がありません。</div>}
                    </div>
                    <div style={{ marginTop: 8, ...mutedText() }}>
                      
                    </div>
                  </Field>

                  <Field label="メモ">
                    <textarea
                      style={{ ...inputStyle(), minHeight: 120, resize: "vertical" }}
                      value={formMemo}
                      onChange={(e) => setFormMemo(e.target.value)}
                    />
                  </Field>

                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginTop: 4 }}>
                    <button type="button" onClick={softDeleteStudent} disabled={deleting} style={dangerBtn(deleting)}>
                      {deleting ? "削除中..." : "この生徒を削除"}
                    </button>

                    <button type="submit" disabled={savingProfile} style={primaryBtn(savingProfile)}>
                      {savingProfile ? "保存中..." : "保存"}
                    </button>
                  </div>

                  {deleteMsg && <div style={dangerMsg()}>{deleteMsg}</div>}
                  {profileMsg && <div style={okMsg()}>{profileMsg}</div>}
                </form>
              )}
            </div>
          </Card>
        )}
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
        backgroundColor: active ? "rgba(37,99,235,0.14)" : "transparent",
        color: active ? "#1d4ed8" : "#0f172a",
        borderRadius: 9999,
        padding: "10px 14px",
        fontWeight: 900,
        fontSize: 13,
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section
      style={{
        borderRadius: 18,
        backgroundColor: "#ffffff",
        padding: 16,
        boxShadow: "0 10px 30px rgba(15, 23, 42, 0.06)",
        border: "1px solid rgba(148,163,184,0.18)",
      }}
    >
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "grid", gap: 8 }}>
      <div style={{ fontSize: 13, fontWeight: 950, color: "#0f172a" }}>{label}</div>
      <div style={{ minWidth: 0 }}>{children}</div>
    </label>
  );
}

/* ================= styles ================= */

function topHeader(isMobile: boolean): React.CSSProperties {
  return {
    borderRadius: isMobile ? 16 : 18,
    background: "#ffffff",
    padding: isMobile ? 12 : 14,
    boxShadow: "0 10px 28px rgba(15,23,42,0.08)",
    border: "1px solid rgba(148,163,184,0.18)",
  };
}
function topRow(): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
  };
}
function backBtn(): React.CSSProperties {
  return {
    border: "1px solid rgba(148,163,184,0.35)",
    backgroundColor: "#ffffff",
    borderRadius: 9999,
    padding: "10px 14px",
    fontWeight: 900,
    cursor: "pointer",
  };
}
function avatarCircle(): React.CSSProperties {
  return {
    width: 42,
    height: 42,
    borderRadius: 9999,
    backgroundColor: "rgba(59,130,246,0.10)",
    display: "grid",
    placeItems: "center",
    color: "#2563eb",
    fontWeight: 950,
    fontSize: 16,
    flexShrink: 0,
  };
}
function pageTitle(): React.CSSProperties {
  return { fontSize: 20, fontWeight: 950, color: "#0f172a", lineHeight: 1.1 };
}
function pageSubTitle(): React.CSSProperties {
  return { fontSize: 12, fontWeight: 900, color: "#64748b", marginTop: 2 };
}
function tabWrap(isMobile: boolean): React.CSSProperties {
  return {
    display: "flex",
    gap: 6,
    padding: 6,
    borderRadius: 9999,
    backgroundColor: "rgba(255,255,255,0.75)",
    border: "1px solid rgba(148,163,184,0.20)",
    boxShadow: "0 10px 26px rgba(15, 23, 42, 0.05)",
    flexWrap: "wrap",
    justifyContent: isMobile ? "flex-start" : "flex-end",
  };
}

function sectionHeader(): React.CSSProperties {
  return { display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" };
}
function sectionTitle(): React.CSSProperties {
  return { fontSize: 16, fontWeight: 950, color: "#0f172a" };
}
function sectionHint(): React.CSSProperties {
  return { fontSize: 12, fontWeight: 900, color: "#64748b" };
}

function mutedText(): React.CSSProperties {
  return { fontSize: 13, fontWeight: 800, color: "#64748b" };
}

function formGrid(isMobile: boolean): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: isMobile ? "1fr" : "repeat(2, minmax(0, 1fr))",
    gap: 12,
  };
}

function inputStyle(): React.CSSProperties {
  return {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid rgba(148,163,184,0.35)",
    borderRadius: 14,
    padding: "12px 14px",
    fontSize: 14,
    fontWeight: 850,
    outline: "none",
    backgroundColor: "rgba(255,255,255,0.95)",
  };
}

function subjectChip(active: boolean): React.CSSProperties {
  return {
    border: active ? "1px solid rgba(37,99,235,0.35)" : "1px solid rgba(148,163,184,0.22)",
    background: active ? "rgba(219,234,254,0.85)" : "rgba(255,255,255,0.92)",
    borderRadius: 9999,
    padding: "8px 12px",
    fontWeight: 950,
    fontSize: 13,
    cursor: "pointer",
    color: active ? "#1d4ed8" : "#0f172a",
    whiteSpace: "nowrap",
  };
}

function primaryBtn(disabled?: boolean): React.CSSProperties {
  return {
    border: "none",
    backgroundColor: "#60a5fa",
    color: "#ffffff",
    borderRadius: 9999,
    padding: "10px 16px",
    fontWeight: 950,
    cursor: "pointer",
    opacity: disabled ? 0.6 : 1,
    boxShadow: "0 10px 20px rgba(37, 99, 235, 0.18)",
  };
}

function dangerBtn(disabled?: boolean): React.CSSProperties {
  return {
    border: "none",
    backgroundColor: "#ef4444",
    color: "#ffffff",
    borderRadius: 9999,
    padding: "10px 16px",
    fontWeight: 950,
    cursor: "pointer",
    opacity: disabled ? 0.6 : 1,
  };
}

function dangerMsg(): React.CSSProperties {
  return { marginTop: 8, fontSize: 13, fontWeight: 950, color: "#b91c1c" };
}
function okMsg(): React.CSSProperties {
  return { marginTop: 8, fontSize: 13, fontWeight: 850, color: "#334155" };
}
