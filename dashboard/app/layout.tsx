import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Consulting Pipeline",
  description: "Tableau de bord des prospects et messages",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
