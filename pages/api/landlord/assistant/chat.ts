// pages/api/landlord/assistant/chat.ts
//
// Orchestration de l'assistant IA du cockpit bailleur : boucle d'appels à
// Claude (tool use) où les outils en lecture s'exécutent automatiquement et
// tout outil qui écrit en base ("mutates: true") s'arrête pour demander une
// confirmation explicite au tour suivant. Conversation gérée côté client
// (le tableau complet de messages est renvoyé et transmis à chaque appel) :
// pas de persistance côté serveur pour cette v1.
import type { NextApiRequest, NextApiResponse } from "next";
import Anthropic from "@anthropic-ai/sdk";
import { requireApiUser } from "../../../../lib/apiAuth";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { getServerUserPlan, hasStripeLinkedSubscription } from "../../../../lib/serverPermissions";
import { ASSISTANT_TRIAL_LIFETIME_LIMIT } from "../../../../lib/permissions";
import { callCostUsd, usdToMicros, microsToUsd, landlordAssistantMonthlyBudgetUsd } from "../../../../lib/landlord/assistantCost";
import { assistantToolDefinitionsForClaude, getAssistantTool, type AssistantToolContext } from "../../../../lib/landlord/assistantTools";

type Json = Record<string, any>;
type QuotaScope = "trial" | "monthly_budget";

// Comptes internes (tests manuels) exemptés du quota Loky — jamais d'email en
// dur dans le code, la liste vit dans une variable d'env (ASSISTANT_UNLIMITED_EMAILS,
// séparés par des virgules). L'usage reste enregistré pour le monitoring, seul
// le blocage est désactivé.
function isAssistantUnlimitedEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const list = String(process.env.ASSISTANT_UNLIMITED_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}

const MAX_ITERATIONS = 8;

// Haiku : moitié prix de Sonnet (input et output), qualité suffisante pour
// ces outils une fois le disclaimer fiscal déplacé sur la page elle-même
// (SectionDeclaration.tsx) plutôt que reposé sur le modèle à chaque réponse.
// Ajustable sans changement de code via ANTHROPIC_ASSISTANT_MODEL si besoin.
const DEFAULT_MODEL = "claude-haiku-4-5-20251001";

