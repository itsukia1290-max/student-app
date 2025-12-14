/*
 * src/pages/SchoolCalendar.tsx
 * Responsibility:
 * - 先生/管理者専用の「塾カレンダー」
 * - ここで作った予定は全生徒に反映される
 */
import CalendarBoard from "../components/CalendarBoard";
import { useIsStaff } from "../hooks/useIsStaff";
import { useAuth } from "../contexts/AuthContext";

export default function SchoolCalendar() {
  const { isStaff } = useIsStaff();
  const { user } = useAuth();

  if (!isStaff || !user) {
    return <div className="p-6 text-gray-500">閲覧権限がありません。</div>;
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold">塾カレンダー</h1>
      <p className="text-sm text-gray-600">
        ここで追加した予定は、全生徒のカレンダーに表示されます。
      </p>

      <div className="bg-white border rounded-2xl p-4">
        <CalendarBoard
          viewerRole="teacher"
          ownerUserId={user.id}     // ← 先生自身（school予定の作成者）
          canEditPersonal={false}
          canEditSchool={true}     // ← 塾予定のみ編集
        />
      </div>
    </div>
  );
}
