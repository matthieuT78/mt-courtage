// pages/_app.tsx
import type { AppProps } from "next/app";
import React, { useEffect } from "react";
import Script from "next/script";
import { useRouter } from "next/router";
import { PermissionProvider } from "../components/PermissionProvider";

// CSS global (Tailwind / global styles)
import "../styles/globals.css";

const GA_ID = process.env.NEXT_PUBLIC_GA_ID; // ex: G-0J8NXZ3SBD

export default function MyApp({ Component, pageProps }: AppProps) {
  const router = useRouter();

  // Track SPA navigation (Next pages router)
  useEffect(() => {
    if (!GA_ID) return;

    const handleRouteChange = (url: string) => {
      // @ts-ignore
      window.gtag?.("config", GA_ID, {
        page_path: url,
      });
    };

    router.events.on("routeChangeComplete", handleRouteChange);
    return () => {
      router.events.off("routeChangeComplete", handleRouteChange);
    };
  }, [router.events]);

  return (
    <>
      {GA_ID && (
        <>
          {/* Google Analytics GA4 */}
          <Script
            strategy="afterInteractive"
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
          />
          <Script id="ga4" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              window.gtag = gtag;
              gtag('js', new Date());
              gtag('config', '${GA_ID}', { anonymize_ip: true });
            `}
          </Script>
        </>
      )}

      <PermissionProvider>
        <Component {...pageProps} />
      </PermissionProvider>
    </>
  );
}
