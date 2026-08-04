import type { Metadata } from "next";
import { GoogleAnalytics } from "@/src/components/google-analytics";
import "./globals.css";

export const metadata: Metadata = {
  title: "Workbox",
  description:
    "SitecoreAI Marketplace app: review the items waiting in workflow in this environment and run workflow commands on them",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans text-sm antialiased overflow-x-hidden">
        <GoogleAnalytics />
        {children}
      </body>
    </html>
  );
}
