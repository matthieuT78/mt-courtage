#!/usr/bin/env python3
"""
ctr_gap_report.py — Pages où le CTR réel est en retard sur le CTR attendu
pour leur position moyenne Google (benchmark CTR par position).

But : prioriser quelles pages retravailler (title / meta description) en
premier, plutôt que de les reprendre une par une au hasard dans GSC.

Usage :
  python3 scripts/ctr_gap_report.py                  # 90 derniers jours, top 20
  python3 scripts/ctr_gap_report.py --days 28         # fenêtre plus courte
  python3 scripts/ctr_gap_report.py --min-impressions 100
  python3 scripts/ctr_gap_report.py --telegram        # envoie aussi le résumé sur Telegram

Dépend de seo_daily_report.py (même dossier) pour l'auth GSC — même
service account, pas de nouvelle credential à configurer.
"""

import argparse
import datetime
import sys

sys.path.insert(0, __file__.rsplit("/", 1)[0])
from seo_daily_report import _gsc_service, _gsc_query, SITE_URL, send_telegram  # noqa: E402

# CTR organique moyen par position, benchmark indicatif (étude type
# Backlinko/Advanced Web Ranking, SERP desktop+mobile confondus). Ce n'est
# pas une vérité Google — c'est une référence pour comparer *tes* pages
# entre elles, pas un objectif absolu garanti.
CTR_BENCHMARK = {
    1: 0.316, 2: 0.157, 3: 0.103, 4: 0.073, 5: 0.053,
    6: 0.041, 7: 0.033, 8: 0.028, 9: 0.025, 10: 0.022,
}


def expected_ctr(position: float) -> float:
    pos = round(position)
    if pos <= 1:
        return CTR_BENCHMARK[1]
    if pos >= 10:
        # Au-delà de la page 1, le CTR attendu continue de chuter — on
        # extrapole grossièrement en /2 tous les ~5 rangs sous la valeur à 10.
        return CTR_BENCHMARK[10] * (0.6 ** ((pos - 10) / 5))
    return CTR_BENCHMARK[pos]


def fetch_page_rows(svc, start: str, end: str, row_limit: int = 1000) -> list:
    return _gsc_query(svc, start, end, ["page"], row_limit=row_limit)


def build_gap_table(rows: list, min_impressions: int) -> list:
    out = []
    for r in rows:
        imp = int(r.get("impressions", 0))
        if imp < min_impressions:
            continue
        pos = r.get("position", 0)
        ctr = r.get("ctr", 0)
        exp = expected_ctr(pos)
        gap = exp - ctr
        out.append({
            "page": r["keys"][0].replace(SITE_URL, "") or "/",
            "impressions": imp,
            "clicks": int(r.get("clicks", 0)),
            "position": pos,
            "ctr": ctr,
            "expected_ctr": exp,
            "gap": gap,
            "lost_clicks": round(max(gap, 0) * imp),
        })
    out.sort(key=lambda x: x["lost_clicks"], reverse=True)
    return out


def format_report(gap_table: list, top_n: int, days: int) -> str:
    lines = [f"📉 <b>Écart CTR vs benchmark position — {days}j</b>\n"]
    underperforming = [g for g in gap_table if g["gap"] > 0.005][:top_n]
    if not underperforming:
        lines.append("Aucune page significativement sous le CTR attendu pour sa position.")
    else:
        lines.append("<b>À retravailler en priorité (title/meta) :</b>")
        for g in underperforming:
            lines.append(
                f"• {g['page'][:48]}\n"
                f"   pos. {g['position']:.1f} · CTR {g['ctr']*100:.1f}% "
                f"(attendu ~{g['expected_ctr']*100:.1f}%) · {g['impressions']} imp. "
                f"· ~{g['lost_clicks']} clics manqués/{days}j"
            )

    overperforming = sorted(
        [g for g in gap_table if g["gap"] < -0.01], key=lambda x: x["gap"]
    )[:5]
    if overperforming:
        lines.append("\n<b>Titles qui surperforment (à étudier, pas à toucher) :</b>")
        for g in overperforming:
            lines.append(
                f"• {g['page'][:48]} — pos. {g['position']:.1f} · "
                f"CTR {g['ctr']*100:.1f}% (attendu ~{g['expected_ctr']*100:.1f}%)"
            )

    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--days", type=int, default=90)
    parser.add_argument("--min-impressions", type=int, default=50)
    parser.add_argument("--top", type=int, default=20)
    parser.add_argument("--telegram", action="store_true")
    args = parser.parse_args()

    svc = _gsc_service()
    d_end = datetime.date.today() - datetime.timedelta(days=3)  # dernier jour GSC fiable
    d_start = d_end - datetime.timedelta(days=args.days - 1)
    fmt = lambda d: d.strftime("%Y-%m-%d")

    rows = fetch_page_rows(svc, fmt(d_start), fmt(d_end))
    gap_table = build_gap_table(rows, args.min_impressions)
    report = format_report(gap_table, args.top, args.days)

    # Version texte brut pour le terminal (sans balises HTML Telegram)
    plain = report.replace("<b>", "").replace("</b>", "")
    print(plain)

    if args.telegram:
        send_telegram(report)


if __name__ == "__main__":
    main()
