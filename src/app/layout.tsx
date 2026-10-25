import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "CrashLens",
  description:
    "Predictive failure radar and chaos sandbox for distributed microservice architectures",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-bg-pitch font-sans text-cream antialiased">
        {children}
      </body>
    </html>
  );
}
