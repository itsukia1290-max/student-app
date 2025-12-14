export default function StudentRecords({
	studentId,
	editable = false,
}: {
	studentId?: string | null;
	editable?: boolean;
}) {
	// This component is temporarily disabled and returns null to keep builds clean.
	// Keep props to avoid TypeScript errors where it is still used in pages.
	void studentId;
	void editable;
	return null;
}
