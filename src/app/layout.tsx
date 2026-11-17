import type { Metadata } from "next";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import "open-anatomy-3d-react/styles.css";

export const metadata: Metadata = {
  title: "ENT-Care | Understand your symptoms",
  description: "Explore human anatomy and find the right next step for ENT symptoms.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light">
      <body>{children}</body>
    </html>
  );
}
