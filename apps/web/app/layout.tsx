import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Life Event Agent",
  description: "Trusted delegation for life paperwork"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}