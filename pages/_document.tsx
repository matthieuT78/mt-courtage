// pages/_document.tsx
import { Html, Head, Main, NextScript } from "next/document";

const V = "20260118";

export default function Document() {
  return (
    <Html lang="fr">
      <Head>
        <meta charSet="utf-8" />

        {/* Favicons (tailles réelles) */}
        <link rel="icon" href={`/favicon.ico?v=${V}`} />
        <link rel="icon" type="image/png" sizes="16x16" href={`/favicon-16.png?v=${V}`} />
        <link rel="icon" type="image/png" sizes="32x32" href={`/favicon-32.png?v=${V}`} />
        <link rel="icon" type="image/png" sizes="48x48" href={`/favicon-48.png?v=${V}`} />
        <link rel="apple-touch-icon" sizes="180x180" href={`/apple-touch-icon.png?v=${V}`} />

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
