import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FutureNYC AI Summer Camp — Tracker",
  description: "Attendance, points, and quizzes for FutureNYC AI Summer Camp.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
