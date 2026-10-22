import { useEffect } from "react";

// Utilisé par les pages /embed/* : signale la vraie hauteur du contenu à la
// page qui héberge l'iframe (via postMessage), pour que le script fourni
// dans le code d'intégration (voir /widget) puisse ajuster la hauteur de
// l'iframe automatiquement — sans ça, une hauteur fixe coupe le contenu ou
// force un double scroll dès que les résultats du simulateur s'affichent.
export function useWidgetAutoResize() {
  useEffect(() => {
    if (typeof window === "undefined" || window.parent === window) return;

    const postHeight = () => {
      const height = document.documentElement.scrollHeight;
      window.parent.postMessage({ source: "lokt-widget", height }, "*");
    };

    postHeight();
    const observer = new ResizeObserver(postHeight);
    observer.observe(document.documentElement);
    window.addEventListener("load", postHeight);

    return () => {
      observer.disconnect();
      window.removeEventListener("load", postHeight);
    };
  }, []);
}
