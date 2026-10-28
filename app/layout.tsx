import type {Metadata} from 'next';
import Script from 'next/script';
import './globals.css';
import './command-center-polish.css';
import './theme-light.css';
import './theme-corporate.css';
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import { cn } from "@/lib/utils";

import { AuthProvider, AuthGuard } from '@/components/auth-provider';
import { NavBar } from '@/components/navbar';
import { Toaster } from '@/components/ui/sonner';
import { MouseTracker } from '@/components/mouse-tracker';
import { AppExtras, AppMain } from '@/components/app-extras';
import { PwaRegister } from '@/components/pwa-register';
import { ThemeProvider } from '@/components/theme-provider';

const plexSans = IBM_Plex_Sans({
  subsets: ['latin', 'latin-ext'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
});

const plexMono = IBM_Plex_Mono({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500'],
  variable: '--font-mono-plex',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://assetguard.local'),
  title: 'AssetGuard EPP — Control de Seguridad Industrial',
  description: 'Plataforma corporativa de gestión de Equipo de Protección Personal con inteligencia artificial predictiva y monitoreo en tiempo real.',
  manifest: '/manifest.webmanifest',
  keywords: ['EPP', 'Seguridad Industrial', 'AssetGuard', 'Control de Equipos', 'Protección Personal'],
  authors: [{ name: 'José Luis Cruz' }],
  icons: {
    icon: '/favicon.ico',
    apple: '/icons/icon-192.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'AssetGuard EPP',
  },
  openGraph: {
    title: 'AssetGuard EPP — AssetGuard',
    description: 'Plataforma corporativa de gestión de Equipo de Protección Personal',
    type: 'website',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="es" className={cn("font-sans", plexSans.variable, plexMono.variable)} suppressHydrationWarning>
      <head>
        <Script src="/firebase-config.js" strategy="beforeInteractive" />
        <meta name="theme-color" content="#0B0F11" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body suppressHydrationWarning className="min-h-screen text-foreground antialiased selection:bg-primary/25">
        <ThemeProvider>
          <PwaRegister />
          <AuthProvider>
            <AuthGuard>
              <MouseTracker />
              <NavBar />
              <AppMain>
                {children}
              </AppMain>
              <AppExtras />
            </AuthGuard>
          </AuthProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
