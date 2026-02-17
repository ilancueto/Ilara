import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/context/ToastContext";

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-outfit",
});

const baseUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// URL absoluta del logo para preview al compartir (WhatsApp, etc.) – Raw GitHub
const ogImageUrl =
  "https://raw.githubusercontent.com/ilancueto/AppIlara/main/assets/logo_icon.png";

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: "✨ Ilara Beauty",
  description: "Sistema de inventario, ventas y finanzas",
  manifest: "/manifest.json",
  icons: {
    icon: ogImageUrl,
    apple: ogImageUrl,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Ilara Beauty",
  },
  openGraph: {
    title: "Ilara Beauty",
    description: "Sistema de inventario, ventas y finanzas",
    images: [ogImageUrl],
  },
  twitter: {
    card: "summary",
    title: "Ilara Beauty",
    images: [ogImageUrl],
  },
};

export const viewport: Viewport = {
  themeColor: "#ff6eb4",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <head>
        <link href="https://fonts.cdnfonts.com/css/mareline-script" rel="stylesheet" />
      </head>
      <body className={`${outfit.variable} antialiased`}>
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}