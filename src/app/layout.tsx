import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { NotificationProvider } from "@/components/providers/NotificationProvider";

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "Abitur Cloud",
  description: "Die All-in-One Cloud für dein Abitur",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body
        className="antialiased font-sans"
      >
        <AuthProvider>
          <NotificationProvider>
            <AuthGuard>
              {children}
            </AuthGuard>
          </NotificationProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
