export type MigrationSource = "pumpfun" | "pumpswap";

export interface MigrationSignal {
  mint: string;
  source: MigrationSource;
  signature?: string;
  slot?: number;
  logs: string[];
  detectedAt: number;
}

export interface Position {
  mint: string;
  buySignature: string;
  amountInQuoteUi: number;
  tokenAmountRaw: string;
  openedAt: number;
  entryValueQuoteUi: number;
  targetValueQuoteUi: number;
  stopValueQuoteUi: number;
}

export interface TradeResult {
  signature: string;
  inputMint: string;
  outputMint: string;
  inAmountRaw: string;
  outAmountRaw: string;
}

export interface MetricsSnapshot {
  startedAt: number;
  uptimeMs: number;
  totalBuys: number;
  totalSells: number;
  wins: number;
  losses: number;
  realizedPnlQuoteUi: number;
  openPositions: number;
  lastUpdatedAt: number;
}