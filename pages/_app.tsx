// pages/_app.tsx
import "../styles/globals.css";

import type { AppProps } from "next/app";
import Head from "next/head";
import Script from "next/script";
import { useRouter } from "next/router";
import { useEffect } from "react";
import { PermissionProvider } from "../components/PermissionProvider";

const GA_ID = process.env.NEXT_PUBLIC_GA_ID || "G-0J8NXZ3SBD";

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();

  const path = router.asPath.split("?")[0];

  const shouldNoIndex =
    path.startsWith("/mon-compte") ||
    path.startsWith("/admin") ||
    path.startsWith("/espace-bailleur") ||
    path.startsWith("/simulateur/") ||
    path === "/auth" ||
    path === "/tarifs"; // retire cette ligne si tu veux indexer /tarifs

  useEffect(() => {
    const handleRouteChange = (url: string) => {
      window.gtag?.("config", GA_ID, { page_path: url });
    };

    router.events.on("routeChangeComplete", handleRouteChange);
    return () => router.events.off("routeChangeComplete", handleRouteChange);
  }, [router.events]);

  return (
    <>
      <Head>
        {shouldNoIndex ? (
          <meta name="robots" content="noindex,nofollow" />
        ) : (
          <meta name="robots" content="index,follow" />
        )}
      </Head>

      {/* Google Analytics */}
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga4" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_ID}', { anonymize_ip: true });
        `}
      </Script>

      {/* Permissions globales */}
      <PermissionProvider>
        <Component {...pageProps} />
      </PermissionProvider>
    </>
  );
}
