import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Founder Lab — Tracker",
  description: "Attendance, points, quizzes and Demo Day judging for AI Founder Lab.",
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
