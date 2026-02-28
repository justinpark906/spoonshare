import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import FogWrapper from "@/components/FogWrapper";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "SpoonShare — AI Energy Management",
  description:
    "AI-powered energy management for rare disease patients using Spoon Theory",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <FogWrapper>{children}</FogWrapper>
      </body>
    </html>
  );
}
