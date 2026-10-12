import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hisab — Commerce finance",
  description: "An interactive customer demo for daily orders, courier settlements, expenses, and profit.",
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
