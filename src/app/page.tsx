import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-xl font-medium text-zinc-500">Marguerite</h1>
      <div className="flex gap-3">
        <Link
          href="/equipe"
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
        >
          Gérer l&apos;équipe
        </Link>
        <Link
          href="/boutique"
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
        >
          Ma boutique
        </Link>
      </div>
    </main>
  );
}
