// components/BlurGate.tsx
export function BlurGate({
  unlocked,
  children,
}: {
  unlocked: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={unlocked ? "" : "blur-sm select-none"}>
      {children}
    </div>
  );
}
