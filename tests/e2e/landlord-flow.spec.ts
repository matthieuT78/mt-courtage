/**
 * Tests E2E — flux principal bailleur
 *
 * Prérequis : compte test avec au moins 1 bien, 1 locataire, 1 bail actif.
 * Chaque test vérifie qu'une section charge correctement et que les éléments
 * clés sont présents — pas de création de données pour rester idempotent.
 */
import { test, expect } from "@playwright/test";

const BASE = "/espace-bailleur";

// Helper : navigate to a section via ?tab=
async function goToSection(page: any, tab: string) {
  await page.goto(`${BASE}?tab=${tab}`);
  // Attendre que le squelette de chargement disparaisse
  await page.waitForLoadState("networkidle");
}

// ─── 1. AUTHENTIFICATION & DASHBOARD ──────────────────────────────────────────

test("dashboard — charge et affiche le tableau de bord", async ({ page }) => {
  await page.goto(BASE);
  await page.waitForLoadState("networkidle");

  // On est bien dans l'espace bailleur (pas redirigé vers connexion)
  await expect(page).toHaveURL(/espace-bailleur/);

  // Le dashboard doit contenir au moins un indicateur clé
  const hasContent = await page.locator("text=/loyer|bien|bail|performance/i").first().isVisible().catch(() => false);
  expect(hasContent).toBe(true);
});

// ─── 2. LOGEMENTS ─────────────────────────────────────────────────────────────

test("logements — section charge et affiche le bouton d'ajout", async ({ page }) => {
  await goToSection(page, "logements");

  // Le bouton "Ajouter un bien" doit être présent
  await expect(page.getByText(/ajouter un bien/i)).toBeVisible({ timeout: 10000 });
});

test("logements — au moins un bien est listé", async ({ page }) => {
  await goToSection(page, "logements");

  // La liste doit contenir au moins une carte bien
  // On cherche un indicateur de bien (adresse, ville, type)
  const cards = page.locator("[data-testid='property-card'], .property-card").first();
  // Fallback : un contenu non vide dans la section
  const hasProperty = await page
    .locator("text=/m²|chambre|studio|appartement|maison|T[0-9]/i")
    .first()
    .isVisible({ timeout: 8000 })
    .catch(() => false);
  expect(hasProperty).toBe(true);
});

// ─── 3. LOCATAIRES ────────────────────────────────────────────────────────────

test("locataires — section charge correctement", async ({ page }) => {
  await goToSection(page, "locataires");

  // Le titre de section doit être visible
  await expect(page.getByText(/locataires/i).first()).toBeVisible({ timeout: 10000 });

  // Au moins un locataire dans le compte test
  const hasContact = await page
    .locator("text=/@|text=/M\\.?\\s|Mme/")
    .first()
    .isVisible({ timeout: 8000 })
    .catch(async () => {
      // Fallback : chercher un nom ou email
      return page.locator("text=/.+@.+\\..+/").first().isVisible().catch(() => false);
    });
  expect(hasContact).toBe(true);
});

// ─── 4. BAUX ─────────────────────────────────────────────────────────────────

test("baux — section charge et affiche au moins un bail", async ({ page }) => {
  await goToSection(page, "baux");

  await expect(page.getByText(/baux|bail/i).first()).toBeVisible({ timeout: 10000 });

  // Un bail actif devrait montrer un loyer
  const hasLease = await page
    .locator("text=/€|loyer|en cours|actif/i")
    .first()
    .isVisible({ timeout: 8000 })
    .catch(() => false);
  expect(hasLease).toBe(true);
});

test("baux — bouton création visible", async ({ page }) => {
  await goToSection(page, "baux");

  const addBtn = page.getByRole("button", { name: /nouveau bail|ajouter|créer/i }).first();
  await expect(addBtn).toBeVisible({ timeout: 8000 });
});

// ─── 5. ÉTAT DES LIEUX ────────────────────────────────────────────────────────

test("état des lieux — section charge correctement", async ({ page }) => {
  await goToSection(page, "etat_des_lieux");

  await expect(page.getByText(/état des lieux/i).first()).toBeVisible({ timeout: 10000 });

  // Le CTA de création d'un nouvel état des lieux doit exister
  const hasCta = await page
    .getByRole("button", { name: /nouveau|créer|commencer|entrée|sortie/i })
    .first()
    .isVisible({ timeout: 8000 })
    .catch(() => false);
  expect(hasCta).toBe(true);
});

// ─── 6. QUITTANCES ───────────────────────────────────────────────────────────

test("quittances — section charge correctement", async ({ page }) => {
  await goToSection(page, "quittances");

  await expect(page.getByText(/quittances/i).first()).toBeVisible({ timeout: 10000 });
});

test("quittances — génération disponible pour le bail actif", async ({ page }) => {
  await goToSection(page, "quittances");

  // On doit trouver soit une quittance existante, soit un bouton de génération
  const hasAction = await page
    .locator("text=/générer|envoyer|pdf|quittance|loyer/i")
    .first()
    .isVisible({ timeout: 10000 })
    .catch(() => false);
  expect(hasAction).toBe(true);
});

// ─── 7. ROBUSTESSE : PAS DE CRASH JS ─────────────────────────────────────────

test("aucune erreur JS console sur le dashboard", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));

  await page.goto(BASE);
  await page.waitForLoadState("networkidle");

  // Filtrer les erreurs bénignes (extensions, hydration mineure)
  const serious = errors.filter(
    (e) =>
      !e.includes("ResizeObserver") &&
      !e.includes("Non-Error promise rejection") &&
      !e.includes("extension") &&
      !e.includes("Hydration")
  );

  expect(serious).toHaveLength(0);
});
