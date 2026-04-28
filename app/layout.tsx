import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ユリアの占い台本生成",
  description: "ユリアによる星座別毎日占い台本を自動生成するツール",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="h-full">
      <body className="min-h-full flex flex-col bg-gray-950 text-gray-100">
        {children}
      </body>
    </html>
  );
}
