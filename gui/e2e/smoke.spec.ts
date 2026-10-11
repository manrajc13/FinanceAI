import { expect, test, type Page } from "@playwright/test";

const errors: string[] = [];

test.beforeEach(async ({ page }) => {
  errors.length = 0;
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.addInitScript(() => window.localStorage.removeItem("financeai-settings"));
});

test.afterEach(() => {
  expect(errors, errors.join("\n")).toEqual([]);
});

async function noHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

test("overview shows real KPIs, both charts and provenance", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Portfolio Overview" })).toBeVisible();
  const kpis = page.getByRole("region", { name: "Key figures" });
  await expect(kpis.getByText("Portfolio value")).toBeVisible();
  await expect(kpis.getByText(/^₹[\d,]+$/)).toBeVisible();
  await expect(kpis.getByText("10", { exact: true })).toBeVisible();
  await expect(kpis.getByText("Balanced", { exact: true })).toBeVisible();
  await expect(page.getByRole("img", { name: /Simulated value from ₹10,00,000/ })).toBeVisible();
  await expect(page.getByRole("img", { name: /allocation by group/ })).toBeVisible();
  await expect(page.getByText(/In-sample hindsight simulation/)).toBeVisible();
  await expect(page.getByText(/risk-free 4.00%/)).toBeVisible();
  await expect(page.getByText("Jan 2021 – Dec 2025")).toBeVisible();
  await noHorizontalScroll(page);
});

test("allocation reconciles, saves a plan, and the plan can be deleted", async ({ page }) => {
  await page.goto("/allocation");
  await expect(page.getByRole("cell", { name: "₹10,00,000.00" })).toBeVisible();
  await page.getByLabel("Amount to allocate").fill("250000.50");
  await expect(page.getByRole("cell", { name: "₹2,50,000.50" })).toBeVisible();

  const name = `E2E plan ${Date.now()}`;
  await page.getByRole("button", { name: "Save plan" }).click();
  await page.getByLabel("Name").fill(name);
  await page.getByRole("dialog").getByRole("button", { name: "Save plan" }).click();
  await page.getByRole("button", { name: "Open plan" }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
  await expect(page.getByRole("cell", { name: "₹2,50,000.50" })).toBeVisible();

  await page.getByRole("button", { name: "Delete" }).first().click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
  await expect(page).toHaveURL(/\/plans$/);
  await expect(page.getByText(name)).toHaveCount(0);
});

test("optimizer shows buckets and handles infeasible limits", async ({ page }) => {
  await page.goto("/optimizer");
  await expect(page.getByText(/frontier points fit your limits/)).toBeVisible();
  await expect(page.getByText("Recommended for your emphasis")).toBeVisible();
  await page.getByRole("switch", { name: "Minimum return" }).click();
  await page.getByRole("slider", { name: "Minimum return" }).fill("0.7");
  await expect(page.getByText("No portfolio in this universe reached that return historically.")).toBeVisible();
  await page.getByRole("button", { name: "Relax limits" }).click();
  await expect(page.getByText(/frontier points fit your limits/)).toBeVisible();
});

test("portfolio tabs render holdings, comparison and the universe", async ({ page }) => {
  await page.goto("/portfolio");
  await expect(page.getByRole("heading", { name: "Balanced holdings" })).toBeVisible();
  await page.getByRole("tab", { name: "Compare profiles" }).click();
  await expect(page.getByRole("button", { name: "Set as my profile" })).toHaveCount(2);
  await page.getByRole("tab", { name: "Stock universe" }).click();
  await expect(page.getByRole("heading", { name: "Correlation" })).toBeVisible();
  await expect(page.getByRole("img", { name: /NVDA rebased price/ })).toBeVisible();
});

test("explainer generates a deterministic overview offline", async ({ page }) => {
  await page.goto("/explainer");
  await page.getByRole("button", { name: "Generate overview" }).click();
  await expect(page.getByText("Deterministic (offline)")).toBeVisible();
  await expect(page.getByText(/Figures are historical in-sample estimates/).first()).toBeVisible();
});

test("mobile layout has no horizontal scroll and a working menu @mobile", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Portfolio Overview" })).toBeVisible();
  await noHorizontalScroll(page);
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("dialog", { name: "Navigation" }).getByRole("link", { name: "Allocation" }).click();
  await expect(page.getByRole("heading", { name: "Allocation" })).toBeVisible();
  await noHorizontalScroll(page);
});
