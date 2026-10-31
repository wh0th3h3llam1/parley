import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Parley",
  description: "A room where personal representatives negotiate a plan the whole group can accept."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
