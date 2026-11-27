/* eslint-disable @typescript-eslint/no-unused-expressions -- the file is one function expression that the Playwright MCP tool evaluates */
// Re-shoots the landing page / README screenshots in the light theme with fake demo data.
// Supabase (auth + REST) and /api/scan-receipt are mocked with Playwright routes, so no real
// account or data is involved. Needs `npm run dev` on :3000.
//
// Run it with the Playwright MCP tool `browser_run_code_unsafe`, passing this file as `filename`
// (the file must sit inside the repo or .playwright-mcp/). It writes expenses.png, scan.png and
// desktop.png to `out` (below); copy them to public/landing/ (not docs/screenshots/, which holds the README's dark-theme shots).
// REF is the public Supabase project ref from NEXT_PUBLIC_SUPABASE_URL (it names the auth storage key).
async (page0) => {
const REF = "ywmygkzatdvuliiwjpuh";
const UID = "00000000-0000-4000-8000-000000000001";
const now = new Date("2026-11-27T10:00:00Z");
const iso = (d) => d.toISOString();
const day = (n, h = 12) => { const d = new Date(now); d.setUTCDate(d.getUTCDate() - n); d.setUTCHours(h, 0, 0, 0); return iso(d); };

const cats = [
  ["c-groc", "Groceries", "cart", "green"],
  ["c-dine", "Dining", "utensils", "orange"],
  ["c-trans", "Transport", "tram", "purple"],
  ["c-fun", "Fun", "film", "pink"],
  ["c-home", "Household", "house", "blue"],
  ["c-health", "Health", "pill", "red"],
].map(([id, name, icon, color], i) => ({ id, account_id: UID, name, sort_order: i, icon, color, created_at: day(60), updated_at: day(60) }));

const pms = ["Revolut", "Visa", "Cash"].map((name, i) => ({ id: `pm-${name.toLowerCase()}`, account_id: UID, name, sort_order: i, created_at: day(60), updated_at: day(60) }));

let n = 0;
const ex = (d, item, amount, currency, cat, pm, location) => ({
  id: `e-${++n}`, account_id: UID, created_by_user_id: UID, amount, currency, expense_date: day(d, 9 + (n % 9)),
  category_id: cat, description: null, location, unit: 1, unit_price: amount, expire_date: null,
  payment_method_id: pm, item, metadata: {}, deleted_at: null, created_at: day(d), updated_at: day(d),
});
const expenses = [
  ex(0, "Oat milk", 1.49, "EUR", "c-groc", "pm-revolut", "Lidl"),
  ex(0, "Bananas", 1.29, "EUR", "c-groc", "pm-revolut", "Lidl"),
  ex(0, "Cappuccino", 3.6, "EUR", "c-dine", "pm-revolut", "Corner Café"),
  ex(1, "Pad thai", 80, "THB", "c-dine", "pm-cash", "Jay Fai Street Stall"),
  ex(1, "Jasmine rice", 89, "THB", "c-groc", "pm-visa", "Tops Market"),
  ex(1, "BTS day pass", 150, "THB", "c-trans", "pm-cash", "BTS Siam"),
  ex(2, "Sourdough loaf", 3.8, "EUR", "c-groc", "pm-cash", "Bakery Mayer"),
  ex(2, "Dish soap", 2.45, "EUR", "c-home", "pm-visa", "dm"),
  ex(3, "Monthly train pass", 49, "EUR", "c-trans", "pm-visa", null),
  ex(4, "Cinema", 11.5, "EUR", "c-fun", "pm-revolut", "Cinema City"),
  ex(5, "Yogurt", 1.29, "EUR", "c-groc", "pm-revolut", "Kaufland"),
  ex(5, "Vitamin D", 7.95, "EUR", "c-health", "pm-visa", "Pharmacy"),
  ex(7, "Pasta night", 27.4, "EUR", "c-dine", "pm-visa", "Trattoria Roma"),
  ex(9, "Weekly groceries", 38.6, "EUR", "c-groc", "pm-revolut", "Lidl"),
  ex(12, "Concert tickets", 39.49, "EUR", "c-fun", "pm-visa", "Eventim"),
  ex(15, "Light bulbs", 8.99, "EUR", "c-home", "pm-cash", "IKEA"),
  ex(30, "Weekly groceries", 41.2, "EUR", "c-groc", "pm-revolut", "Lidl"),
  ex(33, "Monthly train pass", 49, "EUR", "c-trans", "pm-visa", null),
  ex(36, "Dinner out", 34.5, "EUR", "c-dine", "pm-visa", "Mehana"),
  ex(40, "Groceries", 52.3, "EUR", "c-groc", "pm-revolut", "Kaufland"),
  ex(44, "Museum", 12, "EUR", "c-fun", "pm-cash", "National Gallery"),
];
const inventory = [];
const shopping = [];

const receipt = {
  storeName: "Lidl", date: "2026-11-27", total: 9.87, currency: "EUR",
  items: [
    { id: "r1", name: "Кисело мляко", translatedName: "Yogurt", amount: 1.29, quantity: 1, category: "Groceries" },
    { id: "r2", name: "Овесено мляко", translatedName: "Oat milk", amount: 1.49, quantity: 1, category: "Groceries" },
    { id: "r3", name: "Банани", translatedName: "Bananas", amount: 1.29, quantity: 1.1, category: "Groceries" },
    { id: "r4", name: "Хляб с квас", translatedName: "Sourdough bread", amount: 2.85, quantity: 1, category: "Groceries" },
    { id: "r5", name: "Препарат за съдове", translatedName: "Dish soap", amount: 2.95, quantity: 1, category: "Household" },
  ],
};

const user = { id: UID, aud: "authenticated", role: "authenticated", email: "demo@example.com", user_metadata: { full_name: "Demo" }, app_metadata: { provider: "email" }, created_at: day(60) };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const exp = Math.floor(now.getTime() / 1000) + 10 * 365 * 86400;
const token = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: UID, exp, role: "authenticated", aud: "authenticated" })}.sig`;
const session = { access_token: token, token_type: "bearer", expires_in: 3600 * 24 * 3650, expires_at: exp, refresh_token: "demo", user };

const TABLES = { expenses, categories: cats, payment_methods: pms, inventory_items: inventory, shopping_lists: shopping, account_users: [{ account_id: UID, user_id: UID, role: "owner" }], accounts: [{ id: UID, name: "Personal" }] };


  const browser = page0.context().browser();
  const out = process.cwd() + '/.playwright-mcp/shots';
  const shots = [];
  async function newPage(viewport) {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, colorScheme: 'light' });
    const page = await ctx.newPage();

  await page.context().addInitScript(({ key, session }) => {
    try {
      localStorage.setItem("theme", "light");
      localStorage.setItem(key, JSON.stringify(session));
    } catch {}
  }, { key: `sb-${REF}-auth-token`, session });
  await page.context().route(/supabase\.co\/auth\/v1\//, (r) => r.fulfill({ json: user }));
  await page.context().route(/supabase\.co\/rest\/v1\/([a-z_]+)/, (r) => {
    const t = r.request().url().match(/rest\/v1\/([a-z_]+)/)[1];
    const m = r.request().method();
    if (m !== "GET" && m !== "HEAD") return r.fulfill({ json: [] });
    const rows = TABLES[t] ?? [];
    return r.fulfill({ json: rows, headers: { "content-range": `0-${Math.max(rows.length - 1, 0)}/${rows.length}` } });
  });
  await page.context().route("**/api/scan-receipt", (r) => r.fulfill({ json: receipt }));

    return { ctx, page };
  }
  // Mobile expenses
  {
    const { ctx, page } = await newPage({ width: 390, height: 685 });
    await page.goto('http://localhost:3000/expenses', { waitUntil: 'networkidle' });
    await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: out + '/expenses.png' });
    shots.push('expenses');
    // Mobile scan review
    await page.goto('http://localhost:3000/scan', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
    const inputs = page.locator('input[type=file]');
    await inputs.nth(1).setInputFiles({ name: 'receipt.png', mimeType: 'image/png', buffer: png });
    await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' });
    await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: out + '/scan.png' });
    shots.push('scan');
    await ctx.close();
  }
  // Desktop
  {
    const { ctx, page } = await newPage({ width: 1280, height: 800 });
    await page.goto('http://localhost:3000/expenses', { waitUntil: 'networkidle' });
    await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: out + '/desktop.png' });
    shots.push('desktop');
    await ctx.close();
  }
  return shots;
}
