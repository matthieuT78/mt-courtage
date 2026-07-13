import Link from "next/link";

type CalculatorHeroLink = {
  href: string;
  label: string;
};

type CalculatorHeroProps = {
  eyebrow: string;
  title: string;
  description: string;
  links?: CalculatorHeroLink[];
};

export default function CalculatorHero({ eyebrow, title, description, links = [] }: CalculatorHeroProps) {
  return (
    <section className="relative overflow-hidden px-4 pb-20 pt-10 text-white sm:pb-28 sm:pt-14">
      <div className="absolute inset-0 bg-gradient-to-br from-[#635bff] via-[#00a8d4] to-[#00c895]" />
      <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,.22)_0%,transparent_42%),linear-gradient(72deg,transparent_58%,rgba(255,184,0,.38)_100%)]" />
      <div className="relative mx-auto max-w-6xl">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-white/80">{eyebrow}</p>
        <h1 className="mt-4 max-w-4xl text-3xl font-semibold leading-tight sm:text-5xl">{title}</h1>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-white/85 sm:text-base sm:leading-7">{description}</p>
        <div aria-hidden="true" className="mt-6 flex flex-wrap gap-2 text-xs font-semibold text-white/90">
          <span className="rounded-full border border-white/30 bg-white/15 px-3 py-1.5 backdrop-blur">Gratuit</span>
          <span className="rounded-full border border-white/30 bg-white/15 px-3 py-1.5 backdrop-blur">Sans engagement</span>
          <span className="rounded-full border border-white/30 bg-white/15 px-3 py-1.5 backdrop-blur">Résultat immédiat</span>
        </div>
        {links.length ? (
          <nav aria-label="Autres calculettes" className="mt-6 flex flex-wrap gap-x-4 gap-y-2 text-xs font-semibold text-white/85">
            {links.map((link) => (
              <Link key={link.href} href={link.href} className="transition hover:text-white hover:underline">
                {link.label}
              </Link>
            ))}
          </nav>
        ) : null}
      </div>
    </section>
  );
}
