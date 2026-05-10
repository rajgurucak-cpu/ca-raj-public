import crypto from 'crypto';
import { db } from '../../db.js';

// 31 scanners — extracted verbatim from original_frontend.html SCANNERS array.
export const SCANNERS = [
  // ---- FREE TIER (8) ----
  { name: 'NR7 — Narrow Range 7', url: 'https://chartink.com/screener/copy-nr7-atfinallynitin-449', tier: 'free', cat: 'setup', bias: 'bull', descr: "Today's range is the narrowest of last 7 days — coiled spring setup" },
  { name: 'Stage 2 Breakout (HPA)', url: 'https://chartink.com/screener/copy-stage-2-breakout-hpa-4', tier: 'free', cat: 'breakout', bias: 'bull', descr: "Stocks transitioning from base into Stan Weinstein's Stage 2 advance" },
  { name: 'Landry Trend Template', url: 'https://chartink.com/screener/copy-landry-trend-template-2', tier: 'free', cat: 'setup', bias: 'bull', descr: "Dave Landry's pullback-in-uptrend template — buy the dip in strength" },
  { name: '2 Supertrend 10/3 Buy', url: 'https://chartink.com/screener/copy-2-super-trend-10-3-buy', tier: 'free', cat: 'momentum', bias: 'bull', descr: 'Dual Supertrend confluence buy signal — both indicators flipped green' },
  { name: 'Flags (FinallyNitin)', url: 'https://chartink.com/screener/copy-flags-atfinallynitin-323', tier: 'free', cat: 'setup', bias: 'bull', descr: 'Bull flag continuation patterns — pole + tight pullback' },
  { name: 'Bull Snort Volume', url: 'https://chartink.com/screener/copy-bull-snort-volume-atfinallynitin-221', tier: 'free', cat: 'breakout', bias: 'bull', descr: 'Aggressive volume expansion with bullish price action' },
  { name: '52W High + 80% DCR (HPA)', url: 'https://chartink.com/screener/copy-52weekhigh-with-80-dcr-for-hpa-11', tier: 'free', cat: 'breakout', bias: 'bull', descr: '52-week high breakout with strong daily close range — institutional accumulation' },
  { name: 'BBB 25 Mins', url: 'https://chartink.com/screener/bbb-25-mins', tier: 'free', cat: 'intraday', bias: 'bull', descr: 'Bollinger Band breakout on 25-minute timeframe — intraday momentum entry' },

  // ---- PRO — RAJ / GURU BRANDED (6) ----
  { name: 'Raja Khela Hobe — 25 Mins', url: 'https://chartink.com/screener/raja-khela-hobe-25-mins', tier: 'pro', cat: 'intraday', bias: 'bull', descr: 'Signature CA RAJ intraday momentum scanner — 25-min timeframe trigger' },
  { name: 'Raja Khela Hobe — Nifty 500', url: 'https://chartink.com/screener/raja-khela-hobe-25-mins-nifty-500', tier: 'pro', cat: 'intraday', bias: 'bull', descr: 'Same logic, filtered to Nifty 500 universe for liquid intraday plays' },
  { name: 'Homma Khela Hobe — F&O', url: 'https://chartink.com/screener/copy-homma-khela-hobe-fno-2', tier: 'pro', cat: 'fno', bias: 'bull', descr: 'F&O universe variant — momentum bursts in derivatives stocks' },
  { name: 'Homma Khela Hobe', url: 'https://chartink.com/screener/copy-homma-khela-hobe-125', tier: 'pro', cat: 'momentum', bias: 'bull', descr: 'Cash market version — Homma-style price action momentum' },
  { name: 'Homma ADX Momentum Burst', url: 'https://chartink.com/screener/copy-homma-adx-momentum-burst-daily-18', tier: 'pro', cat: 'momentum', bias: 'bull', descr: 'Daily ADX-confirmed momentum ignition — strong trend onset' },
  { name: 'Base Break Oversold (Raj Sir)', url: 'https://chartink.com/screener/base-break-oversold-shaper-scanner-by-raj-sir', tier: 'pro', cat: 'reversal', bias: 'bull', descr: 'Oversold bounce off base structure — mean reversion with edge' },

  // ---- PRO — RAVI SIR (4) ----
  { name: 'Loki Shaper 3 EMA Shakeout', url: 'https://chartink.com/screener/copy-loki-shaper-3-ema-shakeout-scanner-by-ravi-sir-15', tier: 'pro', cat: 'reversal', bias: 'bull', descr: 'EMA shakeout reversal pattern — failed breakdown becomes breakout' },
  { name: '50 DBBR Scanner (Ravi Sir)', url: 'https://chartink.com/screener/copy-50dbbr-scannar-by-ravi-sir-4', tier: 'pro', cat: 'breakout', bias: 'bull', descr: "50-day Bollinger Band breakout reversal — Ravi Sir's setup" },
  { name: '21 / 50 DBBR Combo (Ravi Sir)', url: 'https://chartink.com/screener/copy-21dbbr-50dbbr-scanner-by-ravi-sir-4', tier: 'pro', cat: 'breakout', bias: 'bull', descr: 'Confluence of 21 and 50-day DBBR — high conviction signal' },
  { name: 'Hidden Pivot Scanner (Ravi Sir)', url: 'https://chartink.com/screener/copy-hidden-pivot-scanner-by-ravi-sir-25', tier: 'pro', cat: 'setup', bias: 'bull', descr: 'Hidden pivot point reversal — institutional turning level identifier' },

  // ---- PRO — atfinallynitin (3) ----
  { name: 'Stage 2 Stocks (FinallyNitin)', url: 'https://chartink.com/screener/copy-stage-2-stocks-atfinallynitin-266', tier: 'pro', cat: 'setup', bias: 'bull', descr: 'Pure Stage 2 universe — stocks already in advance phase' },
  { name: 'HVQ HVY HVE (FinallyNitin)', url: 'https://chartink.com/screener/copy-hvq-hvy-hve-atfinallynitin-245', tier: 'pro', cat: 'volume', bias: 'bull', descr: 'High volume on quarterly / yearly / earnings basis — institutional footprint' },
  { name: 'PPV Setup (FinallyNitin)', url: 'https://chartink.com/screener/copy-ppv-atfinallynitin-204', tier: 'pro', cat: 'momentum', bias: 'bull', descr: 'Price-Pivot-Volume confluence — three-factor momentum setup' },

  // ---- PRO — SH series + Misc (10) ----
  { name: 'VCP — ATR & BB Gap (Prakhar)', url: 'https://chartink.com/screener/copy-volatility-contraction-with-atr-and-bb-gap-atstocksbyprakhar-348', tier: 'pro', cat: 'setup', bias: 'bull', descr: 'Volatility contraction via ATR collapse and BB squeeze near pivot' },
  { name: "All Things Tightness (Sakata's Homma)", url: 'https://chartink.com/screener/copy-all-things-tightness-by-sakatas-homma-341', tier: 'pro', cat: 'setup', bias: 'bull', descr: 'Multi-condition tight consolidation scanner — every flavor of contraction' },
  { name: 'SHHTF Modified', url: 'https://chartink.com/screener/copy-shhtf-modified-124', tier: 'pro', cat: 'momentum', bias: 'bull', descr: 'Higher timeframe trend filter — modified SH approach' },
  { name: 'SHHTF Mini', url: 'https://chartink.com/screener/copy-shhtfmini-56', tier: 'pro', cat: 'momentum', bias: 'bull', descr: 'Compact higher-timeframe scanner variant — faster signal' },
  { name: 'SH Insider FII Activity', url: 'https://chartink.com/screener/copy-shinsiderfii-53', tier: 'pro', cat: 'fno', bias: 'bull', descr: 'Stocks tracking FII / institutional insider footprint' },
  { name: 'SHPB 10/21', url: 'https://chartink.com/screener/copy-shpb1021-472', tier: 'pro', cat: 'momentum', bias: 'bull', descr: '10/21 EMA pullback buy setup — trend-following entry trigger' },
  { name: 'SHSOD', url: 'https://chartink.com/screener/copy-shsod-179', tier: 'pro', cat: 'setup', bias: 'bull', descr: 'Strong open day setup — opening bar momentum confirmation' },
  { name: 'SHBBW Squeeze Entry', url: 'https://chartink.com/screener/copy-shbbwsqueeze-entry-126', tier: 'pro', cat: 'breakout', bias: 'bull', descr: 'Bollinger Band Width squeeze release — volatility expansion entry' },
  { name: 'Intraday Scan (Omkar Banne)', url: 'https://chartink.com/screener/copy-intraday-scan-omkar-banne-dss-8', tier: 'pro', cat: 'intraday', bias: 'bull', descr: "Omkar Banne's intraday momentum scanner — DSS-based filtering" },
  { name: 'MSwing Crossing Zero', url: 'https://chartink.com/screener/copy-mswing-crossing-zero-8', tier: 'pro', cat: 'momentum', bias: 'bull', descr: 'MSwing oscillator zero-line crossover — momentum direction shift' },
];

