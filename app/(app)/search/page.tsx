import Link from "next/link";
import { searchStudents, searchTeachers, searchAnswerKeys } from "@/lib/db/queries/search";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// Scoped to exactly three things — students, teachers, quiz/book — per the
// explicit decision not to scatter half-working search boxes around the
// app. A plain results page, not a live-typing dropdown: nothing else in
// this app does client-side type-ahead, and this isn't a high-frequency
// enough interaction to justify introducing that pattern just for search.
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  const [students, teachers, quizzes] = query
    ? await Promise.all([searchStudents(query), searchTeachers(query), searchAnswerKeys(query)])
    : [[], [], []];

  const hasAnyResults = students.length > 0 || teachers.length > 0 || quizzes.length > 0;

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">Search</h1>

      <form className="mt-4 flex gap-2" action="/search">
        <Input type="search" name="q" defaultValue={q} placeholder="Student number, teacher name, or quiz/book title" />
        <Button type="submit">Search</Button>
      </form>

      {!query ? (
        <p className="mt-8 text-sm text-muted-foreground">Search for a student, teacher, or quiz/book.</p>
      ) : !hasAnyResults ? (
        <p className="mt-8 text-sm text-muted-foreground">No matches for &ldquo;{query}&rdquo;.</p>
      ) : (
        <div className="mt-6 flex flex-col gap-8">
          {students.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-foreground">Students</h2>
              <ul className="mt-2 flex flex-col gap-1">
                {students.map((s) => (
                  <li key={s.studentNumber} className="rounded-lg border border-border px-3 py-2 text-sm">
                    <Link href={`/students/${s.studentNumber}`} className="font-mono font-medium text-primary hover:underline">
                      {s.studentNumber}
                    </Link>
                    {s.teacherName && <span className="ml-2 text-muted-foreground">{s.teacherName}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {teachers.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-foreground">Teachers</h2>
              <ul className="mt-2 flex flex-col gap-1">
                {teachers.map((t) => (
                  <li key={t.id} className="rounded-lg border border-border px-3 py-2 text-sm">
                    <Link href={`/roster/teachers/${t.id}`} className="font-medium text-primary hover:underline">
                      {t.firstName} {t.lastName}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {quizzes.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-foreground">Quizzes &amp; Books</h2>
              <ul className="mt-2 flex flex-col gap-1">
                {quizzes.map((k) => (
                  <li key={k.id} className="rounded-lg border border-border px-3 py-2 text-sm">
                    <Link href={`/answer-keys/${k.id}/edit`} className="font-medium text-primary hover:underline">
                      {k.bookTitle}
                    </Link>
                    <span className="ml-2 font-mono text-muted-foreground">{k.quizCode}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
