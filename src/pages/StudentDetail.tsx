/*
 * src/pages/StudentDetail.tsx
 * - プロフィールタブ内に: 名前/電話/メモ編集 + 所属グループ + 生徒カレンダー閲覧
 * - 成績タブ: StudentGrades + (必要ならRecords)
 * - 目標タブ: StudentGoals
 * - 先生は塾予定(school)を編集でき、生徒personalは閲覧のみ
 */
import { useEffect, useMemo, useState } from "react";
import { useIsStaff } from "../hooks/useIsStaff";
import { supabase } from "../lib/supabase";
import StudentGrades from "../components/StudentGrades";
import StudentGoals from "../components/StudentGoals";
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

type Tab = "profile" | "grades" | "goals";

type GroupMini = {
  id: string;
  name: string;
  type: "class" | "dm" | string;
};

const COLORS = {
  bgTop: "#f0f9ff",
  bgBottom: "#ffffff",
  card: "#ffffff",
  border: "#e5e7eb",
  textMain: "#0f172a",
  textSub: "#475569",
  sky: "#0ea5e9",
  skySoft: "#e0f2fe",
  slateSoft: "#f1f5f9",
};

function initial(name?: string | null) {
  const s = (name ?? "").trim();
  return s ? s.slice(0, 1) : "生";
}

