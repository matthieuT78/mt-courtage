// pages/_app.tsx
import type { AppProps } from "next/app";
import React from "react";
import Script from "next/script";
import { PermissionProvider } from "../components/PermissionProvider";

// CSS global (Tailwind / global styles)
import "../styles/globals.css";

export default function MyApp({ Component, pageProps }: AppProps) {
  return (
    <>
      {/* Google Analytics GA4 */}
      <Script
        strategy="afterInteractive"
        src="https://www.googletagmanager.com/gtag/js?id=G-0J8NXZ3SBD"
      />

      <Script id="ga4" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-0J8NXZ3SBD', {
            page_path: window.location.pathname,
          });
        `}
      </Script>

      <PermissionProvider>
        <Component {...pageProps} />
      </PermissionProvider>
    </>
  );
}