export function slugify(name) {
  return name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
}

export function seedIfEmpty() {
  const row = db.prepare('SELECT COUNT(*) as c FROM scanners').get();
  if (row.c > 0) {
    console.log(`[seed] scanners already seeded (${row.c})`);
    return;
  }
  const insert = db.prepare(
    `INSERT INTO scanners (id, name, url, tier, cat, bias, descr, live, webhook_secret, created_at, sort_order)
     VALUES (@id, @name, @url, @tier, @cat, @bias, @descr, @live, @webhook_secret, @created_at, @sort_order)`,
  );
  const tx = db.transaction((rows) => {
    rows.forEach((r) => insert.run(r));
  });
  const now = Date.now();
  const used = new Set();
  const rows = SCANNERS.map((s, i) => {
    let id = slugify(s.name);
    if (!id) id = 'scanner-' + (i + 1);
    let candidate = id;
    let n = 2;
    while (used.has(candidate)) candidate = id + '-' + n++;
    used.add(candidate);
    return {
      id: candidate,
      name: s.name,
      url: s.url,
      tier: s.tier,
      cat: s.cat,
      bias: s.bias,
      descr: s.descr,
      live: 1, // all live by default; admin can toggle
      webhook_secret: crypto.randomBytes(16).toString('hex'),
      created_at: now,
      sort_order: i,
    };
  });
  tx(rows);
  console.log(`[seed] inserted ${rows.length} scanners`);
}
