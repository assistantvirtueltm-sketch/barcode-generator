import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Planches d'étiquettes codes-barres",
  description:
    "Génère une planche A4 d'étiquettes codes-barres imprimable (Apli/Agipa 118990, 65 étiquettes 38 × 21,2 mm).",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
