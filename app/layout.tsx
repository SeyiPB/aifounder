import type { Metadata } from "next";
import "./globals.css";
import { Footer, PartnerBar } from "@/components/Brand";

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
      <body className="flex min-h-screen flex-col">
        <PartnerBar />
        <div className="flex flex-1 flex-col">{children}</div>
        <Footer />
      </body>
    </html>
  );
}
