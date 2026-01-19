// pages/_document.tsx
import { Html, Head, Main, NextScript } from "next/document";

// IMPORTANT : ne pas versionner les URLs des favicons (Google SERP ignore souvent ?v=...)
// Garde VERSION uniquement si tu veux l’utiliser ailleurs plus tard.
const VERSION = "20260118";

export default function Document() {
  return (
    <Html lang="fr">
      <Head>
        <meta charSet="utf-8" />

        {/* Favicons – URLs STABLES (recommandé pour Google) */}
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" type="image/png" sizes="48x48" href="/favicon-48x48.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />

        {/* Apple */}
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />

        {/* PWA / Android */}
        <link rel="manifest" href="/site.webmanifest" />

        {/* UI / identité */}
        <meta name="theme-color" content="#0f172a" />
        <meta name="application-name" content="lokt.fr" />
        <meta name="apple-mobile-web-app-title" content="lokt.fr" />
      </Head>

      <body className="bg-slate-100">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