function buildSystemPrompt(today: string): string {
  return `Tu es Loky, l'assistant intégré au cockpit bailleur de lokt.fr. Nous sommes le ${today} (format YYYY-MM-DD) : utilise cette date pour résoudre toute référence relative ("le mois actuel", "ce mois-ci", "l'année dernière"...) sans jamais la demander à l'utilisateur. Tu aides le bailleur connecté à réaliser des actions sur SON compte : créer un bien (y compris un immeuble à plusieurs lots), une fiche locataire, un bail, vérifier si un loyer a été payé, confirmer un loyer reçu (ce qui génère automatiquement la quittance), annuler un paiement confirmé par erreur, renvoyer une quittance, relancer un locataire en impayé, résilier un bail, encaisser/restituer un dépôt de garantie, ajouter une écriture Finance, envoyer/annuler une révision de loyer IRL, générer une mise en demeure ou une lettre de congé, chercher un locataire (en publiant une annonce pour recevoir des candidatures).

Tu n'es PAS un chatbot immobilier généraliste : tu ne réponds pas toi-même aux questions de culture générale sur l'immobilier, la fiscalité, le droit locatif ou l'investissement (ex. "dois-je faire du LMNP micro-BIC ou réel ?", "comment calculer un rendement ?"), même si elles semblent liées au métier de bailleur. Ton rôle se limite strictement aux actions listées ci-dessus sur le compte de l'utilisateur. Pour ce type de question, précise d'abord en une phrase que tu n'es ni juriste ni comptable et que ta réponse ne remplace pas un avis professionnel, puis redirige concrètement :
  - si la question touche au choix de régime fiscal ou à la préparation d'une déclaration, appelle open_declaration_helper (l'outil calcule avec les vrais chiffres du compte, ne tente jamais d'estimer toi-même) ;
  - sinon, appelle find_help_content et cite 1-2 titres/liens réels renvoyés par l'outil — n'invente jamais un titre ou une url de guide/article qui n'a pas été retourné par cet outil.

Règles impératives :
- Dès que l'utilisateur exprime une intention d'action (ex. "je veux créer un bail"), appelle IMMÉDIATEMENT les outils de lecture pertinents (list_properties, list_tenants, list_leases, list_lots) AVANT de poser la moindre question — ce sont des lectures gratuites et instantanées, il ne faut jamais demander à l'utilisateur une information que ces outils peuvent déjà donner. Utilise ensuite ce que tu as trouvé pour poser des questions concrètes et déjà orientées plutôt que des questions génériques : ex. si un seul locataire existe ("Julien Martin"), demande "C'est pour Julien Martin, ou un nouveau locataire ?" plutôt que "Qui est le locataire ?" ; si plusieurs biens existent, propose la liste avec leurs noms/adresses plutôt que de demander "quel bien ?" dans le vide. Le but est de minimiser le nombre d'allers-retours en s'appuyant sur les données réelles du compte à chaque étape.
- Ne jamais inventer un identifiant (bien, lot, locataire, bail). Avant d'appeler un outil de création qui référence un id, résous-le d'abord via les outils de lecture ci-dessus à partir du nom/adresse donné par l'utilisateur. S'il y a une ambiguïté (plusieurs biens possibles), demande de préciser en listant les options réelles.
- Si le bien concerné est un immeuble (type "building"), le lot loué est toujours obligatoire pour un bail ou une annonce : appelle list_lots et demande lequel si ce n'est pas clair.
- Ne demande jamais d'identifiant utilisateur : le compte actif est géré automatiquement par le système.
- Pose une question à la fois quand une information obligatoire manque, plutôt que de deviner une valeur.
- Pour l'inventaire LMNP (obligations de mobilier d'un logement meublé), n'appelle jamais list_properties seul pour proposer une liste : appelle list_lmnp_inventory_status, qui filtre déjà aux seuls biens/lots réellement éligibles (bail meublé actif) et te donne le détail de ce qui manque. Si un seul bien éligible existe, donne directement son état (% de conformité + liste des éléments manquants) sans redemander lequel. Utilise open_inventaire_lmnp seulement pour proposer d'aller compléter/corriger l'inventaire dans le cockpit, jamais pour éviter de répondre toi-même à "qu'est-ce qui manque ?".
- Pour savoir si un loyer a été payé, connaître le montant dû sur une période, OU savoir quand un loyer est/sera dû (ex. "est-ce que X a payé son loyer ?", "combien doit-il pour son dernier mois ?", "quand est prévu le prochain loyer ?"), résous d'abord le(s) bail(aux) concerné(s) puis appelle TOUJOURS list_rent_payments avec le mois demandé (calculé toi-même à partir de la date du jour ci-dessus si l'utilisateur dit "ce mois-ci"/"le mois actuel"/"prochain") : utilise le champ due_date renvoyé tel quel pour la date d'échéance — ne devine JAMAIS un jour du mois ni n'écris "dans la plupart des configurations", l'outil calcule la vraie échéance à partir du jour de paiement configuré sur le bail. Ne calcule jamais non plus un prorata ou un montant toi-même dans le texte. Ne redirige jamais vers open_quittances pour ce type de question, l'outil te donne directement la réponse.
- Un bien peut avoir eu plusieurs baux dans le temps (bail actif + baux terminés avec d'anciens locataires). Quand l'utilisateur désigne un bien par son adresse/nom sans préciser de locataire (ex. "la quittance de mars de Saint Rémy"), ne suppose JAMAIS que c'est le bail actif qui répond à la question : appelle list_leases (sans filtre de statut) pour voir tous les baux de ce bien, et choisis celui dont les dates couvrent réellement le mois demandé. Si list_rent_payments renvoie out_of_lease_range=true pour le bail choisi, ce n'est pas une absence de paiement : vérifie s'il existe un autre bail (souvent terminé) sur le même bien qui couvre cette période avant de répondre — ne conclus à "aucun paiement enregistré" qu'après avoir écarté cette possibilité.
- Pour une relance d'impayé, appelle toujours preview_payment_reminder avant send_payment_reminder, et montre le texte proposé à l'utilisateur avant de l'envoyer.
- Pour créer un bail, demande toujours explicitement le type de location (meublé résidence principale, meublé étudiant, mobilité, nu résidence principale, professionnel, autre) si l'utilisateur ne l'a pas précisé — ne suppose jamais "meublé" par défaut.
- Il n'existe pas d'action "générer une quittance" isolée : une quittance n'existe qu'une fois le loyer confirmé comme payé (confirm_payment), qui génère automatiquement le PDF dans la foulée. Si l'utilisateur demande "je veux une quittance" ou dit qu'un locataire a payé, résous le bail et la période concernés puis appelle confirm_payment. S'il te manque des infos pour savoir de quel bail/période il parle, ou si l'utilisateur veut juste consulter ses quittances existantes, appelle plutôt open_quittances (ça ouvre l'écran dédié) et explique en une phrase que la quittance apparaît automatiquement dès qu'un paiement y est confirmé.
- Si l'utilisateur veut le PDF d'une quittance directement dans la conversation (télécharger, avoir le lien, l'envoyer ailleurs...), appelle get_receipt_download_link plutôt que open_quittances — présente le lien renvoyé (download_url) sous forme de lien markdown avec un libellé court (ex. [Télécharger la quittance de mars 2026 (PDF)](download_url)), jamais l'URL brute en clair, et précise qu'il expire dans 10 minutes.
- Même logique pour un état des lieux (entrée ou sortie) : si l'utilisateur veut le PDF directement dans la conversation, appelle get_edl_download_link plutôt que open_etat_des_lieux, en précisant entrée ou sortie s'il ne l'a pas fait — présente le lien renvoyé (download_url) sous forme de lien markdown avec un libellé court, jamais l'URL brute en clair, et précise qu'il expire dans 10 minutes. Réserve open_etat_des_lieux aux cas où l'utilisateur veut réaliser/compléter l'état des lieux lui-même, pas récupérer un PDF déjà finalisé.
- Dès que tu as toutes les informations nécessaires pour un outil qui écrit en base (create_property, create_tenant, update_tenant, delete_tenant, restore_tenant, invite_tenant_portal, toggle_tenant_messaging, create_lease, confirm_payment, cancel_payment, resend_receipt, send_payment_reminder, terminate_lease, manage_deposit, add_finance_transaction, delete_finance_transaction, stop_recurring_transaction, update_recurring_transaction, send_rent_revision, cancel_rent_revision, generate_mise_en_demeure, generate_conge, create_listing), appelle-le IMMÉDIATEMENT, dans le même message que ta phrase d'explication — n'attends jamais une confirmation textuelle de l'utilisateur avant d'appeler l'outil. C'est l'interface qui affiche automatiquement un bouton "Confirmer" à partir de ton appel d'outil ; si tu attends une réponse de l'utilisateur avant d'appeler l'outil, ce bouton n'apparaît jamais et la conversation reste bloquée. La phrase d'explication qui accompagne l'appel doit utiliser des noms lisibles (jamais d'identifiants techniques) puisqu'elle est affichée juste au-dessus du bouton de confirmation.
- Après la création d'un bail, l'interface affiche déjà automatiquement des boutons vers les étapes suivantes pertinentes (contrat, état des lieux, inventaire LMNP si meublé) : n'appelle pas toi-même open_lease_contract / open_etat_des_lieux / open_inventaire_lmnp dans ce cas, contente-toi d'une phrase courte du type "tu trouveras juste en dessous les prochaines étapes". Ces trois outils de navigation restent disponibles pour une demande explicite plus tard dans la conversation (ex. "ouvre le contrat du bail de Julien" pour un bail déjà existant) : dans ce cas, résous le bail concerné puis appelle l'outil correspondant.
- terminate_lease est une action significative et peu réversible (clôture le bail, arrête les automatisations, archive le locataire) : ne l'appelle que si l'utilisateur exprime clairement vouloir mettre fin au bail (ex. "il part le 30/09", "résilie ce bail"), jamais sur une simple question du type "quelle est la date de fin de ce bail ?".
- Pour un impayé confirmé, generate_mise_en_demeure calcule lui-même les mois réellement impayés à partir des paiements enregistrés : ne demande jamais à l'utilisateur de lister les mois ou les montants, résous juste le bail concerné et appelle l'outil.
- generate_conge a un effet légal fort et des délais de préavis stricts : ne devine jamais le motif (reprise/vente/motif légitime), le nom du bénéficiaire, le prix de vente ou la description du motif — demande-les explicitement s'ils manquent. Demande toujours à l'utilisateur de confirmer la date d'effet exacte du congé (échéance ou anniversaire du bail) avant d'appeler l'outil, ne la calcule jamais toi-même.
- send_rent_revision calcule automatiquement le trimestre IRL de référence et utilise le dernier publié par défaut : ne demande les codes de trimestre à l'utilisateur que s'il veut explicitement les changer.
- Pour toute question sur les écritures Finance déjà enregistrées (charges, recettes, écritures récurrentes, historique par bien), appelle list_finance_transactions et réponds directement avec le résultat — n'appelle jamais open_declaration_helper pour ce type de question, qui sert uniquement à préparer une déclaration fiscale (régime, calculs), pas à consulter le grand livre.
- Pour une question de cashflow/bilan/rentabilité ("combien j'ai gagné", "quel est mon cashflow sur X"), appelle list_finance_transactions et utilise EXCLUSIVEMENT les chiffres du champ summary (total_in_confirmed, total_out_confirmed, net_confirmed, pending_in_not_confirmed, pending_out_not_confirmed) — ne resomme jamais les lignes de transactions toi-même, tu ferais des erreurs de calcul. Ne présente jamais un montant "pending" (non confirmé) comme s'il était déjà reçu/payé — dis explicitement qu'il est en attente. Termine en proposant open_performance (jamais open_finance) si l'utilisateur veut explorer le détail, puisque c'est l'écran qui calcule la rentabilité, pas le grand livre brut. Réserve open_finance aux demandes de consultation du grand livre lui-même (liste d'écritures), pas à une question de cashflow.
- Pour une question sur le taux d'occupation / la vacance des biens ("quel est mon taux d'occupation", "mes biens sont-ils loués ?"), appelle get_occupancy_stats et réponds directement avec les chiffres renvoyés (taux global, occupés/vacants, turnover, ancienneté du locataire en place, détail par bien si plusieurs biens ou si l'utilisateur en demande un en particulier) — ne recalcule jamais ça toi-même à partir de list_properties/list_leases. Termine en proposant open_biens (jamais open_performance) seulement si l'utilisateur veut explorer le détail visuellement, pas comme réponse par défaut.
- Pour l'état des lieux d'un bail dont le bien a bail_edl dans ses services délégués (voir list_properties ou le retour edl_delegated de open_etat_des_lieux), dis clairement que ce bail est géré par une agence externe et que la saisie guidée est désactivée pour ce bien — seul l'import du PDF fourni par l'agence est possible. Ne dis jamais qu'il pourra "créer" ou "consulter" l'état des lieux comme si la saisie normale était disponible.
- Pour "pourquoi je n'ai pas de quittance sur tel bail/bien ?", ne déduis JAMAIS qu'une quittance existe du seul fait qu'un loyer est marqué payé — vérifie toujours receipts_disabled (via list_leases ou list_rent_payments) et le champ has_receipt de list_rent_payments. Si receipts_disabled est vrai, explique en français courant que ce bail est marqué comme géré par une agence externe et que lokt ne génère jamais de quittance pour lui par conception (sans jamais écrire le nom du champ technique receipts_disabled ni sa valeur) — ce n'est pas une anomalie, ne présente jamais ça comme une bonne nouvelle inattendue. Si receipts_disabled est faux mais qu'un mois payé a has_receipt=false, c'est une vraie anomalie : dis-le clairement au lieu de l'occulter, et propose resend_receipt ou d'ouvrir Quittances pour régénérer.
- Pour toute question sur le dépôt de garantie d'un bail (montant prévu, encaissé ou non, restitué/retenu), résous le bail via list_leases et lis directement les champs deposit_amount/deposit_paid_at/deposit_paid_amount/deposit_returned_at/deposit_returned_amount/deposit_retained_amount — ne dis jamais que l'information n'est pas disponible ou renvoie vers l'interface, ces champs sont déjà dans le résultat de list_leases.
- delete_tenant est bloqué s'il existe le moindre historique de bail (même terminé) : dans ce cas, explique-le et n'insiste pas — l'archivage (via terminate_lease pour un bail actif) suffit à masquer la fiche sans perdre l'historique. restore_tenant réapparaît une fiche archivée mais ne réactive pas un bail terminé pour autant.
- Pour supprimer/arrêter/modifier une écriture Finance, résous d'abord l'écriture concernée via list_finance_transactions (jamais d'id inventé). Une écriture non récurrente se supprime avec delete_finance_transaction ; une écriture récurrente ne se supprime jamais directement — utilise stop_recurring_transaction pour l'arrêter (occurrences futures supprimées, passées conservées) ou update_recurring_transaction pour changer son montant/libellé (demande si le changement doit s'appliquer aux occurrences futures seulement ou aussi aux passées).
- Ne montre jamais à l'utilisateur les identifiants techniques internes (valeurs d'enum en snake_case comme furnished_primary, noms de champs, ids) que ce soit dans une explication d'action ou une réponse informative générale (ex. "quels types de baux existent ?") — utilise uniquement le libellé lisible en français ("Meublé résidence principale"), jamais entre parenthèses ou en code à côté.
- Réponds en français, de façon concise, chaleureuse et directe.`;
}

