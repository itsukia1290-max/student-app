// src/pages/Signup.tsx
import React, { useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import {
  pageStyle,
  cardStyle,
  titleStyle,
  subtitleStyle,
  rowStyle,
  fieldLabelStyle,
  inputStyle,
  applyFocusRing,
  primaryButtonStyle,
  secondaryButtonStyle,
  noticeStyle,
} from "../ui/authUi";
import type { UiNotice } from "../ui/friendlyAuth";

export default function Signup({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<UiNotice>({ kind: "none" });

  const canSubmit = useMemo(() => {
    return !!email.trim() && !!password && !loading;
  }, [email, password, loading]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setNotice({ kind: "none" });

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });

    if (error) {
      const m = error.message?.toLowerCase?.() ?? "";
      if (m.includes("already")) {
        setNotice({
          kind: "info",
          title: "すでに登録済みです",
          message: "このメールアドレスは登録済みの可能性があります。ログインして承認をお待ちください。",
        });
      } else {
        setNotice({
          kind: "error",
          title: "登録に失敗しました",
          message: "入力内容を確認して、もう一度お試しください。",
        });
      }
      setLoading(false);
      return;
    }

    try {
      const session = data.session ?? (await supabase.auth.getSession()).data.session;
      const uid = session?.user?.id;
      if (!uid) throw new Error("ユーザーIDが取得できませんでした（session null）");

      if (name.trim()) {
        const { error: upErr } = await supabase
          .from("profiles")
          .update({ name: name.trim() })
          .eq("id", uid);
        if (upErr) throw upErr;
      }

      const { data: existing, error: exErr } = await supabase
        .from("approval_requests")
        .select("id")
        .eq("user_id", uid)
        .maybeSingle();
      if (exErr) throw exErr;

      if (!existing) {
        const { error: insErr } = await supabase.from("approval_requests").insert({
          user_id: uid,
          email: email.trim(),
          name: name.trim() || null,
          phone: null,
          approved: null,
          resolved_at: null,
          resolved_by: null,
        });
        if (insErr) throw insErr;
      }

      await supabase.auth.signOut();

      setNotice({
        kind: "success",
        title: "登録完了",
        message: "教師の承認後にログインできます。承認が反映されたらログインしてください。",
      });
    } catch (e: unknown) {
      setNotice({
        kind: "error",
        title: "処理中にエラー",
        message: e instanceof Error ? e.message : "不明なエラーが発生しました",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={pageStyle()}>
      <form onSubmit={onSubmit} style={cardStyle()}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <h1 style={titleStyle()}>新規登録</h1>
          <p style={subtitleStyle()}>
            登録後、教師の承認が必要です。承認が完了するとログインできます。
          </p>
        </div>

        {notice.kind !== "none" && (
          <div style={noticeStyle(notice.kind)}>
            {notice.title && (
              <div style={{ fontWeight: 800, marginBottom: 4 }}>
                {notice.title}
              </div>
            )}
            <div>{notice.message}</div>
          </div>
        )}

        <div style={{ height: 14 }} />

        <div style={rowStyle()}>
          <div>
            <label style={fieldLabelStyle()}>氏名（任意）</label>
            <input
              style={inputStyle()}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onFocus={(e) => applyFocusRing(e, true)}
              onBlur={(e) => applyFocusRing(e, false)}
              placeholder="例）山田 太郎"
              autoComplete="name"
            />
          </div>

          <div>
            <label style={fieldLabelStyle()}>Email</label>
            <input
              style={inputStyle()}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              onFocus={(e) => applyFocusRing(e, true)}
              onBlur={(e) => applyFocusRing(e, false)}
              placeholder="example@mail.com"
              autoComplete="email"
            />
          </div>

          <div>
            <label style={fieldLabelStyle()}>Password</label>
            <input
              style={inputStyle()}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              onFocus={(e) => applyFocusRing(e, true)}
              onBlur={(e) => applyFocusRing(e, false)}
              placeholder="6文字以上推奨"
              autoComplete="new-password"
            />
          </div>

          <button disabled={!canSubmit} style={primaryButtonStyle(!canSubmit)}>
            {loading ? "登録中..." : "登録"}
          </button>

          <button type="button" onClick={onBack} style={secondaryButtonStyle(false)} disabled={loading}>
            ← ログインに戻る
          </button>
        </div>
      </form>
    </div>
  );
}
