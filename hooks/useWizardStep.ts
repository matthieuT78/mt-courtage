import { useRouter } from "next/router";

export function useWizardStep() {
  const router = useRouter();
  const { step = "setup", roomId } = router.query;

  const go = (next: string, params: Record<string, string> = {}) => {
    router.push({
      pathname: router.pathname,
      query: { ...router.query, step: next, ...params },
    });
  };

  return {
    step: String(step),
    roomId: roomId ? String(roomId) : null,
    go,
  };
}
