import dotenv from "dotenv";

dotenv.config();

function getEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing env var: ${name}`);
  }
  return value;
}

function getNumber(name: string, fallback?: number): number {
  const raw = process.env[name] ?? (fallback !== undefined ? String(fallback) : undefined);
  if (!raw) {
    throw new Error(`Missing env var: ${name}`);
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid number in env var ${name}: ${raw}`);
  }
  return parsed;
}

function getBoolean(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  return ["1", "true", "yes", "on"].includes(raw.toLowerCase());
}

function getCsv(name: string, fallback = ""): string[] {
  const raw = process.env[name] ?? fallback;
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export const config = {
  rpcHttpUrl: getEnv("RPC_HTTP_URL"),
  rpcWsUrl: getEnv("RPC_WS_URL"),
  walletPrivateKey: getEnv("WALLET_PRIVATE_KEY"),

  pumpfunProgramId: getEnv("PUMPFUN_PROGRAM_ID"),
  pumpswapProgramId: getEnv("PUMPSWAP_PROGRAM_ID"),

  migrationLogKeywords: getCsv("MIGRATION_LOG_KEYWORDS", "migrate,migration,initialize_pool,create_pool"),
  migrationDiscriminators: getCsv("MIGRATION_DISCRIMINATORS", ""),

  quoteMint: getEnv("QUOTE_MINT", "So11111111111111111111111111111111111111112"),
  buyAmountSol: getNumber("BUY_AMOUNT_SOL", 0.2),
  slippageBps: getNumber("SLIPPAGE_BPS", 300),
  priorityFeeMicrolamports: getNumber("PRIORITY_FEE_MICROLAMPORTS", 50000),
  autoSellEnabled: getBoolean("AUTO_SELL_ENABLED", true),
  takeProfitPct: getNumber("TAKE_PROFIT_PCT", 40),
  stopLossPct: getNumber("STOP_LOSS_PCT", 20),
  positionCheckIntervalMs: getNumber("POSITION_CHECK_INTERVAL_MS", 5000),
  maxOpenPositions: getNumber("MAX_OPEN_POSITIONS", 1),
  tradeCooldownMs: getNumber("TRADE_COOLDOWN_MS", 2500),

  requirePumpfunHint: getBoolean("REQUIRE_PUMPFUN_HINT", true),
  skipSameMintWindowMs: getNumber("SKIP_SAME_MINT_WINDOW_MS", 600000),

  jupiterQuoteUrl: getEnv("JUPITER_QUOTE_URL", "https://quote-api.jup.ag/v6/quote"),
  jupiterSwapUrl: getEnv("JUPITER_SWAP_URL", "https://quote-api.jup.ag/v6/swap"),

  logLevel: getEnv("LOG_LEVEL", "info"),
  metricsFlushIntervalMs: getNumber("METRICS_FLUSH_INTERVAL_MS", 15000)
};

export type AppConfig = typeof config;