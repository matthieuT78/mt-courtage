import { useEffect, useState } from "react";

type Review = {
  id: string;
  name: string | null;
  note: number;
  commentaire: string;
  created_at: string;
};

function Stars({ note }: { note: number }) {
  return (
    <span aria-label={`${note} étoiles sur 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={n <= note ? "text-amber-400" : "text-slate-200"}>★</span>
      ))}
    </span>
  );
}

export default function ReviewsSection() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [average, setAverage] = useState<number | null>(null);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    fetch("/api/reviews/list")
      .then((r) => r.json())
      .then((d) => {
        setReviews(d.reviews ?? []);
        setAverage(d.average);
        setTotal(d.total ?? 0);
      })
      .catch(() => null);
  }, []);

  if (total === 0) return null;

  return (
    <section className="bg-white px-4 py-14 sm:py-20">
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-slate-500">Avis utilisateurs</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
              Ce qu'ils en pensent
            </h2>
          </div>
          {average && (
            <div className="flex items-center gap-3">
              <span className="text-4xl font-bold text-slate-900">{average.toFixed(1)}</span>
              <div>
                <div className="text-xl"><Stars note={Math.round(average)} /></div>
                <p className="text-xs text-slate-500 mt-0.5">{total} avis vérifié{total > 1 ? "s" : ""}</p>
              </div>
            </div>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {reviews.slice(0, 6).map((r) => (
            <div key={r.id} className="rounded-xl border border-slate-100 bg-slate-50 p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-slate-800">{r.name || "Utilisateur"}</span>
                <Stars note={r.note} />
              </div>
              <p className="text-sm text-slate-600 leading-relaxed line-clamp-4">"{r.commentaire}"</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
