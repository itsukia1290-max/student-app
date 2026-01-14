import { useMemo } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useIsStaff } from "../hooks/useIsStaff";
import CalendarBoard from "../components/CalendarBoard";
import type { CalendarPermissions } from "../components/CalendarBoard";

export default function SchoolCalendar() {
  const { user } = useAuth();
  const { isStaff } = useIsStaff();

  const ownerUserId = user?.id ?? "";

  const permissions: CalendarPermissions = useMemo(() => {
    // 「塾カレンダー」ページの要件をここで決める
    // 例：生徒は自分の個人予定 + 塾予定を見れる／個人予定は編集OK
    //     先生は塾予定を編集OK、個人予定は閲覧のみ（自分の個人だけ編集…等も可）
    return {
      viewPersonal: true,          // 生徒は自分の個人を見る
      editPersonal: !isStaff,      // 生徒は編集OK / 先生は基本OFF（要件次第）
      viewSchool: true,
      editSchool: isStaff,
    };
  }, [isStaff]);

  if (!ownerUserId) {
    return <div style={{ padding: 16 }}>読み込み中...</div>;
  }

  return (
    <div style={{ padding: 12, paddingBottom: 80 }}>
      <CalendarBoard ownerUserId={ownerUserId} permissions={permissions} />
    </div>
  );
}
