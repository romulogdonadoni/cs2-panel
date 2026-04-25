import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { PanelChrome } from "@/components/panel-chrome";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CS2 — Painel",
  description: "Loadout, lobby e configuração do servidor",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-dvh bg-black text-slate-100">
        <PanelChrome>{children}</PanelChrome>
      </body>
    </html>
  );
}
