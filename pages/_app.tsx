// pages/_app.tsx
import "../styles/globals.css";

import type { AppProps } from "next/app";
import Script from "next/script";
import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { PermissionProvider } from "../components/PermissionProvider";
import CookieConsent, { getStoredCookieConsent } from "../components/CookieConsent";

const GA_ID = process.env.NEXT_PUBLIC_GA_ID || "G-0J8NXZ3SBD";
// Vide tant que le projet Microsoft Clarity n'est pas créé — le script ne se
// charge alors simplement pas (pas d'ID à fournir en dur ni de faux ID).
const CLARITY_ID = process.env.NEXT_PUBLIC_CLARITY_ID || "";

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
  const [analyticsAllowed, setAnalyticsAllowed] = useState(false);

  useEffect(() => {
    setAnalyticsAllowed(getStoredCookieConsent()?.analytics === true);
    const onChange = (e: Event) => setAnalyticsAllowed((e as CustomEvent).detail?.analytics === true);
    window.addEventListener("lokt:cookie-consent-change", onChange);
    return () => window.removeEventListener("lokt:cookie-consent-change", onChange);
  }, []);

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

      {/* Mesure d'audience (Google Analytics + Microsoft Clarity) — chargée
          uniquement après consentement (RGPD), même catégorie dans le bandeau. */}
      {analyticsAllowed && (
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
          {CLARITY_ID && (
            <Script id="clarity" strategy="afterInteractive">
              {`
                (function(c,l,a,r,i,t,y){
                  c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
                  t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
                  y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
                })(window, document, "clarity", "script", "${CLARITY_ID}");
                // ✅ certains projets Clarity attendent un signal de consentement
                // explicite avant de collecter quoi que ce soit, même une fois le
                // script chargé — on ne charge déjà ce script qu'après consentement
                // (bandeau cookies), donc ce signal est toujours légitime ici.
                // try/catch plutôt qu'un typeof strict : selon le timing, le
                // stub peut déjà avoir été remplacé par le vrai objet Clarity.
                try { window.clarity("consent"); } catch (e) {}
              `}
            </Script>
          )}
        </>
      )}

      {/* Permissions globales */}
      <PermissionProvider>
        <Component {...pageProps} />
      </PermissionProvider>

      <CookieConsent />
    </>
  );
}
