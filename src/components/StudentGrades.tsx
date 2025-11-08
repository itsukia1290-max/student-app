import WorkbookTracker from "./WorkbookTracker";

export default function StudentGrades({
  userId,
  editable,
}: {
  userId: string;
  editable: boolean;
}) {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">成績・達成度</h3>
      <WorkbookTracker userId={userId} editable={editable} />
    </div>
  );
}
