"use client";

import {
  type RefObject,
  startTransition,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  BUTTON_LABELS,
  COMPLIANCE_COPY,
  DYNAMIC_TIPS,
  GAME_RULES,
  HEART_THEME,
  POSTER_COPY,
  RESULT_LIBRARY,
  START_SCREEN_COPY,
  type HeartType,
} from "@/lib/heartbeat-game-config";
import {
  createPosterSvg,
  getComboBonus,
  resolveResultProfile,
  type GameStats,
  type ResultProfile,
} from "@/lib/heartbeat-game";

type HeartInstance = {
  id: number;
  type: HeartType;
  left: number;
  top: number;
  size: number;
  lifetimeMs: number;
};

type FloatingFlash = {
  id: number;
  left: number;
  top: number;
  text: string;
  tone: "red" | "gold" | "green" | "bonus";
};

function createInitialStats(): GameStats {
  return {
    score: 0,
    combo: 0,
    maxCombo: 0,
    redHits: 0,
    goldHits: 0,
    greenHits: 0,
    totalClicks: 0,
    successfulHits: 0,
  };
}

export function HeartbeatChallenge() {
  const [gameStatus, setGameStatus] = useState<"start" | "countdown" | "playing" | "result">(
    "start",
  );
  const [countdownLabel, setCountdownLabel] = useState("3");
  const [timeLeft, setTimeLeft] = useState(GAME_RULES.durationSeconds);
  const [stats, setStats] = useState<GameStats>(createInitialStats);
  const [hearts, setHearts] = useState<HeartInstance[]>([]);
  const [flashes, setFlashes] = useState<FloatingFlash[]>([]);
  const [tip, setTip] = useState(START_SCREEN_COPY.hint);
  const [resultProfile, setResultProfile] = useState<ResultProfile | null>(null);
  const [actionFeedback, setActionFeedback] = useState("");

  const areaRef = useRef<HTMLDivElement | null>(null);
  const timeoutIdsRef = useRef<number[]>([]);
  const intervalIdsRef = useRef<number[]>([]);
  const heartIdRef = useRef(0);
  const flashIdRef = useRef(0);
  const sessionRef = useRef(0);
  const heartsRef = useRef<HeartInstance[]>([]);
  const statsRef = useRef<GameStats>(createInitialStats());

  function syncStats(next: GameStats) {
    statsRef.current = next;
    setStats(next);
  }

  function syncHearts(next: HeartInstance[]) {
    heartsRef.current = next;
    setHearts(next);
  }

  function updateStats(updater: (previous: GameStats) => GameStats) {
    setStats((previous) => {
      const next = updater(previous);
      statsRef.current = next;
      return next;
    });
  }

  function updateHearts(updater: (previous: HeartInstance[]) => HeartInstance[]) {
    setHearts((previous) => {
      const next = updater(previous);
      heartsRef.current = next;
      return next;
    });
  }

  function registerTimeout(timeoutId: number) {
    timeoutIdsRef.current.push(timeoutId);
  }

  function registerInterval(intervalId: number) {
    intervalIdsRef.current.push(intervalId);
  }

  function clearScheduledWork() {
    timeoutIdsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    intervalIdsRef.current.forEach((intervalId) => window.clearInterval(intervalId));
    timeoutIdsRef.current = [];
    intervalIdsRef.current = [];
  }

  function pushFlash(text: string, left: number, top: number, tone: FloatingFlash["tone"]) {
    const id = flashIdRef.current++;
    setFlashes((previous) => [...previous, { id, text, left, top, tone }]);
    registerTimeout(
      window.setTimeout(() => {
        setFlashes((previous) => previous.filter((flash) => flash.id !== id));
      }, 900),
    );
  }

  function randomBetween(min: number, max: number) {
    return Math.round(min + Math.random() * (max - min));
  }

  function pickRandomTip() {
    return DYNAMIC_TIPS[Math.floor(Math.random() * DYNAMIC_TIPS.length)];
  }

  function pickWeightedHeartType(): HeartType {
    const roll = Math.random() * 100;
    const redLine = GAME_RULES.spawnWeightByHeart.red;
    const goldLine = redLine + GAME_RULES.spawnWeightByHeart.gold;

    if (roll < redLine) {
      return "red";
    }

    if (roll < goldLine) {
      return "gold";
    }

    return "green";
  }

  function removeHeart(heartId: number) {
    updateHearts((previous) => previous.filter((heart) => heart.id !== heartId));
  }

  function measureGameArea() {
    const area = areaRef.current;

    if (!area) {
      return { width: 330, height: 430 };
    }

    const rect = area.getBoundingClientRect();
    return {
      width: rect.width || 330,
      height: rect.height || 430,
    };
  }

  function pickHeartPosition(
    occupiedHearts: HeartInstance[],
    width: number,
    height: number,
    size: number,
  ) {
    const padding = size / 2 + 12;
    let left = width / 2;
    let top = height / 2;

    for (let attempt = 0; attempt < 6; attempt += 1) {
      left = randomBetween(padding, Math.max(padding, width - padding));
      top = randomBetween(padding, Math.max(padding, height - padding));

      const collides = occupiedHearts.some((heart) => {
        const distance = Math.hypot(heart.left - left, heart.top - top);
        return distance < (heart.size + size) * 0.58;
      });

      if (!collides) {
        break;
      }
    }

    return { left, top };
  }

  function endGame() {
    clearScheduledWork();
    syncHearts([]);
    setTimeLeft(0);
    setTip("20 秒结束，来看看你更像社区里的哪一派。");

    const profile = resolveResultProfile(statsRef.current);

    startTransition(() => {
      setResultProfile(profile);
      setGameStatus("result");
    });
  }

  function spawnWave(sessionId: number) {
    if (sessionRef.current !== sessionId) {
      return;
    }

    const { width, height } = measureGameArea();
    const amount = randomBetween(
      GAME_RULES.heartsPerWave[0],
      GAME_RULES.heartsPerWave[1],
    );
    const occupied = [...heartsRef.current];
    const nextHearts: HeartInstance[] = [];

    for (let index = 0; index < amount; index += 1) {
      const type = pickWeightedHeartType();
      const size =
        type === "gold" ? randomBetween(58, 70) : randomBetween(50, 62);
      const lifetimeMs = randomBetween(
        GAME_RULES.heartLifetimeMs[0],
        GAME_RULES.heartLifetimeMs[1],
      );
      const { left, top } = pickHeartPosition(occupied, width, height, size);
      const heart: HeartInstance = {
        id: heartIdRef.current++,
        type,
        left,
        top,
        size,
        lifetimeMs,
      };

      occupied.push(heart);
      nextHearts.push(heart);
      registerTimeout(
        window.setTimeout(() => {
          if (sessionRef.current === sessionId) {
            removeHeart(heart.id);
          }
        }, lifetimeMs),
      );
    }

    updateHearts((previous) => [...previous, ...nextHearts]);
    setTip(pickRandomTip());
  }

  function scheduleNextWave(sessionId: number) {
    if (sessionRef.current !== sessionId) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      if (sessionRef.current !== sessionId) {
        return;
      }

      spawnWave(sessionId);
      scheduleNextWave(sessionId);
    }, randomBetween(GAME_RULES.spawnDelayMs[0], GAME_RULES.spawnDelayMs[1]));

    registerTimeout(timeoutId);
  }

  function startGame() {
    clearScheduledWork();
    const sessionId = sessionRef.current + 1;
    sessionRef.current = sessionId;
    const initialStats = createInitialStats();

    syncStats(initialStats);
    syncHearts([]);
    setFlashes([]);
    setResultProfile(null);
    setActionFeedback("");
    setGameStatus("playing");
    setTimeLeft(GAME_RULES.durationSeconds);
    setTip("红心来了，手速拉满。");

    const endAt = Date.now() + GAME_RULES.durationSeconds * 1000;
    const intervalId = window.setInterval(() => {
      const remainingMs = endAt - Date.now();
      const nextTimeLeft = Math.max(0, Math.ceil(remainingMs / 1000));
      setTimeLeft(nextTimeLeft);

      if (remainingMs <= 0) {
        endGame();
      }
    }, 120);

    registerInterval(intervalId);
    scheduleNextWave(sessionId);
  }

  function beginCountdown() {
    clearScheduledWork();
    sessionRef.current += 1;
    syncHearts([]);
    setFlashes([]);
    setResultProfile(null);
    setActionFeedback("");
    setTip("准备好，20 秒后看你的心动人格。");
    setCountdownLabel("3");
    setGameStatus("countdown");
    setTimeLeft(GAME_RULES.durationSeconds);

    registerTimeout(window.setTimeout(() => setCountdownLabel("2"), 1000));
    registerTimeout(window.setTimeout(() => setCountdownLabel("1"), 2000));
    registerTimeout(
      window.setTimeout(() => setCountdownLabel("心动开始"), 3000),
    );
    registerTimeout(window.setTimeout(() => startGame(), 3700));
  }

  useEffect(() => {
    return () => {
      clearScheduledWork();
    };
  }, []);

  async function handleShare() {
    if (!resultProfile) {
      return;
    }

    const shareText = [
      `我在 520 心跳挑战拿到了「${resultProfile.title}」`,
      `总分 ${stats.score}，命中率 ${resultProfile.accuracyText}，最高连击 ${stats.maxCombo}。`,
      resultProfile.signature,
    ].join("，");

    try {
      if (navigator.share) {
        await navigator.share({
          title: POSTER_COPY.title,
          text: shareText,
        });
        setActionFeedback("已调起系统分享，直接发给朋友或丢进群里就行。");
        return;
      }

      await navigator.clipboard.writeText(shareText);
      setActionFeedback("成绩文案已复制，发给朋友或贴到社区都方便。");
    } catch {
      setActionFeedback("暂时没有完成分享，可以先生成海报。");
    }
  }

  function handlePosterDownload() {
    if (!resultProfile) {
      return;
    }

    const svg = createPosterSvg({
      playerName: POSTER_COPY.defaultPlayerName,
      title: resultProfile.title,
      score: stats.score,
      accuracyText: resultProfile.accuracyText,
      maxCombo: stats.maxCombo,
      copy: resultProfile.copy,
    });

    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "heartbeat-poster-520.svg";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setActionFeedback("海报已生成，长按或保存后就能分享。");
  }

  function handleHeartTap(heart: HeartInstance) {
    if (gameStatus !== "playing") {
      return;
    }

    removeHeart(heart.id);

    if (heart.type === "green") {
      updateStats((previous) => ({
        ...previous,
        score: Math.max(0, previous.score + GAME_RULES.scoreByHeart.green),
        combo: 0,
        greenHits: previous.greenHits + 1,
        totalClicks: previous.totalClicks + 1,
      }));
      pushFlash(HEART_THEME.green.hitText, heart.left, heart.top, "green");
      setTip("稳住，别被绿心干扰。");
      navigator.vibrate?.(40);
      return;
    }

    let comboBonus = 0;
    let currentCombo = 0;
    const baseScore =
      heart.type === "red"
        ? GAME_RULES.scoreByHeart.red
        : GAME_RULES.scoreByHeart.gold;

    updateStats((previous) => {
      currentCombo = previous.combo + 1;
      comboBonus = getComboBonus(currentCombo);

      return {
        ...previous,
        score: previous.score + baseScore + comboBonus,
        combo: currentCombo,
        maxCombo: Math.max(previous.maxCombo, currentCombo),
        redHits: previous.redHits + (heart.type === "red" ? 1 : 0),
        goldHits: previous.goldHits + (heart.type === "gold" ? 1 : 0),
        totalClicks: previous.totalClicks + 1,
        successfulHits: previous.successfulHits + 1,
      };
    });

    pushFlash(
      HEART_THEME[heart.type].hitText,
      heart.left,
      heart.top,
      heart.type,
    );

    if (comboBonus > 0) {
      pushFlash(`连击 +${comboBonus}`, heart.left, heart.top - 18, "bonus");
      setTip(
        currentCombo % 10 === 0
          ? "连击拉满，这波状态很高。"
          : "连续命中，状态不错。",
      );
      return;
    }

    setTip(
      heart.type === "gold"
        ? "金心出现了，快接住。"
        : "红心来了，手速拉满。",
    );
  }

  return (
    <main className="min-h-[100dvh] overflow-hidden bg-[#fbf4df] px-4 pb-32 pt-4 text-[#4f3822] sm:px-6">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="floating-orb left-[8%] top-20 h-32 w-32 bg-[#f7dc86]/45" />
        <div className="floating-orb left-[72%] top-14 h-24 w-24 bg-[#f6949b]/30 [animation-delay:-1.2s]" />
        <div className="floating-orb left-[68%] top-[72%] h-28 w-28 bg-[#8ec09a]/24 [animation-delay:-2.4s]" />
      </div>

      <div className="mx-auto flex min-h-[calc(100dvh-8rem)] w-full max-w-[430px] flex-col">
        <section className="heartbeat-shell relative flex-1 rounded-[36px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,253,245,0.94),rgba(249,236,204,0.88))] px-5 pb-6 pt-5 shadow-[0_28px_80px_rgba(197,159,84,0.18)]">
          <div className="mb-4 flex items-center">
            <span className="rounded-full border border-[#e9d7a3] bg-white/70 px-3 py-1 text-[11px] tracking-[0.28em] text-[#9a7334]">
              520 SPECIAL
            </span>
          </div>

          {gameStatus === "start" ? (
            <StartScreen onStart={beginCountdown} />
          ) : null}

          {gameStatus === "countdown" ? (
            <CountdownScreen label={countdownLabel} />
          ) : null}

          {gameStatus === "playing" ? (
            <GameScreen
              areaRef={areaRef}
              timeLeft={timeLeft}
              stats={stats}
              hearts={hearts}
              flashes={flashes}
              tip={tip}
              onHeartTap={handleHeartTap}
            />
          ) : null}

          {gameStatus === "result" && resultProfile ? (
            <ResultScreen
              resultProfile={resultProfile}
              stats={stats}
              actionFeedback={actionFeedback}
              onDownloadPoster={handlePosterDownload}
              onRetry={beginCountdown}
              onShare={handleShare}
            />
          ) : null}
        </section>
      </div>

      <footer className="fixed bottom-0 left-0 right-0 z-20 px-4 pb-[calc(env(safe-area-inset-bottom)+14px)] pt-3 sm:px-6">
        <div className="mx-auto max-w-[430px] rounded-[20px] border border-white/70 bg-[rgba(255,251,239,0.92)] px-4 py-3 text-center text-[11px] leading-5 text-[#7a6347] shadow-[0_16px_40px_rgba(164,128,61,0.12)] backdrop-blur">
          <p>{COMPLIANCE_COPY.sticky}</p>
          {gameStatus === "result" ? (
            <p className="mt-1 text-[#92714a]">{COMPLIANCE_COPY.result}</p>
          ) : null}
        </div>
      </footer>
    </main>
  );
}

function StartScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex min-h-[calc(100dvh-14rem)] flex-col justify-between">
      <div className="space-y-5">
        <div className="space-y-3">
          <h1 className="font-display text-[44px] leading-[0.94] text-[#5a3e22]">
            {START_SCREEN_COPY.title}
          </h1>
          <p className="max-w-[280px] text-[17px] leading-7 text-[#846646]">
            {START_SCREEN_COPY.subtitle}
          </p>
        </div>

        <div className="heartbeat-visual relative mt-4 h-[280px] rounded-[30px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,250,234,0.92),rgba(255,242,203,0.72))] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
          <div className="absolute inset-x-6 top-10 h-px bg-[linear-gradient(90deg,transparent,rgba(201,168,90,0.3),transparent)]" />
          <div className="absolute left-6 right-6 top-1/2 h-16 -translate-y-1/2 rounded-full bg-[radial-gradient(circle_at_center,rgba(255,240,187,0.65),transparent_70%)]" />
          <div className="absolute inset-x-4 top-[44%] h-[90px] -translate-y-1/2 rounded-[999px] border border-[#edd8a7]/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.35),rgba(255,255,255,0.05))]" />
          <div className="absolute inset-x-5 top-[48%] h-[62px] -translate-y-1/2">
            <svg viewBox="0 0 300 62" className="h-full w-full">
              <path
                d="M0 33H54L73 12L95 50L116 20L138 33H186L210 10L236 52L258 28H300"
                fill="none"
                stroke="#d6b268"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="4"
              />
            </svg>
          </div>
          <div className="absolute left-[14%] top-[30%]">
            <FloatingIconHeart type="red" className="heart-entry h-20 w-20" />
          </div>
          <div className="absolute left-[42%] top-[16%]">
            <FloatingIconHeart
              type="gold"
              className="heart-entry h-24 w-24 [animation-delay:-0.8s]"
            />
          </div>
          <div className="absolute left-[68%] top-[40%]">
            <FloatingIconHeart
              type="green"
              className="heart-entry h-[74px] w-[74px] [animation-delay:-1.6s]"
            />
          </div>
          <div className="absolute bottom-4 left-4 right-4 grid grid-cols-3 gap-2 text-center">
            {START_SCREEN_COPY.legend.map((item) => (
              <div
                key={item.type}
                className="rounded-2xl border border-white/70 bg-white/55 px-2 py-3 shadow-[0_10px_30px_rgba(193,153,76,0.08)]"
              >
                <p className="text-sm font-semibold text-[#684926]">{item.label}</p>
                <p className="mt-1 text-[11px] text-[#8a6e50]">{item.description}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="rounded-[22px] border border-[#efe0b8] bg-[#fff8e7]/80 px-4 py-4 text-sm leading-7 text-[#775d3f]">
          {START_SCREEN_COPY.hint}
        </p>
      </div>

      <div className="space-y-4 pt-6">
        <button
          type="button"
          onClick={onStart}
          className="field-transition inline-flex min-h-14 w-full items-center justify-center rounded-full bg-[linear-gradient(135deg,#df675a,#e6ba52)] px-6 text-[15px] font-semibold text-white shadow-[0_20px_36px_rgba(217,126,95,0.28)] hover:-translate-y-0.5"
        >
          {BUTTON_LABELS.start}
        </button>
      </div>
    </div>
  );
}

function CountdownScreen({ label }: { label: string }) {
  return (
    <div className="flex min-h-[calc(100dvh-14rem)] flex-col items-center justify-center text-center">
      <div className="countdown-pulse rounded-full bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.95),rgba(255,244,210,0.55),transparent_70%)] px-12 py-16">
        <p className="text-xs uppercase tracking-[0.44em] text-[#ad8440]">
          Ready
        </p>
        <h2 className="mt-4 font-display text-[72px] leading-none text-[#5d4123]">
          {label}
        </h2>
      </div>
    </div>
  );
}

function GameScreen({
  areaRef,
  timeLeft,
  stats,
  hearts,
  flashes,
  tip,
  onHeartTap,
}: {
  areaRef: RefObject<HTMLDivElement | null>;
  timeLeft: number;
  stats: GameStats;
  hearts: HeartInstance[];
  flashes: FloatingFlash[];
  tip: string;
  onHeartTap: (heart: HeartInstance) => void;
}) {
  return (
    <div className="flex min-h-[calc(100dvh-14rem)] flex-col">
      <div className="grid grid-cols-3 gap-2">
        <ScorePanel label="剩余时间" value={`${timeLeft}s`} tone="soft" />
        <ScorePanel label="当前得分" value={String(stats.score)} tone="warm" />
        <ScorePanel label="当前连击" value={String(stats.combo)} tone="green" />
      </div>

      <div
        ref={areaRef}
        className="relative mt-4 flex-1 overflow-hidden rounded-[30px] border border-white/75 bg-[linear-gradient(180deg,rgba(255,251,235,0.92),rgba(255,243,209,0.78))]"
        style={{ minHeight: 420 }}
      >
        <div className="absolute inset-x-5 top-6 h-14 rounded-full bg-[radial-gradient(circle_at_center,rgba(255,238,181,0.65),transparent_72%)]" />
        <div className="absolute inset-x-4 top-8 h-[84px]">
          <svg viewBox="0 0 320 84" className="h-full w-full opacity-55">
            <path
              d="M0 45H58L78 20L104 68L128 30L154 45H196L216 15L243 70L266 34H320"
              fill="none"
              stroke="#dfc47c"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="4"
            />
          </svg>
        </div>
        <div className="absolute inset-x-8 bottom-8 top-[28%] rounded-[34px] border border-dashed border-[#ecd8a2]/75" />

        {hearts.map((heart) => (
          <button
            key={heart.id}
            type="button"
            aria-label={HEART_THEME[heart.type].label}
            onClick={() => onHeartTap(heart)}
            className="heart-entry absolute -translate-x-1/2 -translate-y-1/2 transition-transform active:scale-90"
            style={{
              left: heart.left,
              top: heart.top,
              width: heart.size,
              height: heart.size,
            }}
          >
            <FloatingIconHeart type={heart.type} className="h-full w-full" />
          </button>
        ))}

        {flashes.map((flash) => (
          <span
            key={flash.id}
            className={`flash-rise absolute -translate-x-1/2 -translate-y-1/2 text-sm font-semibold ${
              flash.tone === "green"
                ? "text-[#5e9c6e]"
                : flash.tone === "bonus"
                  ? "text-[#b57b20]"
                  : "text-[#f06d75]"
            }`}
            style={{ left: flash.left, top: flash.top }}
          >
            {flash.text}
          </span>
        ))}
      </div>

      <div className="mt-4 rounded-[24px] border border-[#efdfb6] bg-[#fff7e4]/88 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
        <p className="text-xs uppercase tracking-[0.28em] text-[#a17a3c]">动态提示</p>
        <p className="mt-2 text-sm leading-7 text-[#6f5537]">{tip}</p>
      </div>
    </div>
  );
}

function ResultScreen({
  resultProfile,
  stats,
  actionFeedback,
  onDownloadPoster,
  onRetry,
  onShare,
}: {
  resultProfile: ResultProfile;
  stats: GameStats;
  actionFeedback: string;
  onDownloadPoster: () => void;
  onRetry: () => void;
  onShare: () => void;
}) {
  const resultTheme = RESULT_LIBRARY[resultProfile.type];

  return (
    <div className="space-y-4">
      <div className="rounded-[28px] border border-white/80 bg-[linear-gradient(180deg,rgba(255,253,245,0.94),rgba(255,244,219,0.86))] p-5 shadow-[0_18px_40px_rgba(199,154,69,0.1)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span
              className="inline-flex rounded-full px-3 py-1 text-[11px] font-semibold tracking-[0.24em] text-white"
              style={{ backgroundColor: resultTheme.accent }}
            >
              {resultTheme.badge}
            </span>
            <h2 className="mt-3 font-display text-[34px] leading-tight text-[#5c4124]">
              {resultProfile.title}
            </h2>
          </div>
          <div className="rounded-[22px] bg-white/65 px-4 py-3 text-right">
            <p className="text-xs text-[#9a7943]">总分</p>
            <p className="text-[28px] font-semibold text-[#5d4224]">{stats.score}</p>
          </div>
        </div>

        <p className="mt-4 text-[15px] leading-7 text-[#6d5437]">
          {resultProfile.copy}
        </p>
        <p className="mt-3 text-sm text-[#a17343]">{resultProfile.signature}</p>

        <div className="mt-5 grid grid-cols-2 gap-2 text-sm">
          <MetricCard label="命中率" value={resultProfile.accuracyText} />
          <MetricCard label="最高连击" value={String(stats.maxCombo)} />
          <MetricCard label="红心命中" value={String(stats.redHits)} />
          <MetricCard label="金心命中" value={String(stats.goldHits)} />
          <MetricCard label="误点绿心" value={String(stats.greenHits)} />
          <MetricCard label="总点击" value={String(stats.totalClicks)} />
        </div>
      </div>

      <PosterPreview resultProfile={resultProfile} stats={stats} />

      <div className="grid gap-3">
        <button
          type="button"
          onClick={onDownloadPoster}
          className="field-transition inline-flex min-h-14 items-center justify-center rounded-full bg-[linear-gradient(135deg,#e5ba58,#d97863)] px-6 text-[15px] font-semibold text-white shadow-[0_18px_36px_rgba(217,126,95,0.24)] hover:-translate-y-0.5"
        >
          {BUTTON_LABELS.generatePoster}
        </button>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onRetry}
            className="field-transition min-h-12 rounded-full border border-[#e7d2a0] bg-white/80 px-4 text-sm font-semibold text-[#6f5437] hover:-translate-y-0.5"
          >
            {BUTTON_LABELS.retry}
          </button>
          <button
            type="button"
            onClick={onShare}
            className="field-transition min-h-12 rounded-full border border-[#f0d6ab] bg-[#fff5de] px-4 text-sm font-semibold text-[#8f652f] hover:-translate-y-0.5"
          >
            {BUTTON_LABELS.share}
          </button>
        </div>
      </div>

      {actionFeedback ? (
        <p className="rounded-[18px] bg-white/65 px-4 py-3 text-center text-sm text-[#876844]">
          {actionFeedback}
        </p>
      ) : null}
    </div>
  );
}

