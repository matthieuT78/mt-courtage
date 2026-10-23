import { useEffect } from "react";

// Utilisé par les pages /embed/* : signale la vraie hauteur du contenu à la
// page qui héberge l'iframe (via postMessage), pour que le script fourni
// dans le code d'intégration (voir /widget) puisse ajuster la hauteur de
// l'iframe automatiquement — sans ça, une hauteur fixe coupe le contenu ou
// force un double scroll dès que les résultats du simulateur s'affichent.
export function useWidgetAutoResize() {
  useEffect(() => {
    if (typeof window === "undefined" || window.parent === window) return;

    // document.documentElement.scrollHeight est plafonné par sa propre
    // clientHeight (= la hauteur actuelle de l'iframe, pilotée par le
    // parent) : si le contenu rétrécit (ex. on revient à une étape plus
    // courte, ou on réduit le nombre de crédits), scrollHeight reste
    // bloqué à l'ancienne hauteur, plus grande, et l'iframe ne peut plus
    // jamais rapetisser. document.body.scrollHeight mesure la hauteur
    // réelle du contenu sans ce plancher (body n'est pas forcé à remplir
    // le viewport) — vérifié : avec une iframe artificiellement haute,
    // documentElement.scrollHeight restait collé à l'ancienne hauteur
    // alors que body.scrollHeight donnait la bonne valeur, plus petite.
    const postHeight = () => {
      const height = document.body.scrollHeight;
      window.parent.postMessage({ source: "lokt-widget", height }, "*");
    };

    postHeight();
    const observer = new ResizeObserver(postHeight);
    observer.observe(document.body);
    window.addEventListener("load", postHeight);

    return () => {
      observer.disconnect();
      window.removeEventListener("load", postHeight);
    };
  }, []);
}
