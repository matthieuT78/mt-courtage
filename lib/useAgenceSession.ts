import { useState, useEffect } from "react";

export function useAgenceSession(): boolean {
  const [isAgence, setIsAgence] = useState(false);

  useEffect(() => {
    const match = document.cookie.split(";").find((c) => c.trim().startsWith("lokt_agence="));
    setIsAgence(match?.trim() === "lokt_agence=1");
  }, []);

  return isAgence;
}
