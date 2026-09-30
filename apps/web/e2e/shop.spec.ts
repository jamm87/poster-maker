import { expect, test, type Page } from "@playwright/test";

const SHOTS = process.env.SCREENSHOT_DIR;
const shot = async (page: Page, name: string) => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
};

test("portada y catálogo", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/(es|en)$/);
  await page.goto("/es");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("mapa");
  await shot(page, "01-home");
  await page.goto("/es/posters");
  await expect(page.getByText("Madrid").first()).toBeVisible();
  await page.goto("/es/poster/madrid");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Madrid");
  await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(1);
  await shot(page, "02-city");
});

test("configurador → prueba exacta → carrito → pago simulado → descargas", async ({ page }) => {
  await page.goto("/es/crear?city=barcelona");
  await expect(page.getByLabel("Título", { exact: true })).toHaveValue("Barcelona");
  await page.getByLabel("Título", { exact: true }).fill("Nuestro barrio");
  await page.getByLabel("Dedicatoria o fecha").fill("Desde 2019");
  await page.getByRole("button", { name: "+ Corazón" }).click();
  await page.getByRole("radio", { name: "Noir" }).click();
  await shot(page, "03-configurator");

  // Prueba exacta (renderizada por el worker)
  await page.getByRole("button", { name: "Ver prueba exacta" }).click();
  await expect(page.getByTestId("proof-image")).toBeVisible({ timeout: 60_000 });
  await shot(page, "04-proof");

  // Digital al carrito
  await page.getByRole("radio", { name: /Descarga digital/ }).check();
  await page.getByRole("button", { name: /Añadir al carrito/ }).click();
  await expect(page.getByRole("link", { name: /Añadido/ })).toBeVisible();

  // Mismo diseño enmarcado
  await page.getByRole("radio", { name: /Enmarcado/ }).check();
  await page.getByRole("button", { name: /Añadir al carrito/ }).click();
  await page.getByRole("link", { name: /Añadido/ }).click();

  await expect(page.getByTestId("cart-line")).toHaveCount(2);
  await shot(page, "05-cart");
  const checkout = page.getByTestId("checkout");
  await expect(checkout).toBeDisabled();
  await page.getByTestId("terms").check();
  await expect(checkout).toBeDisabled(); // falta el consentimiento de lo digital
  await page.getByTestId("waiver").check();
  await page.getByTestId("country").selectOption("FR");
  await checkout.click();

  await expect(page).toHaveURL(/\/es\/pedido\//);
  await expect(page.getByTestId("order-item")).toHaveCount(2);
  await expect(page.getByTestId("download-png")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("fulfillment-status")).toHaveText(/imprenta|producción|Incidencia/, { timeout: 30_000 });
  await shot(page, "06-order");

  const pngHref = await page.getByTestId("download-png").getAttribute("href");
  const res = await page.request.get(pngHref!);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toBe("image/png");
  const pdf = await page.request.get((await page.getByTestId("download-pdf").getAttribute("href"))!);
  expect((await pdf.body()).subarray(0, 4).toString()).toBe("%PDF");
});

test("admin: login, pedidos y export CSV", async ({ page }) => {
  await page.goto("/admin/pedidos");
  await expect(page).toHaveURL(/\/admin\/login/);
  await page.getByLabel("Contraseña").fill("mala");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByText("Contraseña incorrecta")).toBeVisible();
  await page.getByLabel("Contraseña").fill(process.env.ADMIN_PASSWORD ?? "admin-local");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("heading", { name: "Pedidos" })).toBeVisible();
  await page.locator("td a").first().click();
  await expect(page.getByRole("heading", { name: /Pedido PM-/ })).toBeVisible();
  await expect(page.getByText("Gelato", { exact: true })).toBeVisible();
  await shot(page, "07-admin-order");
  const csv = await page.request.get("/api/admin/export");
  expect(csv.status()).toBe(200);
  expect(await csv.text()).toContain('"Pedido";');
  await page.goto("/admin/precios");
  await expect(page.getByRole("heading", { name: /Precios/ })).toBeVisible();
});

test("API protegida y validaciones", async ({ request }) => {
  expect((await request.get("/api/admin/export")).status()).toBe(401);
  expect((await request.post("/api/internal/render-complete", { data: { jobId: "x" } })).status()).toBe(401);
  expect((await request.post("/api/proofs", { data: { spec: { nope: 1 } } })).status()).toBe(400);
  expect((await request.get("/api/files/prints/x.png?exp=1&sig=bad")).status()).toBe(403);
});
