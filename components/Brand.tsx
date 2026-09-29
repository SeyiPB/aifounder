import Image from "next/image";

// Partner logos shown at the top of every page (rendered from the root layout).
export function PartnerBar() {
  return (
    <div className="border-b border-slate-200 bg-white print:hidden">
      <div className="mx-auto flex max-w-6xl items-center justify-center gap-6 px-4 py-2.5 sm:gap-10">
        <Image src="/logos/verizon.png" alt="Verizon" width={418} height={96} priority className="h-5 w-auto sm:h-6" />
        <span className="h-6 w-px bg-slate-200" aria-hidden />
        <Image src="/logos/civic-hall.png" alt="Civic Hall — The Bernard Goldstein Center" width={373} height={120} priority className="h-7 w-auto sm:h-9" />
      </div>
    </div>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white print:hidden">
      <div className="mx-auto flex max-w-6xl items-center justify-center gap-2.5 px-4 py-4 text-xs text-slate-500">
        <Image src="/logos/the-ai-club.png" alt="The AI Club" width={123} height={128} className="h-6 w-auto" />
        <span>
          Powered by <span className="font-semibold text-slate-700">The AI Club</span>
        </span>
      </div>
    </footer>
  );
}