export default function StudentDetail({ student, onBack }: Props) {
  const { isStaff } = useIsStaff();
  const [tab, setTab] = useState<Tab>("profile");

  const [formName, setFormName] = useState(student.name ?? "");
  const [formPhone, setFormPhone] = useState(student.phone ?? "");
  const [formMemo, setFormMemo] = useState(student.memo ?? "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);

  useEffect(() => {
    setFormName(student.name ?? "");
    setFormPhone(student.phone ?? "");
    setFormMemo(student.memo ?? "");
    setProfileMsg(null);
  }, [student]);

  const dirty = useMemo(() => {
    return (
      formName !== (student.name ?? "") ||
      formPhone !== (student.phone ?? "") ||
      formMemo !== (student.memo ?? "")
    );
  }, [formName, formPhone, formMemo, student.name, student.phone, student.memo]);

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

  // groups
  const [groups, setGroups] = useState<GroupMini[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setGroupsLoading(true);

      const { data: gm, error: e1 } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("user_id", student.id);

      if (e1) {
        console.error("❌ load student groups step1:", e1.message);
        if (!cancelled) setGroups([]);
        setGroupsLoading(false);
        return;
      }

      const ids = (gm ?? []).map((r: { group_id?: string }) => r.group_id as string);
      if (ids.length === 0) {
        if (!cancelled) setGroups([]);
        setGroupsLoading(false);
        return;
      }

      const { data: gs, error: e2 } = await supabase
        .from("groups")
        .select("id,name,type")
        .in("id", ids)
        .order("name", { ascending: true });

      if (e2) {
        console.error("❌ load student groups step2:", e2.message);
        if (!cancelled) setGroups([]);
        setGroupsLoading(false);
        return;
      }

      if (!cancelled) {
        setGroups(
          (gs ?? []).map((g: { id: string; name?: string; type?: string }) => ({
            id: g.id as string,
            name: g.name ?? "(名称未設定)",
            type: g.type ?? "class",
          }))
        );
      }
      setGroupsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [student.id]);

  // ----- styles (inline only) -----
  const S = {
    page: {
      minHeight: "100vh",
      background: `linear-gradient(to bottom, ${COLORS.bgTop}, ${COLORS.bgBottom})`,
      padding: "24px",
    } as React.CSSProperties,
    container: {
      maxWidth: "1100px",
      margin: "0 auto",
      display: "flex",
      flexDirection: "column",
      gap: "16px",
    } as React.CSSProperties,

    topRow: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "12px",
      flexWrap: "wrap",
    } as React.CSSProperties,

    backBtn: {
      display: "inline-flex",
      alignItems: "center",
      gap: "8px",
      padding: "8px 12px",
      borderRadius: "12px",
      border: `1px solid ${COLORS.border}`,
      background: "#fff",
      color: COLORS.textMain,
      fontWeight: 800,
      cursor: "pointer",
      boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
    } as React.CSSProperties,

    titleWrap: {
      display: "flex",
      alignItems: "center",
      gap: "12px",
      minWidth: 0,
      flex: 1,
    } as React.CSSProperties,
    avatar: {
      width: "46px",
      height: "46px",
      borderRadius: "16px",
      background: COLORS.skySoft,
      color: COLORS.sky,
      display: "grid",
      placeItems: "center",
      fontWeight: 900,
      flexShrink: 0,
    } as React.CSSProperties,
    title: {
      fontSize: "22px",
      fontWeight: 900,
      color: COLORS.textMain,
      lineHeight: 1.2,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
      maxWidth: "520px",
    } as React.CSSProperties,
    subtitle: {
      marginTop: "2px",
      fontSize: "12px",
      color: COLORS.textSub,
    } as React.CSSProperties,

    tabs: {
      display: "inline-flex",
      gap: "8px",
      padding: "6px",
      borderRadius: "14px",
      border: `1px solid ${COLORS.border}`,
      background: "#fff",
      boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
    } as React.CSSProperties,
    tabBtn: (active: boolean) =>
      ({
        padding: "8px 12px",
        borderRadius: "12px",
        border: "none",
        cursor: "pointer",
        fontWeight: 900,
        fontSize: "13px",
        background: active ? COLORS.skySoft : "transparent",
        color: active ? COLORS.sky : COLORS.textSub,
      } as React.CSSProperties),

    card: {
      background: COLORS.card,
      borderRadius: "18px",
      border: `1px solid ${COLORS.border}`,
      boxShadow: "0 4px 14px rgba(0,0,0,0.05)",
      overflow: "hidden",
    } as React.CSSProperties,
    cardHeader: {
      padding: "14px 18px",
      borderBottom: `1px solid ${COLORS.border}`,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "12px",
      background: "linear-gradient(to bottom, #ffffff, #fbfdff)",
    } as React.CSSProperties,
    cardTitle: {
      fontSize: "16px",
      fontWeight: 900,
      color: COLORS.textMain,
    } as React.CSSProperties,
    cardBody: {
      padding: "16px 18px",
    } as React.CSSProperties,

    form: {
      display: "flex",
      flexDirection: "column",
      gap: "12px",
      maxWidth: "720px",
    } as React.CSSProperties,

    field: {
      display: "grid",
      gridTemplateColumns: "160px 1fr",
      gap: "10px",
      alignItems: "center",
    } as React.CSSProperties,
    label: {
      fontSize: "13px",
      color: COLORS.textSub,
      fontWeight: 900,
    } as React.CSSProperties,
    input: {
      width: "100%",
      borderRadius: "12px",
      border: `1px solid ${COLORS.border}`,
      padding: "10px 12px",
      fontSize: "14px",
      outline: "none",
      background: "#fff",
    } as React.CSSProperties,
    textarea: {
      width: "100%",
      borderRadius: "12px",
      border: `1px solid ${COLORS.border}`,
      padding: "10px 12px",
      fontSize: "14px",
      outline: "none",
      minHeight: "110px",
      resize: "vertical",
      background: "#fff",
    } as React.CSSProperties,

    actions: {
      display: "flex",
      alignItems: "center",
      gap: "10px",
      justifyContent: "flex-end",
      marginTop: "6px",
    } as React.CSSProperties,
    btnPrimary: (disabled: boolean) =>
      ({
        border: "none",
        borderRadius: "12px",
        padding: "10px 14px",
        fontWeight: 900,
        cursor: disabled ? "not-allowed" : "pointer",
        background: COLORS.sky,
        color: "#fff",
        opacity: disabled ? 0.6 : 1,
      } as React.CSSProperties),
    btnGhost: {
      borderRadius: "12px",
      border: `1px solid ${COLORS.border}`,
      background: "#fff",
      color: COLORS.textMain,
      padding: "10px 14px",
      fontWeight: 900,
      cursor: "pointer",
    } as React.CSSProperties,

    msg: {
      fontSize: "12px",
      color: COLORS.textSub,
      marginTop: "6px",
      background: COLORS.slateSoft,
      border: `1px solid ${COLORS.border}`,
      borderRadius: "12px",
      padding: "10px 12px",
    } as React.CSSProperties,

    chipWrap: {
      display: "flex",
      flexWrap: "wrap",
      gap: "8px",
    } as React.CSSProperties,
    chip: {
      display: "inline-flex",
      alignItems: "center",
      gap: "6px",
      padding: "6px 10px",
      borderRadius: "999px",
      background: COLORS.slateSoft,
      border: `1px solid ${COLORS.border}`,
      color: COLORS.textMain,
      fontSize: "12px",
      fontWeight: 800,
    } as React.CSSProperties,
    chipTag: {
      fontSize: "11px",
      fontWeight: 900,
      color: COLORS.textSub,
    } as React.CSSProperties,

    muted: {
      fontSize: "13px",
      color: COLORS.textSub,
    } as React.CSSProperties,

    sectionGap: { display: "flex", flexDirection: "column", gap: "16px" } as React.CSSProperties,
  };

  return (
    <div style={S.page}>
      <div style={S.container}>
        {/* 上部：戻る + タイトル + タブ */}
        <div style={S.topRow}>
          <button onClick={onBack} style={S.backBtn}>
            ← 一覧に戻る
          </button>

          <div style={S.titleWrap}>
            <div style={S.avatar}>{initial(student.name)}</div>
            <div style={{ minWidth: 0 }}>
              <div style={S.title}>{student.name ?? "（未設定）"}</div>
              <div style={S.subtitle}>生徒詳細（先生用）</div>
            </div>
          </div>

          <div style={S.tabs}>
            <button style={S.tabBtn(tab === "profile")} onClick={() => setTab("profile")}>
              プロフィール
            </button>
            <button style={S.tabBtn(tab === "grades")} onClick={() => setTab("grades")}>
              成績
            </button>
            <button style={S.tabBtn(tab === "goals")} onClick={() => setTab("goals")}>
              目標
            </button>
          </div>
        </div>

        {/* プロフィールタブ */}
        {tab === "profile" && (
          <div style={S.sectionGap}>
            {/* プロフィール編集カード */}
            <div style={S.card}>
              <div style={S.cardHeader}>
                <div style={S.cardTitle}>プロフィール</div>
                <div style={{ fontSize: "12px", color: COLORS.textSub }}>
                  {isStaff ? "先生のみ編集可" : "閲覧のみ"}
                </div>
              </div>

              <div style={S.cardBody}>
                <form onSubmit={saveProfile} style={S.form}>
                  <div style={S.field}>
                    <div style={S.label}>氏名</div>
                    <input
                      style={S.input}
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      disabled={!isStaff}
                      placeholder="氏名"
                    />
                  </div>

                  <div style={S.field}>
                    <div style={S.label}>電話番号</div>
                    <input
                      style={S.input}
                      value={formPhone}
                      onChange={(e) => setFormPhone(e.target.value)}
                      disabled={!isStaff}
                      placeholder="例）090-xxxx-xxxx"
                    />
                  </div>

                  <div style={{ ...S.field, alignItems: "start" }}>
                    <div style={S.label}>メモ</div>
                    <textarea
                      style={S.textarea}
                      value={formMemo}
                      onChange={(e) => setFormMemo(e.target.value)}
                      disabled={!isStaff}
                      placeholder="志望校 / 苦手単元 / 家庭連絡事項 など"
                    />
                  </div>

                  <div style={S.actions}>
                    <button
                      type="button"
                      style={S.btnGhost}
                      onClick={() => {
                        setFormName(student.name ?? "");
                        setFormPhone(student.phone ?? "");
                        setFormMemo(student.memo ?? "");
                        setProfileMsg(null);
                      }}
                      disabled={!dirty || savingProfile}
                    >
                      元に戻す
                    </button>

                    <button
                      type="submit"
                      disabled={!isStaff || savingProfile || !dirty}
                      style={S.btnPrimary(!isStaff || savingProfile || !dirty)}
                    >
                      {savingProfile ? "保存中…" : "保存"}
                    </button>
                  </div>

                  {profileMsg && <div style={S.msg}>{profileMsg}</div>}
                </form>
              </div>
            </div>

            {/* 所属グループ */}
            <div style={S.card}>
              <div style={S.cardHeader}>
                <div style={S.cardTitle}>所属グループ</div>
              </div>
              <div style={S.cardBody}>
                {groupsLoading ? (
                  <div style={S.muted}>読み込み中…</div>
                ) : groups.length === 0 ? (
                  <div style={S.muted}>所属グループはありません。</div>
                ) : (
                  <div style={S.chipWrap}>
                    {groups.map((g) => (
                      <span key={g.id} style={S.chip}>
                        {g.name}
                        {g.type === "dm" && <span style={S.chipTag}>DM</span>}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* カレンダー */}
            <div style={S.card}>
              <div style={S.cardHeader}>
                <div style={S.cardTitle}>カレンダー</div>
                <div style={{ fontSize: "12px", color: COLORS.textSub }}>
                  personalは閲覧のみ / 塾予定は先生が編集
                </div>
              </div>
              <div style={S.cardBody}>
                <CalendarBoard
                  viewerRole="teacher"
                  ownerUserId={student.id}
                  canEditPersonal={false}
                  canEditSchool={true}
                />
              </div>
            </div>
          </div>
        )}

        {/* 成績 */}
        {tab === "grades" && (
          <div style={S.card}>
            <div style={S.cardHeader}>
              <div style={S.cardTitle}>問題集の成績</div>
            </div>
            <div style={S.cardBody}>
              <StudentGrades userId={student.id} editable={true} />
            </div>
          </div>
        )}

        {/* 目標 */}
        {tab === "goals" && (
          <div style={S.card}>
            <div style={S.cardHeader}>
              <div style={S.cardTitle}>目標</div>
            </div>
            <div style={S.cardBody}>
              <StudentGoals userId={student.id} editable={true} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
