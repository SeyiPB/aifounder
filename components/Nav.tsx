import Link from "next/link";
import { logout } from "@/app/login/actions";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/attendance", label: "Attendance" },
  { href: "/points", label: "Points" },
  { href: "/quizzes", label: "Quizzes" },
  { href: "/students", label: "Students" },
  { href: "/reports", label: "Reports" },
  { href: "/leaderboard", label: "Leaderboard" },
];

export function Nav({ email }: { email?: string }) {
  return (
    <header className="sticky top-0 z-20 border-b border-black/20 bg-navy text-white">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        <Link href="/dashboard" className="font-bold text-white">
          FutureNYC<span className="text-accent">AI</span>
        </Link>
        <nav className="flex flex-1 flex-wrap gap-1 text-sm">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-md px-3 py-1.5 text-slate-300 hover:bg-white/10 hover:text-white"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          {email && <span className="hidden text-xs text-slate-400 sm:block">{email}</span>}
          <form action={logout}>
            <button className="rounded-md border border-white/30 px-3 py-1.5 text-sm text-slate-200 hover:bg-white/10">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
