import { createClient } from "@/lib/supabase/server";
import { signOut } from "./login/actions";
import { SmokeTestPanel } from "./SmokeTestPanel";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex flex-1 flex-col bg-zinc-50">
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4">
        <span className="text-sm font-semibold text-zinc-900">QuizWhiz</span>
        <div className="flex items-center gap-3">
          <span className="text-sm text-zinc-500">{user?.email}</span>
          <form action={signOut}>
            <button
              type="submit"
              className="text-sm font-medium text-zinc-600 hover:text-zinc-900"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          Milestone 0
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Infra is up. The real dashboard (setup checklist, Scan &amp; Upload, review queues)
          is Milestone 1 scope.
        </p>

        <div className="mt-6">
          <SmokeTestPanel />
        </div>
      </main>
    </div>
  );
}
