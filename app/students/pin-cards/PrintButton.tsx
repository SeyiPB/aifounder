"use client";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navyhover print:hidden"
    >
      🖨 Print cards
    </button>
  );
}
