import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WAR-ROOM | AI Financial Agents",
  description: "Dorothy (CFA Analyst) & Alice (McKinsey Strategist) - 반말 모드",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
