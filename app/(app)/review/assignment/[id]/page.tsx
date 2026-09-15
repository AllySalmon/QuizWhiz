import Link from "next/link";
import { notFound } from "next/navigation";
import { getTestRecord } from "@/lib/db/queries/testRecords";
import { getStudent } from "@/lib/db/queries/studentRoster";
import { listActiveTeachers } from "@/lib/db/queries/teachers";
import { getSignedScanImageUrl } from "@/lib/supabase/storage";
import { ReviewTabs } from "../../ReviewTabs";
import { correctAssignmentAction } from "../actions";
import { AssignmentCorrectionForm } from "./AssignmentCorrectionForm";

export default async function AssignmentReviewDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ batch?: string }>;
}) {
  const { id } = await params;
  const { batch } = await searchParams;
  const record = await getTestRecord(id);
  if (!record) notFound();

  if (record.assignmentStatus !== "needs_assignment_review") {
    return (
      <div>
        <ReviewTabs active="assignment" batchId={batch} />
        <p className="mt-8 text-sm text-muted-foreground">This item has already been resolved.</p>
      </div>
    );
  }

  const [teachers, imageUrl, rosterStudent] = await Promise.all([
    listActiveTeachers(),
    record.scanImageRef ? getSignedScanImageUrl(record.scanImageRef) : Promise.resolve(null),
    record.studentNumber ? getStudent(record.studentNumber) : Promise.resolve(null),
  ]);

  const flagReasons = (record.flagReasons ?? []) as string[];

  return (
    <div>
      <ReviewTabs active="assignment" batchId={batch} />

      <div className="mt-4 flex justify-end">
        <Link
          href={`/batches/${record.batchId}/${id}/delete`}
          className="text-sm font-medium text-destructive hover:underline"
        >
          Delete this scan
        </Link>
      </div>

      <div className="mt-2 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-2">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="Scanned test sheet" className="w-full rounded-lg" />
          ) : (
            <p className="p-6 text-center text-sm text-muted-foreground">Scan image no longer available.</p>
          )}
        </div>

        <div>
          <h1 className="text-lg font-semibold text-foreground">Assign a teacher</h1>
          <dl className="mt-2 flex flex-col gap-1 text-sm">
            <div className="flex gap-2">
              <dt className="text-muted-foreground">OCR&apos;d teacher name:</dt>
              <dd className="text-foreground">{record.ocrTeacherLastName ?? "—"}</dd>
            </div>
            {rosterStudent && (
              <div className="flex gap-2">
                <dt className="text-muted-foreground">Roster says:</dt>
                <dd className="text-foreground">student is assigned to a different teacher on file</dd>
              </div>
            )}
            <div className="flex gap-2">
              <dt className="text-muted-foreground">Flagged because:</dt>
              <dd className="text-foreground">{flagReasons.join(", ")}</dd>
            </div>
          </dl>

          <div className="mt-4">
            <AssignmentCorrectionForm
              action={correctAssignmentAction.bind(null, id, batch ?? null)}
              initialStudentNumber={record.studentNumber ?? ""}
              teachers={teachers}
              suggestedTeacherId={rosterStudent?.teacherId ?? undefined}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
