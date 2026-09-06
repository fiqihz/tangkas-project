import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { PwaRegister } from "@/components/pwa-register";
import { Analytics } from "@vercel/analytics/react";

// Inter = body/UI (kebacaan tinggi). Space Grotesk = display/headline (sporty
// tapi clean). Di-expose sebagai CSS var agar dipakai lewat Tailwind fontFamily.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "TangkasBoard",
  description: "Manajemen sesi mabar badminton — matchmaking adil & leaderboard",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/favicon-48.png", sizes: "48x48", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/icons/icon-192.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "TangkasBoard",
  },
};

export const viewport: Viewport = {
  themeColor: "#16a34a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        {/* Anti-flash: set class `dark` & atribut lang SEBELUM paint pertama,
            berdasarkan pilihan tersimpan (fallback preferensi OS). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('tb.theme');if(!t){t=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}if(t==='dark'){document.documentElement.classList.add('dark');}var l=localStorage.getItem('tb.lang');if(l==='en'||l==='id'){document.documentElement.lang=l;}}catch(e){}})();`,
          }}
        />
      </head>
      <body
        className={`${inter.variable} ${spaceGrotesk.variable} min-h-screen font-sans antialiased`}
      >
        <PwaRegister />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
