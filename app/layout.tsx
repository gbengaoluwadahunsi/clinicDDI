import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import { Navbar } from "@/components/Navbar";
import { Providers } from "@/components/Providers";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });

export const metadata: Metadata = {
  title: "ClinicalDDI | Enterprise Drug Interaction Intelligence",
  description: "Advanced, privacy-compliant drug-drug interaction validation for healthcare professionals.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning={true}>
      <body className={`${inter.variable} ${outfit.variable} antialiased min-h-screen bg-[var(--background)] text-[var(--foreground)] pt-20`}>
        <Providers>
          <Navbar />
          {children}
        </Providers>
      </body>
    </html>
  );
}