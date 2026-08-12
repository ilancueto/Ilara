import type { Metadata, Viewport } from "next";
import { Fraunces, Outfit, Great_Vibes } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/context/ToastContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { SupabaseSessionRecovery } from "@/components/SupabaseSessionRecovery";
import { PwaRegister } from "@/components/PwaRegister";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import Script from "next/script";
import { getSiteUrl } from "@/lib/site";

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-outfit",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-fraunces",
  display: "swap",
});

/** Reemplaza Mareline (cdnfonts) por fuente self-hosted vía Google → Next (privacidad + CSP). */
const ilaraScript = Great_Vibes({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-ilara-script",
  display: "swap",
});

const siteUrl = getSiteUrl();
const metadataBase = new URL(siteUrl);

/** URL canónica para previews sociales (WhatsApp, Meta, Telegram). */
const canonicalShareOrigin =
  process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "") ||
  "https://ilara.com.ar";

const defaultDescription =
  "Descubrí Ilara, tu catálogo de productos de belleza en Neuquén. Maquillaje, skincare y cosmética con pedidos por WhatsApp.";

/** Texto para compartir (OG/Twitter); más corto y de marca que el meta description SEO. */
const shareTitle = "Ilara Beauty";
const shareDescription =
  "Descubrí productos de maquillaje, skincare y cosmética en Ilara Beauty.";

/** Link preview (OG/Twitter): `public/og-image.png` — recomendado 1200×630. URL absoluta normalizada. */
const ogImageUrl = new URL("/og-image.png", `${canonicalShareOrigin}/`).href;

export const metadata: Metadata = {
  metadataBase,
  title: {
    default: "Ilara | Productos de belleza en Neuquén",
    template: "%s | Ilara",
  },
  description: defaultDescription,
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Ilara",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  /** Open Graph global: og:type website. Sin fb:app_id. */
  openGraph: {
    type: "website",
    locale: "es_AR",
    url: canonicalShareOrigin,
    siteName: shareTitle,
    title: shareTitle,
    description: shareDescription,
    images: [
      {
        url: ogImageUrl,
        width: 1200,
        height: 630,
        alt: "Ilara Beauty",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: shareTitle,
    description: shareDescription,
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
    <html lang="es" suppressHydrationWarning>
      <head>
        <Script src="/ilara-theme-init.js" strategy="beforeInteractive" />
        <link rel="icon" href="/icon-512.png" type="image/png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body
        className={`${outfit.variable} ${fraunces.variable} ${ilaraScript.variable} antialiased`}
        suppressHydrationWarning
      >
        <ThemeProvider>
          <SupabaseSessionRecovery />
          <PwaRegister />
          <ToastProvider>
            {children}
          </ToastProvider>
        </ThemeProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
