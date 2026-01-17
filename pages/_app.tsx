// pages/_app.tsx
import "../styles/globals.css";

import type { AppProps } from "next/app";
import Script from "next/script";
import Head from "next/head";
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
        {/* Mobile-first SEO */}
        <meta name="viewport" content="width=device-width, initial-scale=1" />
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
