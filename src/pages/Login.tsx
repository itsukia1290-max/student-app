/*
 * src/pages/Login.tsx
 * Responsibility: ログイン画面
 * - Supabase によるメール/パスワード認証
 * - 承認フローの確認（profiles / approval_requests）
 * - 未登録 or パス間違いの区別が難しいエラーでは:
 *   1) 「ログインできませんでした」
 *   2) パスワード再確認（入力を目立たせる）
 *   3) 新規登録へ（ボタン）
 *   4) パスワードを忘れた（リセットメール送信）
 */
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
  linkButtonStyle,
  dividerStyle,
  noticeStyle,
  helperTextStyle,
} from "../ui/authUi";
import type { UiNotice } from "../ui/friendlyAuth";
import { friendlyLoginError, friendlyResetError } from "../ui/friendlyAuth";

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return "不明なエラー";
  }
}

export default function Login({ onSignup }: { onSignup: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<UiNotice>({ kind: "none" });

  const noticeData = notice.kind === "none" ? null : notice;
  const emphasizePassword = noticeData?.showPasswordRecheck === true;

  const canSubmit = useMemo(() => {
    return !!email.trim() && !!password && !loading;
  }, [email, password, loading]);

  async function ensureApprovalRequest(uid: string) {
    const { data: existing } = await supabase
      .from("approval_requests")
      .select("id")
      .eq("user_id", uid)
      .is("resolved_at", null)
      .limit(1);

    if (existing && existing.length > 0) return;

    const { error: insErr } = await supabase.from("approval_requests").insert({
      user_id: uid,
    });

    if (insErr && !/409|duplicate key|already exists/i.test(insErr.message)) {
      console.warn("approval_requests insert:", insErr.message);
    }
  }

  async function sendResetEmail() {
    const to = email.trim();
    if (!to) {
      setNotice({
        kind: "warning",
        title: "メールアドレスを入力してください",
        message: "パスワード再設定メールを送るために、Email欄を入力してください。",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(to, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) {
        setNotice(friendlyResetError(error.message));
        return;
      }
      setNotice({
        kind: "success",
        title: "再設定メールを送信しました",
        message: "メール内のリンクを開いて、新しいパスワードを設定してください。",
      });
    } catch (e: unknown) {
      setNotice({
        kind: "error",
        title: "送信に失敗しました",
        message: getErrorMessage(e),
      });
    } finally {
      setLoading(false);
    }
  }

  async function resubmitApproval() {
    setLoading(true);
    try {
      const {
        data: { user },
        error: ue,
      } = await supabase.auth.getUser();

      if (ue) throw ue;

      const uid = user?.id;
      if (!uid) throw new Error("ユーザー情報が取得できませんでした。");

      await ensureApprovalRequest(uid);

      setNotice({
        kind: "success",
        title: "再申請を送信しました",
        message: "申請を送信しました。教師の承認後に、もう一度ログインしてください。",
      });
    } catch (e: unknown) {
      setNotice({
        kind: "error",
        title: "再申請に失敗しました",
        message: getErrorMessage(e),
      });
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setNotice({ kind: "none" });

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setNotice(friendlyLoginError(error.message));
      setLoading(false);
      return;
    }

    try {
      const uid = data.user?.id;
      if (!uid) throw new Error("ユーザーIDが取得できませんでした。");

      const { data: profile, error: pe } = await supabase
        .from("profiles")
        .select("id, is_approved, name, role, status")
        .eq("id", uid)
        .maybeSingle();

      if (pe) throw pe;

      if (profile?.role === "admin" || profile?.role === "teacher") {
        setNotice({
          kind: "success",
          title: "ログインしました",
          message: "管理者/教師としてログインしました。",
        });
        return;
      }

      const status = (profile?.status ?? "active") as "active" | "suspended" | "withdrawn";
      const isApproved = !!profile?.is_approved;

      if (status === "withdrawn") {
        setNotice({
          kind: "warning",
          title: "このアカウントは利用停止になっています",
          message:
            "このアカウントは退会（利用停止）状態のためログインできません。必要であれば先生にお問い合わせください。",
          showSignupCta: true,
        });
        return;
      }

      if (status === "suspended") {
        setNotice({
          kind: "warning",
          title: "申請が却下されました",
          message:
            "申請内容に不備があった可能性があります。必要であれば、再申請を送信できます。",
          showResubmitCta: true,
        });
        return;
      }

      if (!isApproved) {
        await ensureApprovalRequest(uid);
        setNotice({
          kind: "info",
          title: "承認待ちです",
          message: "教師による承認後に、もう一度ログインしてください。",
        });
        return;
      }

      setNotice({
        kind: "success",
        title: "ようこそ",
        message: `${profile?.name ?? "ユーザー"} さん、ログインしました。`,
      });
    } catch (err: unknown) {
      setNotice({
        kind: "error",
        title: "確認中にエラー",
        message: getErrorMessage(err),
      });
    } finally {
      setLoading(false);
    }
  }

  const showSignupCta = noticeData?.showSignupCta === true;
  const showResetCta = noticeData?.showResetCta === true;
  const showResubmitCta = noticeData?.showResubmitCta === true;

  return (
    <div style={pageStyle()}>
      <form onSubmit={onSubmit} style={cardStyle()}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <h1 style={titleStyle()}>ログイン</h1>
          <p style={subtitleStyle()}>
            メールアドレスとパスワードでログインします。承認が必要な場合があります。
          </p>
        </div>

        {noticeData && (
          <div style={noticeStyle(noticeData.kind)}>
            {noticeData.title && (
              <div style={{ fontWeight: 800, marginBottom: 4 }}>
                {noticeData.title}
              </div>
            )}
            <div>{noticeData.message}</div>

            {(showSignupCta || showResetCta || showResubmitCta) && (
              <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                {showResubmitCta && (
                  <button type="button" onClick={resubmitApproval} style={secondaryButtonStyle(false)} disabled={loading}>
                    もう一度申請を送る →
                  </button>
                )}
                {showSignupCta && (
                  <button type="button" onClick={onSignup} style={secondaryButtonStyle(false)} disabled={loading}>
                    新規登録へ進む →
                  </button>
                )}

                {showResetCta && (
                  <button type="button" onClick={sendResetEmail} style={linkButtonStyle(loading)} disabled={loading}>
                    パスワードを忘れた（再設定メールを送る）
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        <div style={{ height: 14 }} />

        <div style={rowStyle()}>
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
              style={inputStyle({ emphasize: emphasizePassword })}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              onFocus={(e) => applyFocusRing(e, true)}
              onBlur={(e) => applyFocusRing(e, false)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
            {emphasizePassword && (
              <div style={helperTextStyle()}>
                パスワードをもう一度入力し直してみてください。間違いが多い箇所です。
              </div>
            )}
          </div>

          <button
            disabled={!canSubmit}
            style={primaryButtonStyle(!canSubmit)}
            onMouseDown={(e) => {
              if (canSubmit) e.currentTarget.style.transform = "scale(0.99)";
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = "scale(1)";
            }}
          >
            {loading ? "ログイン中..." : "ログイン"}
          </button>

          <div style={dividerStyle()} />

          <button type="button" onClick={onSignup} style={secondaryButtonStyle(false)} disabled={loading}>
            新規登録へ →
          </button>

          <div style={{ fontSize: 12, color: "#64748B", lineHeight: 1.4 }}>
            ※登録後は教師の承認が必要です。承認後にログインできます。
          </div>
        </div>
      </form>
    </div>
  );
}
