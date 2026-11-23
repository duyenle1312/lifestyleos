"use client";

import { useState, type ReactNode } from "react";
import {
  activeFor,
  bucketBounds,
  bucketStartDate,
  bucketSums,
  eur,
  fmt,
  pct,
  pctChange,
  periodSum,
  ratio,
  timeAgo,
} from "@/lib/stats";
import type { DailyKey, Range, StatsResult, UsageStats } from "@/lib/types";
import { BarChart, bucketName, type Bucket } from "./BarChart";
import { ExpensesIcon, InventoryIcon, MoonIcon, ShoppingIcon, SunIcon, UsersIcon } from "./icons";
import { Sparkline } from "./Sparkline";

type Theme = "light" | "auto" | "dark";
type UsersMetric = "signups" | "active";
type ExpensesMetric = "expEur" | "expAdded" | "expDeleted";
type ShoppingMetric = "shopCreated" | "shopTicked" | "shopDeleted";
type InventoryMetric = "invAdded" | "invDeleted";

const PERIOD_NAME: Record<Range, string> = { 30: "last 30 days", 84: "last 12 weeks", 365: "last 12 months" };

const KIND_LABEL: Record<string, string> = {
  expense: "Expense",
  shopping: "Shopping item",
  inventory: "Inventory item",
  category: "Category",
  payment_method: "Payment method",
};

const ERROR_TEXT = { connect: "Can't reach the database", query: "The stats query failed" } as const;

export function Dashboard({ result }: { result: StatsResult }) {
  const [range, setRange] = useState<Range>(84);
  const [theme, setTheme] = useState<Theme>("auto");

  const pickTheme = (t: Theme) => {
    setTheme(t);
    if (t === "auto") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", t);
  };

  const mock = result.kind === "mock";

  return (
    <>
      {mock && <div className="mock-banner">Mock data — not connected to the database</div>}
      <div className="wrap">
        <header>
          <div>
            <div className="title-row">
              <h1>Usage &amp; Performance</h1>
              {mock && <span className="pill-status">MOCK DATA</span>}
            </div>
            <div className="sub">
              <span>Lifestyle OS</span>
              <span>·</span>
              <span>Aggregated metrics only, zero PII</span>
            </div>
          </div>

          <div className="controls">
            <div className="seg theme-seg" role="group" aria-label="Color Theme">
              <button aria-pressed={theme === "light"} title="Light Mode" aria-label="Light" onClick={() => pickTheme("light")}>
                <SunIcon />
              </button>
              <button aria-pressed={theme === "auto"} title="System Theme" onClick={() => pickTheme("auto")}>
                <span>Auto</span>
              </button>
              <button aria-pressed={theme === "dark"} title="Dark Mode" aria-label="Dark" onClick={() => pickTheme("dark")}>
                <MoonIcon />
              </button>
            </div>

            {result.kind !== "error" && (
              <div className="seg" role="group" aria-label="Time Period">
                {([30, 84, 365] as const).map((r) => (
                  <button key={r} aria-pressed={range === r} onClick={() => setRange(r)}>
                    {{ 30: "30 days", 84: "12 weeks", 365: "12 months" }[r]}
                  </button>
                ))}
              </div>
            )}
          </div>
        </header>

        {result.kind === "error" ? (
          <div className="card error-card">
            <h2>Couldn&apos;t load stats</h2>
            <p>{ERROR_TEXT[result.reason]}</p>
          </div>
        ) : (
          <Body stats={result.stats} range={range} dbMs={result.kind === "db" ? result.dbMs : null} />
        )}
      </div>
    </>
  );
}

// Buckets of one series for the chart, with their first and last day.
function toBuckets(values: number[], stats: UsageStats, range: Range): Bucket[] {
  return bucketBounds(range).map(([s, e], i) => ({
    v: values[i] ?? 0,
    start: bucketStartDate(stats.today, s),
    end: bucketStartDate(stats.today, Math.max(s, e - 1)),
  }));
}

