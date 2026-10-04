import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "Interview Platform",
  description: "Structured interviews, simplified.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body
        className="min-h-screen flex flex-col"
        style={{
          background: "linear-gradient(160deg, #4f6df5 0%, #6d4af5 50%, #8b3fd9 100%)",
        }}
      >
        {children}
      </body>
    </html>
  );
}
