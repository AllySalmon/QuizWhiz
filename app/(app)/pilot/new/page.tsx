import { PilotRunForm } from "./PilotRunForm";

export default function NewPilotRunPage() {
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">New accuracy check</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Upload a stack of tests you&apos;ve already hand-graded, plus what you know is actually
        correct for each — this never touches real grading or the roster.
      </p>

      <div className="mt-6">
        <PilotRunForm />
      </div>
    </div>
  );
}
