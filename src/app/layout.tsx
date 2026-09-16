import type { Metadata, Viewport } from "next";
import { Anton, Inter } from "next/font/google";
import { ProvedorDeToast } from "@/components/ui/Toast";
import "@/styles/globals.css";

const display = Anton({
  weight: "400",
  subsets: ["latin"],
  variable: "--fonte-display",
  display: "swap",
});

const texto = Inter({
  subsets: ["latin"],
  variable: "--fonte-texto",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Canelada Santa",
    template: "%s · Canelada Santa",
  },
  description: "O aplicativo oficial do nosso racha.",
  applicationName: "Canelada Santa",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Canelada Santa",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icons/icone-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icone-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function LayoutRaiz({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${display.variable} ${texto.variable}`}>
      <body className="min-h-dvh antialiased">
        <ProvedorDeToast>{children}</ProvedorDeToast>
      </body>
    </html>
  );
}
