import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/context/ToastContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { SupabaseSessionRecovery } from "@/components/SupabaseSessionRecovery";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { getSiteUrl } from "@/lib/site";

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-outfit",
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
    icon: "/icon-512.png",
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Ilara",
  },
  alternates: {
    canonical: "/",
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

/** Predeterminado claro; oscuro solo si el usuario lo guardó en localStorage. */
const themeScript = `
(function() {
  var key = 'ilara-theme';
  var stored = localStorage.getItem(key);
  var dark = stored === 'dark';
  document.documentElement.classList.toggle('dark', dark);
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <link rel="icon" href="/icon-512.png" type="image/png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link href="https://fonts.cdnfonts.com/css/mareline-script" rel="stylesheet" />
      </head>
      <body className={`${outfit.variable} antialiased`} suppressHydrationWarning>
        <ThemeProvider>
          <SupabaseSessionRecovery />
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