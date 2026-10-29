import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CondoChamados · Happening Ipiranga",
  description: "Central de atendimento do condomínio Happening Ipiranga.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">{children}</body>
    </html>
  );
}
