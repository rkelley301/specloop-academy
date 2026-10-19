import type { Metadata, Viewport } from "next";
import { AppShell } from "@/components/AppShell";
import { ServiceWorkerRegistration } from "@/components/ServiceWorker";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "SpecLoop Academy", template: "%s · SpecLoop Academy" },
  description: "Short narrated I&C lessons, retrieval quizzes, practical scenarios, and a simple spaced review schedule.",
  applicationName: "SpecLoop Academy",
  // iOS home-screen support; Android uses the web app manifest (app/manifest.ts).
  appleWebApp: { capable: true, title: "SpecLoop", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f6e68",
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