function Body({ stats, range, dbMs }: { stats: UsageStats; range: Range; dbMs: number | null }) {
  const [usersM, setUsersM] = useState<UsersMetric>("signups");
  const [expM, setExpM] = useState<ExpensesMetric>("expEur");
  const [shopM, setShopM] = useState<ShoppingMetric>("shopCreated");
  const [invM, setInvM] = useState<InventoryMetric>("invAdded");

  const t = stats.totals;
  const d = stats.daily;
  const period = PERIOD_NAME[range];
  const per = bucketName(range);
  const p = (k: DailyKey, offset = 0) => periodSum(d[k], range, offset);
  const series = (k: DailyKey) => toBuckets(bucketSums(d[k], range), stats, range);

  const active = activeFor(stats, range);
  const signups = p("signups");
  const expAdded = p("expAdded");
  const expDeleted = p("expDeleted");
  const expEur = p("expEur");
  const expDelta = pctChange(expAdded, p("expAdded", 1));
  const last = stats.lastActivity;

  // Users
  const usersChart =
    usersM === "signups"
      ? { buckets: series("signups"), unit: "Sign-ups" }
      : { buckets: toBuckets(active, stats, range), unit: "Active users" };
  const avgActive = active.reduce((s, v) => s + v, 0) / Math.max(1, active.length);

  // Expenses
  const expChart = {
    expEur: { unit: "EUR tracked", formatter: eur },
    expAdded: { unit: "Expenses added", formatter: fmt },
    expDeleted: { unit: "Expenses deleted", formatter: fmt },
  }[expM];
  const perActiveUser = t.active30 === 0 ? "—" : fmt(expAdded / t.active30 / (range / 30));

  // Shopping
  const created = p("shopCreated");
  const ticked = p("shopTicked");
  const shopDeleted = p("shopDeleted");
  const completion = pct(ratio(ticked, created));
  const shopTotal = Math.max(1, ticked + shopDeleted + t.shoppingOpen);
  const share = (n: number) => (n / shopTotal) * 100;
  const shopUnit = { shopCreated: "Items created", shopTicked: "Items ticked off", shopDeleted: "Items deleted" }[shopM];

  // Inventory & setup
  const ofUsers = (n: number) => `${Math.round((ratio(n, t.users) ?? 0) * 100)}%`;

  return (
    <>
      <div className="kpis">
        <div className="card kpi">
          <div className="kpi-top">
            <span className="label">Total Users</span>
            <span className="delta-badge delta-up tnum">+{fmt(signups)} new</span>
          </div>
          <div className="kpi-main">
            <div className="value tnum">{fmt(t.users)}</div>
            <Sparkline values={active.slice(-10)} color="var(--ios-blue)" />
          </div>
          <div className="note">In {period}</div>
        </div>

        <div className="card kpi">
          <div className="kpi-top">
            <span className="label">Active Users (7d / 30d)</span>
            <span className="delta-badge delta-neutral tnum">{pct(ratio(t.active7, t.active30))} sticky</span>
          </div>
          <div className="kpi-main">
            <div className="value tnum">
              {fmt(t.active7)}{" "}
              <span style={{ fontSize: 18, color: "var(--label-2)", fontWeight: 600 }}>/ {fmt(t.active30)}</span>
            </div>
          </div>
          <div className="note">{pct(ratio(t.active30, t.users))} of total user base active</div>
        </div>

        <div className="card kpi">
          <div className="kpi-top">
            <span className="label">Expenses Logged</span>
            {expDelta !== null && (
              <span className={`delta-badge ${expDelta >= 0 ? "delta-up" : "delta-neutral"} tnum`}>
                {expDelta >= 0 ? "+" : ""}
                {Math.round(expDelta)}%
              </span>
            )}
          </div>
          <div className="kpi-main">
            <div className="value tnum">{fmt(expAdded)}</div>
            <Sparkline values={bucketSums(d.expEur, range).slice(-10)} color="var(--ios-green)" />
          </div>
          <div className="note">
            {eur(expEur)} EUR volume · {period}
          </div>
        </div>

        <div className="card kpi">
          <div className="kpi-top">
            <span className="label">Last Activity</span>
          </div>
          <div className="kpi-main">
            <div className="value" style={{ fontSize: 24, lineHeight: 1.25 }}>
              {last.at ? timeAgo(last.at, stats.generatedAt) : "No activity yet"}
            </div>
          </div>
          <div className="note">
            {last.at && <span className="pulse-dot" />}
            <span>
              {[last.at && last.kind ? (KIND_LABEL[last.kind] ?? last.kind) : null, dbMs !== null ? `DB ${Math.round(dbMs)}ms` : null]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </div>
        </div>
      </div>

      <div className="grid">
        <Section accent="blue" icon={<UsersIcon />} title="Users & Retention" pill={`${pct(t.retentionD30)} D30 retention`}
          stats={
            <>
              <Stat label="New sign-ups" value={fmt(signups)} note={period} pressed={usersM === "signups"} onClick={() => setUsersM("signups")} />
              <Stat label="Active users" value={fmt(avgActive)} note={`avg ${per}`} pressed={usersM === "active"} onClick={() => setUsersM("active")} />
              <StaticStat label="D30 Retention" value={pct(t.retentionD30)} note="active 30d post-signup" />
            </>
          }
          chart={<BarChart buckets={usersChart.buckets} range={range} unit={usersChart.unit} formatter={fmt} />}
        />

        <Section accent="green" icon={<ExpensesIcon />} title="Expenses" pill={`${pct(ratio(expAdded - expDeleted, expAdded))} net kept`}
          stats={
            <>
              <Stat label="Tracked in EUR" value={eur(expEur)} note={`${eur(t.eurAllTime)} all time`} pressed={expM === "expEur"} onClick={() => setExpM("expEur")} />
              <Stat label="Added" value={fmt(expAdded)} note={`${fmt(t.expensesAllTime)} all time`} pressed={expM === "expAdded"} onClick={() => setExpM("expAdded")} />
              <Stat label="Deleted" value={fmt(expDeleted)} note={`${fmt(t.expensesDeletedAllTime)} all time`} pressed={expM === "expDeleted"} onClick={() => setExpM("expDeleted")} />
              <StaticStat label="Per active user" value={perActiveUser} note="entries / month" />
            </>
          }
          extra={
            t.otherCurrencies.length > 0 && (
              <div className="meta-strip">
                <span>Other currencies (raw):</span>
                <div className="currency-pills tnum">
                  {t.otherCurrencies.map((c) => (
                    <span key={c.currency} className="curr-pill">
                      {fmt(c.amount)} {c.currency}
                    </span>
                  ))}
                </div>
              </div>
            )
          }
          chart={<BarChart buckets={series(expM)} range={range} unit={expChart.unit} formatter={expChart.formatter} />}
        />

        <Section accent="orange" icon={<ShoppingIcon />} title="Shopping List" pill={`${completion} completion`}
          stats={
            <>
              <Stat label="Created" value={fmt(created)} note={period} pressed={shopM === "shopCreated"} onClick={() => setShopM("shopCreated")} />
              <Stat label="Ticked off" value={fmt(ticked)} note={`${completion} of created`} pressed={shopM === "shopTicked"} onClick={() => setShopM("shopTicked")} />
              <Stat label="Deleted" value={fmt(shopDeleted)} note="removed unticked" pressed={shopM === "shopDeleted"} onClick={() => setShopM("shopDeleted")} />
              <StaticStat label="Open now" value={fmt(t.shoppingOpen)} note="on active lists" />
            </>
          }
          extra={
            <div className="split-box">
              <div
                className="split"
                role="img"
                aria-label={`Ticked off ${Math.round(share(ticked))}%, open ${Math.round(share(t.shoppingOpen))}%, deleted ${Math.round(share(shopDeleted))}%`}
              >
                <div style={{ width: `${share(ticked)}%`, background: "var(--ios-green)" }} />
                <div style={{ width: `${share(t.shoppingOpen)}%`, background: "var(--ios-gray)" }} />
                <div style={{ width: `${share(shopDeleted)}%`, background: "var(--ios-red)" }} />
              </div>
              <div className="legend tnum">
                <span><i style={{ background: "var(--ios-green)" }} />Ticked off <b>{Math.round(share(ticked))}%</b></span>
                <span><i style={{ background: "var(--ios-gray)" }} />Open <b>{Math.round(share(t.shoppingOpen))}%</b></span>
                <span><i style={{ background: "var(--ios-red)" }} />Deleted <b>{Math.round(share(shopDeleted))}%</b></span>
              </div>
            </div>
          }
          chart={
            <BarChart
              buckets={series(shopM)}
              range={range}
              unit={shopUnit}
              formatter={fmt}
              tipNote={shopM === "shopTicked" ? "Dated by last edit" : undefined}
            />
          }
        />

        <Section accent="indigo" icon={<InventoryIcon />} title="Inventory & Setup" pill={`${fmt(t.inventoryInStock)} items tracked`}
          stats={
            <>
              <Stat label="Added" value={fmt(p("invAdded"))} note={period} pressed={invM === "invAdded"} onClick={() => setInvM("invAdded")} />
              <Stat label="Removed" value={fmt(p("invDeleted"))} note={period} pressed={invM === "invDeleted"} onClick={() => setInvM("invDeleted")} />
              <StaticStat label="In stock now" value={fmt(t.inventoryInStock)} note="across all households" />
              <StaticStat label="Expiring soon" value={<span className="alert-badge">{fmt(t.inventoryExpiring7)} items</span>} note="within next 7 days" />
            </>
          }
          extra={
            <ul className="rows">
              <li>
                <span>Custom expense categories</span>
                <div className="row-right">
                  <div className="mini-prog" aria-hidden="true"><div style={{ width: ofUsers(t.usersWithCustomCategories) }} /></div>
                  <span className="v tnum">{fmt(t.usersWithCustomCategories)} of {fmt(t.users)}</span>
                </div>
              </li>
              <li>
                <span>Custom payment methods</span>
                <div className="row-right">
                  <div className="mini-prog" aria-hidden="true"><div style={{ width: ofUsers(t.usersWithCustomPaymentMethods) }} /></div>
                  <span className="v tnum">{fmt(t.usersWithCustomPaymentMethods)} of {fmt(t.users)}</span>
                </div>
              </li>
            </ul>
          }
          chart={<BarChart buckets={series(invM)} range={range} unit={invM === "invAdded" ? "Items added" : "Items removed"} formatter={fmt} />}
        />
      </div>
    </>
  );
}

function Section({
  accent,
  icon,
  title,
  pill,
  stats,
  extra,
  chart,
}: {
  accent: string;
  icon: ReactNode;
  title: string;
  pill: string;
  stats: ReactNode;
  extra?: ReactNode;
  chart: ReactNode;
}) {
  return (
    <section className="card section" data-accent={accent}>
      <div className="section-head">
        <h2>
          <span className="dot">{icon}</span>
          {title}
        </h2>
        <span className="sec-pill">{pill}</span>
      </div>
      <div className="stats">{stats}</div>
      {extra}
      {chart}
    </section>
  );
}

function Stat({ label, value, note, pressed, onClick }: { label: string; value: string; note: string; pressed: boolean; onClick: () => void }) {
  return (
    <button className="stat" aria-pressed={pressed} onClick={onClick}>
      <div className="stat-top">
        <span className="label">{label}</span>
      </div>
      <div className="value tnum">{value}</div>
      <div className="note">{note}</div>
    </button>
  );
}

function StaticStat({ label, value, note }: { label: string; value: ReactNode; note: string }) {
  return (
    <div className="stat static">
      <div className="stat-top">
        <span className="label">{label}</span>
      </div>
      <div className="value tnum">{value}</div>
      <div className="note">{note}</div>
    </div>
  );
}
