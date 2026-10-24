import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { ToastProvider } from "@/components/ui/toast";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://lazynerds.vercel.app"),
  title: "Lazy Nerds FixOps — Automated Cybersecurity & Remediation Platform",
  description:
    "Cybersecurity automation platform: client management, continuous engagement operations, verified vulnerability remediation, and automated security reporting.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "Lazy Nerds FixOps — Automated Cybersecurity & Remediation Platform",
    description:
      "Automated vulnerability remediation, continuous security testing, and client operations.",
    images: [{ url: "/brand/logo.png", width: 512, height: 512, alt: "Lazy Nerds FixOps" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#090A0D",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-zinc-50 dark:bg-[#090A0D] font-sans antialiased text-zinc-900 dark:text-[#F9FAFB] selection:bg-[#F5C518]/20 selection:text-[#F5C518]">
        <AuthProvider>
          <ToastProvider>{children}</ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
