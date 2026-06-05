import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Language Practice Partner",
  description: "Scenario-based English speaking practice with realtime voice feedback.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