function PosterPreview({
  resultProfile,
  stats,
}: {
  resultProfile: ResultProfile;
  stats: GameStats;
}) {
  return (
    <section className="poster-shimmer relative overflow-hidden rounded-[30px] border border-white/75 bg-[linear-gradient(180deg,#fffaf0,#f4e0aa)] p-5 shadow-[0_22px_54px_rgba(205,164,80,0.16)]">
      <div className="relative z-10">
        <p className="text-xs uppercase tracking-[0.34em] text-[#a97a37]">
          海报预览
        </p>
        <h3 className="mt-3 font-display text-[30px] leading-tight text-[#604324]">
          {POSTER_COPY.title}
        </h3>
        <p className="mt-2 text-sm text-[#8b6e4d]">{POSTER_COPY.defaultPlayerName}</p>
        <div className="mt-5 rounded-[24px] bg-white/75 p-4">
          <p className="text-[22px] font-semibold text-[#5e4123]">
            {resultProfile.title}
          </p>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
            <MetricCard label="总分" value={String(stats.score)} compact />
            <MetricCard label="命中率" value={resultProfile.accuracyText} compact />
            <MetricCard label="连击" value={String(stats.maxCombo)} compact />
          </div>
          <p className="mt-4 text-sm leading-7 text-[#6f5538]">{resultProfile.copy}</p>
        </div>
        <div className="mt-5 flex items-end justify-between gap-3 text-sm text-[#7b6245]">
          <div>
            <p>{POSTER_COPY.subtitle}</p>
            <p className="mt-1">{POSTER_COPY.footer}</p>
          </div>
          <div className="rounded-2xl border border-[#ead6a8] bg-white/60 px-3 py-2 text-xs text-[#937247]">
            扫码位预留
          </div>
        </div>
      </div>
    </section>
  );
}

