import {
  POSTER_COPY,
  RESULT_LIBRARY,
  type ResultType,
} from "./heartbeat-game-config.ts";

export type GameStats = {
  score: number;
  combo: number;
  maxCombo: number;
  redHits: number;
  goldHits: number;
  greenHits: number;
  totalClicks: number;
  successfulHits: number;
};

export type ResultProfile = {
  type: ResultType;
  title: string;
  copy: string;
  signature: string;
  accuracy: number;
  accuracyText: string;
};

export type PosterPayload = {
  playerName: string;
  title: string;
  score: number;
  accuracyText: string;
  maxCombo: number;
  copy: string;
};

export function calculateAccuracy(stats: Pick<GameStats, "successfulHits" | "totalClicks">) {
  if (stats.totalClicks === 0) {
    return 0;
  }

  return Number((stats.successfulHits / stats.totalClicks).toFixed(4));
}

export function getComboBonus(combo: number) {
  if (combo > 0 && combo % 10 === 0) {
    return 50;
  }

  if (combo > 0 && combo % 5 === 0) {
    return 20;
  }

  return 0;
}

export function getResultType(stats: GameStats): ResultType {
  const accuracy = calculateAccuracy(stats);

  if (stats.score >= 420 || stats.maxCombo >= 12) {
    return "king";
  }

  if (stats.greenHits <= 1 && stats.totalClicks <= 18 && accuracy >= 0.85) {
    return "calm";
  }

  if (stats.goldHits > stats.redHits && stats.greenHits <= 3) {
    return "gold";
  }

  if (stats.redHits > stats.goldHits && stats.totalClicks >= 20) {
    return "stock";
  }

  if (accuracy >= 0.85 && stats.maxCombo >= 7) {
    return "fund";
  }

  return "balance";
}

export function resolveResultProfile(
  stats: GameStats,
  random: () => number = Math.random,
): ResultProfile {
  const type = getResultType(stats);
  const library = RESULT_LIBRARY[type];
  const accuracy = calculateAccuracy(stats);

  return {
    type,
    title: pickRandom(library.titles, random),
    copy: pickRandom(library.copies, random),
    signature: pickRandom(library.signatures, random),
    accuracy,
    accuracyText: `${Math.round(accuracy * 100)}%`,
  };
}

export function createPosterSvg(payload: PosterPayload) {
  const copyLines = splitLines(payload.copy, 15);
  const safePlayerName = escapeXml(payload.playerName);
  const safeTitle = escapeXml(payload.title);
  const safeAccuracyText = escapeXml(payload.accuracyText);
  const safeCopyLines = copyLines.map(escapeXml);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1080" height="1440" viewBox="0 0 1080 1440" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="120" y1="60" x2="980" y2="1360" gradientUnits="userSpaceOnUse">
      <stop stop-color="#FFF9E8"/>
      <stop offset="1" stop-color="#F3E1B3"/>
    </linearGradient>
    <linearGradient id="card" x1="180" y1="220" x2="920" y2="1200" gradientUnits="userSpaceOnUse">
      <stop stop-color="rgba(255,255,255,0.96)"/>
      <stop offset="1" stop-color="rgba(255,248,230,0.92)"/>
    </linearGradient>
    <filter id="shadow" x="0" y="0" width="1080" height="1440" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
      <feDropShadow dx="0" dy="24" stdDeviation="30" flood-color="#C89A42" flood-opacity="0.22"/>
    </filter>
  </defs>
  <rect width="1080" height="1440" rx="0" fill="url(#bg)"/>
  <circle cx="888" cy="170" r="112" fill="#F8D37A" fill-opacity="0.22"/>
  <circle cx="182" cy="260" r="88" fill="#F26B75" fill-opacity="0.16"/>
  <circle cx="190" cy="1130" r="96" fill="#7EC38C" fill-opacity="0.12"/>
  <path d="M140 180C212 132 302 130 368 166C432 200 518 200 586 166C648 134 738 132 816 182" stroke="#D1B168" stroke-opacity="0.38" stroke-width="8" stroke-linecap="round"/>
  <g filter="url(#shadow)">
    <rect x="96" y="108" width="888" height="1176" rx="44" fill="url(#card)"/>
  </g>
  <text x="160" y="204" fill="#9E6F29" font-size="34" font-family="'PingFang SC','Microsoft YaHei',sans-serif" letter-spacing="8">520 心跳挑战</text>
  <text x="160" y="276" fill="#4B3825" font-size="72" font-weight="700" font-family="'PingFang SC','Microsoft YaHei',sans-serif">${safeTitle}</text>
  <text x="160" y="334" fill="#7B654E" font-size="34" font-family="'PingFang SC','Microsoft YaHei',sans-serif">${safePlayerName}</text>
  <rect x="160" y="384" width="760" height="270" rx="30" fill="#FFF7E0"/>
  <text x="208" y="472" fill="#A77A31" font-size="30" font-family="'PingFang SC','Microsoft YaHei',sans-serif">总分：${payload.score}</text>
  <text x="208" y="560" fill="#A77A31" font-size="30" font-family="'PingFang SC','Microsoft YaHei',sans-serif">命中率：${safeAccuracyText}</text>
  <text x="208" y="648" fill="#A77A31" font-size="30" font-family="'PingFang SC','Microsoft YaHei',sans-serif">最高连击：${payload.maxCombo}</text>
  <text x="160" y="760" fill="#4B3825" font-size="38" font-family="'PingFang SC','Microsoft YaHei',sans-serif">你的心动解读</text>
  ${safeCopyLines
    .map(
      (line, index) =>
        `<text x="160" y="${840 + index * 58}" fill="#66503C" font-size="32" font-family="'PingFang SC','Microsoft YaHei',sans-serif">${line}</text>`,
    )
    .join("")}
  <rect x="160" y="1100" width="760" height="1" fill="#E5D6AD"/>
  <text x="160" y="1176" fill="#7B654E" font-size="28" font-family="'PingFang SC','Microsoft YaHei',sans-serif">${escapeXml(
    POSTER_COPY.subtitle,
  )}</text>
  <text x="160" y="1228" fill="#7B654E" font-size="28" font-family="'PingFang SC','Microsoft YaHei',sans-serif">${escapeXml(
    POSTER_COPY.footer,
  )}</text>
  <text x="160" y="1292" fill="#9B8B72" font-size="22" font-family="'PingFang SC','Microsoft YaHei',sans-serif">${escapeXml(
    POSTER_COPY.compliance,
  )}</text>
</svg>`;
}

function pickRandom<T>(list: T[], random: () => number) {
  return list[Math.min(list.length - 1, Math.floor(random() * list.length))];
}

function splitLines(text: string, maxCharsPerLine: number) {
  const lines: string[] = [];

  for (let cursor = 0; cursor < text.length; cursor += maxCharsPerLine) {
    lines.push(text.slice(cursor, cursor + maxCharsPerLine));
  }

  return lines;
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
