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

const defaultDescription =
  "Ilara: productos de belleza y cosmética. Catálogo online, novedades y pedidos por WhatsApp.";

/** OG/Twitter: icono del sitio; fallback a asset público si hiciera falta */
const ogImageUrl = `${siteUrl.replace(/\/$/, "")}/icon-512.png`;

export const metadata: Metadata = {
  metadataBase,
  title: {
    default: "Ilara",
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
    url: siteUrl,
    siteName: "Ilara",
    title: "Ilara",
    description: defaultDescription,
    images: [{ url: ogImageUrl, width: 512, height: 512, alt: "Ilara" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Ilara",
    description: defaultDescription,
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

const themeScript = `
(function() {
  var key = 'ilara-theme';
  var stored = localStorage.getItem(key);
  var dark = stored === 'dark' || (!stored && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
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