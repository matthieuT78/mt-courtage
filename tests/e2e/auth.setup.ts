import { test as setup, expect } from "@playwright/test";
import path from "path";

const authFile = path.join(__dirname, "../.auth/user.json");

setup("authenticate", async ({ page }) => {
  const email = process.env.TEST_USER_EMAIL;
  const password = process.env.TEST_USER_PASSWORD;
  if (!email || !password) throw new Error("TEST_USER_EMAIL et TEST_USER_PASSWORD requis dans .env.test");

  await page.goto("/mon-compte?mode=login");

  // Attendre que le formulaire soit visible
  await page.locator("#login_email").waitFor({ state: "visible", timeout: 10000 });
  await page.locator("#login_email").fill(email);
  await page.locator("#login_password").fill(password);
  await page.getByRole("button", { name: /se connecter/i }).click();

  // Attendre la redirection post-login vers l'espace bailleur
  await page.waitForURL(/espace-bailleur/, { timeout: 15000 });

  await page.context().storageState({ path: authFile });
});
