import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { ToastProvider } from "@/components/ui/toast";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://lazynerds.vercel.app"),
  title: {
    default: "Lazy Nerds FixOps",
    template: "%s | Lazy Nerds FixOps",
  },
  description:
    "Automated cybersecurity operations, continuous attack surface management, and verified vulnerability remediation.",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "Lazy Nerds FixOps",
    description:
      "Automated cybersecurity operations, continuous attack surface management, and verified vulnerability remediation.",
    images: [{ url: "/brand/logo.png", width: 512, height: 512, alt: "Lazy Nerds FixOps" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#07080b",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#07080b] font-sans antialiased text-[#F1F5F9] selection:bg-white/20 selection:text-white">
        <AuthProvider>
          <ToastProvider>{children}</ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
