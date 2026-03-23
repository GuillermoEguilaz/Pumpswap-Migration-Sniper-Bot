import { Keypair } from "@solana/web3.js";
import { AppConfig } from "../config";
import { logger } from "../logger";
import { MigrationSignal, Position } from "../types";
import { JupiterService } from "./jupiter";
import { MetricsGatherer } from "./metrics-gatherer";
import { PositionManager } from "./position-manager";

export class PumpswapSniper {
  private readonly positions = new Map<string, Position>();
  private readonly recentlyProcessed = new Map<string, number>();
  private readonly positionManager: PositionManager;
  private lastTradeAt = 0;

  constructor(
    private readonly owner: Keypair,
    private readonly jupiter: JupiterService,
    private readonly metrics: MetricsGatherer,
    private readonly config: AppConfig
  ) {
    this.positionManager = new PositionManager(
      this.owner,
      this.jupiter,
      this.config,
      () => [...this.positions.values()],
      (position, reason, estExitQuoteUi) => this.closePosition(position, reason, estExitQuoteUi)
    );
  }

  public start(): void {
    this.positionManager.start();
  }

  public stop(): void {
    this.positionManager.stop();
  }

  public getOpenPositionCount(): number {
    return this.positions.size;
  }

  public async handleMigration(signal: MigrationSignal): Promise<void> {
    const mint = signal.mint;

    if (this.positions.has(mint)) {
      return;
    }

    const recentSeenAt = this.recentlyProcessed.get(mint) ?? 0;
    if (Date.now() - recentSeenAt < this.config.skipSameMintWindowMs) {
      return;
    }

    if (this.positions.size >= this.config.maxOpenPositions) {
      logger.info({ mint }, "Skipping buy: max open positions reached");
      return;
    }

    if (Date.now() - this.lastTradeAt < this.config.tradeCooldownMs) {
      logger.info({ mint }, "Skipping buy: cooldown active");
      return;
    }

    await this.openPosition(mint, signal);
  }

  private async openPosition(mint: string, signal: MigrationSignal): Promise<void> {
    try {
      const buyAmountLamports = this.jupiter.solToLamports(this.config.buyAmountSol);

      logger.info({ mint, signalSource: signal.source, buyAmountSol: this.config.buyAmountSol }, "Buying migrated token");

      const trade = await this.jupiter.executeSwap(this.owner, this.config.quoteMint, mint, buyAmountLamports);

      const entryQuoteUi = Number(trade.inAmountRaw) / 1_000_000_000;
      const targetValue = entryQuoteUi * (1 + this.config.takeProfitPct / 100);
      const stopValue = entryQuoteUi * (1 - this.config.stopLossPct / 100);

      const position: Position = {
        mint,
        buySignature: trade.signature,
        amountInQuoteUi: entryQuoteUi,
        tokenAmountRaw: trade.outAmountRaw,
        openedAt: Date.now(),
        entryValueQuoteUi: entryQuoteUi,
        targetValueQuoteUi: targetValue,
        stopValueQuoteUi: Math.max(0, stopValue)
      };

      this.positions.set(mint, position);
      this.recentlyProcessed.set(mint, Date.now());
      this.lastTradeAt = Date.now();
      this.metrics.onBuy();
      this.metrics.setOpenPositions(this.positions.size);

      logger.info(
        {
          mint,
          signature: trade.signature,
          inAmountRaw: trade.inAmountRaw,
          outAmountRaw: trade.outAmountRaw,
          targetValue,
          stopValue
        },
        "Buy completed"
      );
    } catch (error) {
      logger.error({ error, mint }, "Buy failed");
    }
  }

  private async closePosition(position: Position, reason: "tp" | "sl", estExitQuoteUi: number): Promise<void> {
    if (!this.positions.has(position.mint)) {
      return;
    }

    try {
      logger.info({ mint: position.mint, reason, estExitQuoteUi }, "Closing position");

      const trade = await this.jupiter.executeSwap(
        this.owner,
        position.mint,
        this.config.quoteMint,
        BigInt(position.tokenAmountRaw)
      );

      const realizedExitQuoteUi = Number(trade.outAmountRaw) / 1_000_000_000;
      const realizedPnl = realizedExitQuoteUi - position.entryValueQuoteUi;

      this.positions.delete(position.mint);
      this.metrics.onSell(realizedPnl);
      this.metrics.setOpenPositions(this.positions.size);

      logger.info(
        {
          mint: position.mint,
          reason,
          signature: trade.signature,
          realizedExitQuoteUi,
          realizedPnl
        },
        "Position closed"
      );
    } catch (error) {
      logger.error({ error, mint: position.mint }, "Failed to close position");
    }
  }
}