function ScorePanel({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "soft" | "warm" | "green";
}) {
  const toneClass =
    tone === "warm"
      ? "from-[#fff4d7] to-[#ffe8ca] text-[#9f6436]"
      : tone === "green"
        ? "from-[#f0f7ee] to-[#e7f2e7] text-[#628568]"
        : "from-white/85 to-[#fff9ea] text-[#8f6d3e]";

  return (
    <div
      className={`rounded-[22px] border border-white/70 bg-gradient-to-br px-3 py-3 shadow-[0_14px_28px_rgba(195,158,83,0.08)] ${toneClass}`}
    >
      <p className="text-[11px] tracking-[0.18em]">{label}</p>
      <p className="mt-2 text-[24px] font-semibold leading-none">{value}</p>
    </div>
  );
}

function MetricCard({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`rounded-[20px] border border-white/75 bg-white/68 px-3 ${
        compact ? "py-3" : "py-4"
      }`}
    >
      <p className="text-[11px] tracking-[0.18em] text-[#9b7847]">{label}</p>
      <p className={`mt-2 font-semibold text-[#5c4022] ${compact ? "text-lg" : "text-2xl"}`}>
        {value}
      </p>
    </div>
  );
}

function FloatingIconHeart({
  type,
  className,
}: {
  type: HeartType;
  className?: string;
}) {
  const theme = HEART_THEME[type];

  return (
    <svg
      viewBox="0 0 64 58"
      className={className}
      style={{
        filter: `drop-shadow(0 12px 20px ${theme.glow})`,
      }}
    >
      <path
        d="M31.7 55.4C30.5 54.7 12.7 43.4 5.2 29.4C-2.5 15 6.2 0.7 20 0.7C25.4 0.7 29.5 3 32 6.7C34.5 3 38.6 0.7 44 0.7C57.8 0.7 66.5 15 58.8 29.4C51.3 43.4 33.5 54.7 32.3 55.4C32.1 55.6 31.9 55.6 31.7 55.4Z"
        fill={theme.fill}
      />
      {type === "gold" ? (
        <>
          <circle cx="23" cy="18" r="4" fill="rgba(255,255,255,0.55)" />
          <path
            d="M44 13L45.7 17.1L50 18.8L45.7 20.5L44 24.6L42.3 20.5L38 18.8L42.3 17.1L44 13Z"
            fill="#fff2b1"
          />
        </>
      ) : null}
      {type === "green" ? (
        <path
          d="M42 14.5C37.9 13.7 34.3 15.4 31.6 19.6C29.6 22.8 27.8 24.3 25.2 24.1"
          stroke="rgba(255,255,255,0.58)"
          strokeLinecap="round"
          strokeWidth="3.5"
        />
      ) : null}
      {type === "red" ? (
        <circle cx="23" cy="17" r="4" fill="rgba(255,255,255,0.46)" />
      ) : null}
    </svg>
  );
}