function extractBearerToken(req: NextApiRequest): string {
  const header = String(req.headers.authorization || "");
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || "";
}

function findToolUseBlock(messages: Anthropic.MessageParam[], toolUseId: string): Anthropic.ToolUseBlock | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.role !== "assistant" || !Array.isArray(message.content)) continue;
    const block = (message.content as any[]).find((b) => b?.type === "tool_use" && b.id === toolUseId);
    if (block) return block as Anthropic.ToolUseBlock;
  }
  return null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<Json>) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "Assistant IA non configuré (ANTHROPIC_API_KEY manquante côté serveur)." });

    const auth = await requireApiUser(req);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
    const userId = auth.userId;
    const bearerToken = extractBearerToken(req);

    const { messages, confirmedToolUseId, cancelledToolUseId } = (req.body || {}) as {
      messages?: Anthropic.MessageParam[];
      confirmedToolUseId?: string;
      cancelledToolUseId?: string;
    };
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "messages requis." });
    }

    if (!supabaseAdmin) return res.status(500).json({ error: "Supabase admin non configuré." });
    const plan = await getServerUserPlan(userId);
    // Un plan accordé à la main (compte de test, geste commercial) sans
    // abonnement Stripe réel derrière n'a droit qu'à un essai unique à vie
    // de Loky. Un vrai abonné est plafonné par un budget mensuel en dollars
    // (pas un nombre de messages) : le coût réel de Loky ne doit jamais
    // dépasser une part fixe de ce qu'il paie — voir assistantCost.ts.
    const isRealSubscriber = await hasStripeLinkedSubscription(userId);
    const unlimited = isAssistantUnlimitedEmail(auth.email);
    const today = new Date().toISOString().slice(0, 10);
    const currentMonth = today.slice(0, 7); // YYYY-MM

    const { data: usageRows, error: usageError } = await supabaseAdmin
      .from("assistant_usage_daily")
      .select("usage_date,message_count,cost_usd_micros")
      .eq("user_id", userId);
    if (usageError) return res.status(500).json({ error: usageError.message });
    const rows = usageRows || [];
    const todayRow = rows.find((r: any) => r.usage_date === today) as any;
    const usedTodayMessages = todayRow?.message_count || 0;
    const usedTodayCostMicros = todayRow?.cost_usd_micros || 0;
    const usedLifetimeMessages = rows.reduce((sum: number, r: any) => sum + (r.message_count || 0), 0);
    const usedThisMonthCostUsd = rows
      .filter((r: any) => String(r.usage_date).startsWith(currentMonth))
      .reduce((sum: number, r: any) => sum + microsToUsd(r.cost_usd_micros || 0), 0);

    const quotaScope: QuotaScope = isRealSubscriber ? "monthly_budget" : "trial";
    const monthlyBudgetUsd = landlordAssistantMonthlyBudgetUsd(plan);

    if (!unlimited && quotaScope === "trial" && usedLifetimeMessages >= ASSISTANT_TRIAL_LIFETIME_LIMIT) {
      return res.status(200).json({
        messages,
        done: true,
        limitReached: true,
        remaining: 0,
        quotaScope,
        quotaLimit: ASSISTANT_TRIAL_LIFETIME_LIMIT,
        limitMessage:
          "Tu as utilisé ton essai gratuit de Loky. L'accès complet à l'assistant IA est réservé aux abonnements lokt payants — merci de passer par Stripe pour en profiter pleinement.",
      });
    }
    if (!unlimited && quotaScope === "monthly_budget" && (monthlyBudgetUsd <= 0 || usedThisMonthCostUsd >= monthlyBudgetUsd)) {
      return res.status(200).json({
        messages,
        done: true,
        limitReached: true,
        remaining: 0,
        quotaScope,
        quotaLimit: monthlyBudgetUsd,
        limitMessage:
          monthlyBudgetUsd <= 0
            ? "Loky est réservé aux comptes bailleur — passe à un abonnement lokt pour en profiter."
            : "Tu as atteint l'usage de Loky inclus dans ton abonnement ce mois-ci. Ça se remet à jour le mois prochain.",
      });
    }

    const proto = String(req.headers["x-forwarded-proto"] || "http").split(",")[0];
    const baseUrl = `${proto}://${req.headers.host}`;
    const ctx: AssistantToolContext = { userId, bearerToken, baseUrl };

    let working: Anthropic.MessageParam[] = messages;
    let costIncurredUsd = 0;
    // Accumulé au fil des outils exécutés (celui confirmé ci-dessous, puis
    // ceux de la boucle plus bas) : un bail créé peut suggérer plusieurs
    // étapes suivantes (contrat, état des lieux, inventaire LMNP) d'un coup.
    const suggestedNavigations: Array<{ section: string; link: Record<string, any>; label: string }> = [];

    // Persiste le message + le coût réel de cette requête (une seule ligne
    // par jour, upsert) et renvoie les champs de quota à inclure dans la
    // réponse JSON — appelé à chaque point de sortie une fois le coût connu.
    async function recordUsageAndQuota() {
      const newCostMicros = usedTodayCostMicros + usdToMicros(costIncurredUsd);
      await supabaseAdmin!
        .from("assistant_usage_daily")
        .upsert(
          {
            user_id: userId,
            usage_date: today,
            message_count: usedTodayMessages + 1,
            cost_usd_micros: newCostMicros,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,usage_date" }
        );

      if (quotaScope === "trial") {
        const limit = ASSISTANT_TRIAL_LIFETIME_LIMIT;
        return { remaining: unlimited ? limit : Math.max(0, limit - (usedLifetimeMessages + 1)), quotaScope, quotaLimit: limit };
      }
      const usedThisMonthAfter = usedThisMonthCostUsd + costIncurredUsd;
      const limit = Math.round(monthlyBudgetUsd * 100) / 100;
      return {
        remaining: unlimited ? limit : Math.max(0, Math.round((monthlyBudgetUsd - usedThisMonthAfter) * 100) / 100),
        quotaScope,
        quotaLimit: limit,
      };
    }

    if (confirmedToolUseId || cancelledToolUseId) {
      const toolUseId = String(confirmedToolUseId || cancelledToolUseId);
      const toolUseBlock = findToolUseBlock(working, toolUseId);
      if (!toolUseBlock) {
        return res.status(400).json({ error: "Action à confirmer introuvable (conversation trop ancienne ?)." });
      }

      let resultContent: string;
      if (cancelledToolUseId) {
        resultContent = JSON.stringify({ cancelled: true, message: "Action annulée par l'utilisateur." });
      } else {
        const tool = getAssistantTool(toolUseBlock.name);
        if (!tool) {
          resultContent = JSON.stringify({ error: `Outil inconnu: ${toolUseBlock.name}` });
        } else {
          try {
            const result = await tool.execute(ctx, (toolUseBlock.input as Record<string, any>) || {});
            if (Array.isArray(result?.next_steps)) suggestedNavigations.push(...result.next_steps);
            resultContent = JSON.stringify(result);
          } catch (err: any) {
            resultContent = JSON.stringify({ error: err?.message || "Erreur lors de l'exécution de l'action." });
          }
        }
      }

      working = [
        ...working,
        { role: "user", content: [{ type: "tool_result", tool_use_id: toolUseId, content: resultContent }] },
      ];
    }

    const client = new Anthropic({ apiKey });
    // Le prompt système et la liste d'outils sont strictement identiques à
    // chaque appel (y compris les multiples appels internes d'un même
    // message) : marquer un point de cache dessus évite de repayer plein
    // tarif ces ~1700-2000 tokens à chaque itération de la boucle.
    const tools = assistantToolDefinitionsForClaude();
    if (tools.length > 0) {
      (tools[tools.length - 1] as Anthropic.Tool).cache_control = { type: "ephemeral" };
    }
    const cachedSystem: Anthropic.TextBlockParam[] = [{ type: "text", text: buildSystemPrompt(today), cache_control: { type: "ephemeral" } }];
    const model = process.env.ANTHROPIC_ASSISTANT_MODEL || DEFAULT_MODEL;

    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
      const response = await client.messages.create({
        model,
        max_tokens: 1024,
        system: cachedSystem,
        tools: tools as Anthropic.Tool[],
        // Un seul appel d'outil par tour : évite qu'un outil de lecture et un
        // outil d'écriture soient regroupés dans la même réponse, ce qui
        // laissait un tool_use sans tool_result quand on s'arrêtait pour
        // demander confirmation (erreur 400 côté API sur le tour suivant).
        tool_choice: { type: "auto", disable_parallel_tool_use: true },
        messages: working,
      });
      costIncurredUsd += callCostUsd(response.usage as any, model);

      working = [...working, { role: "assistant", content: response.content }];

      const toolUseBlocks = response.content.filter((block): block is Anthropic.ToolUseBlock => block.type === "tool_use");
      if (toolUseBlocks.length === 0) {
        const quota = await recordUsageAndQuota();
        return res.status(200).json({ messages: working, done: true, ...quota, suggestedNavigations });
      }

      const mutatingBlock = toolUseBlocks.find((block) => getAssistantTool(block.name)?.mutates);
      if (mutatingBlock) {
        const tool = getAssistantTool(mutatingBlock.name)!;
        const summary = tool.summarize
          ? await tool.summarize(ctx, (mutatingBlock.input as Record<string, any>) || {}).catch(() => null)
          : null;
        const quota = await recordUsageAndQuota();
        return res.status(200).json({
          messages: working,
          done: false,
          ...quota,
          suggestedNavigations,
          pendingAction: {
            toolUseId: mutatingBlock.id,
            toolName: mutatingBlock.name,
            args: mutatingBlock.input,
            description: tool.description,
            summary,
          },
        });
      }

      const toolResults = await Promise.all(
        toolUseBlocks.map(async (block) => {
          const tool = getAssistantTool(block.name);
          try {
            const result = tool ? await tool.execute(ctx, (block.input as Record<string, any>) || {}) : { error: `Outil inconnu: ${block.name}` };
            if (tool?.navigate && result?.navigation) suggestedNavigations.push(result.navigation);
            if (Array.isArray(result?.next_steps)) suggestedNavigations.push(...result.next_steps);
            return { type: "tool_result" as const, tool_use_id: block.id, content: JSON.stringify(result) };
          } catch (err: any) {
            return { type: "tool_result" as const, tool_use_id: block.id, content: JSON.stringify({ error: err?.message || "Erreur." }) };
          }
        })
      );
      working = [...working, { role: "user", content: toolResults }];
    }

    const quota = await recordUsageAndQuota();
    return res.status(200).json({ messages: working, done: true, ...quota, suggestedNavigations, warning: "Nombre maximum d'étapes atteint pour cette réponse." });
  } catch (error: any) {
    console.error("[api/landlord/assistant/chat] error:", error);
    return res.status(500).json({ error: error?.message || "Erreur interne." });
  }
}
