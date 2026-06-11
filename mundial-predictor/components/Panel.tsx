import type { ReactNode } from "react";

export function Panel({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      <header className="hairline-b px-4 py-2">
        <span className="eyebrow">{label}</span>
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}
