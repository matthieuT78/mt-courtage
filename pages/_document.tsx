// pages/_document.tsx
import { Html, Head, Main, NextScript } from "next/document";

const VERSION = "20260118"; // pour forcer le refresh cache si besoin

export default function Document() {
  return (
    <Html lang="fr">
      <Head>
        {/* Charset */}
        <meta charSet="utf-8" />

        {/* Favicons – standard Google / navigateurs */}
        <link rel="icon" href={`/favicon.ico?v=${VERSION}`} />
        <link
          rel="icon"
          type="image/png"
          sizes="16x16"
          href={`/favicon-16x16.png?v=${VERSION}`}
        />
        <link
          rel="icon"
          type="image/png"
          sizes="32x32"
          href={`/favicon-32x32.png?v=${VERSION}`}
        />

        {/* Apple */}
        <link
          rel="apple-touch-icon"
          sizes="180x180"
          href={`/apple-touch-icon.png?v=${VERSION}`}
        />

        {/* PWA / Android */}
        <link rel="manifest" href={`/site.webmanifest?v=${VERSION}`} />

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
