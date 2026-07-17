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

function logClientError(message: string, stack?: string, extra?: object) {
  // Uniquement en production
  if (process.env.NODE_ENV !== "production") return;
  try {
    navigator.sendBeacon(
      "/api/log-error",
      new Blob(
        [JSON.stringify({ source: "client", error_message: message, error_stack: stack, url: window.location.href, user_agent: navigator.userAgent, extra })],
        { type: "application/json" }
      )
    );
  } catch {}
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

  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      logClientError(event.message, event.error?.stack, { filename: event.filename, lineno: event.lineno });
    };
    const onUnhandled = (event: PromiseRejectionEvent) => {
      const msg = event.reason instanceof Error ? event.reason.message : String(event.reason ?? "Unhandled promise rejection");
      logClientError(msg, event.reason?.stack);
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandled);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandled);
    };
  }, []);

  // Capture du lien de parrainage (?ref=CODE) pour usage à l'inscription
  useEffect(() => {
    if (!router.isReady) return;
    const ref = typeof router.query.ref === "string" ? router.query.ref.trim().toUpperCase() : "";
    if (ref) {
      try { localStorage.setItem("lokt:ref", ref); } catch {}
    }
  }, [router.isReady, router.query.ref]);

  return (
    <>
      <Head>
        {/* Mobile-first SEO */}
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "lokt.fr",
              url: "https://lokt.fr",
              logo: "https://lokt.fr/lokt-logo.jpg",
              description: "Outil français de gestion locative gratuit et de simulateurs immobiliers pour propriétaires bailleurs particuliers.",
              sameAs: [],
              contactPoint: {
                "@type": "ContactPoint",
                contactType: "customer support",
                availableLanguage: "French",
              },
            }),
          }}
        />
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
