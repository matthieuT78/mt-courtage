// pages/_app.tsx
import type { AppProps } from "next/app";
import React from "react";
import { PermissionProvider } from "../components/PermissionProvider";
import "../styles/globals.css";

export default function MyApp({ Component, pageProps }: AppProps) {
  return (
    <PermissionProvider>
      <Component {...pageProps} />
    </PermissionProvider>
  );
}
