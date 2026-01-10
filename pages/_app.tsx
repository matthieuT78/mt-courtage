import type { AppProps } from "next/app";
import Script from "next/script";
import { useRouter } from "next/router";
import { useEffect } from "react";

const GA_ID = process.env.NEXT_PUBLIC_GA_ID || "G-0J8NXZ3SBD"; // tu peux enlever le fallback après

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

      <Component {...pageProps} />
    </>
  );
}
