import Link from "next/link";
import { listAnswerKeys } from "@/lib/db/queries/answerKeys";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CsvImportForm } from "./CsvImportForm";

const GRADE_BAND_LABEL = { jr: "SSYRA Jr.", "3-5": "SSYRA 3–5" } as const;

export default async function AnswerKeysPage() {
  const keys = await listAnswerKeys();

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Answer Keys</h1>
        <Button render={<Link href="/answer-keys/new">Add answer key</Link>} />
      </div>

      <div className="mt-4">
        <CsvImportForm />
      </div>

      {keys.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">
          No answer keys yet. Add one for each book before its first test day.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Book</TableHead>
                <TableHead>Quiz code</TableHead>
                <TableHead>Grade band</TableHead>
                <TableHead>Questions</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.map((key) => (
                <TableRow key={key.id}>
                  <TableCell className="font-medium text-foreground">{key.bookTitle}</TableCell>
                  <TableCell className="font-mono text-sm">{key.quizCode}</TableCell>
                  <TableCell>{GRADE_BAND_LABEL[key.gradeBand]}</TableCell>
                  <TableCell>{key.questionCount}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-3">
                      <Link
                        href={`/answer-keys/${key.id}/edit`}
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        Edit
                      </Link>
                      <Link
                        href={`/answer-keys/${key.id}/delete`}
                        className="text-sm font-medium text-destructive hover:underline"
                      >
                        Delete
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
