import { AppConfig } from "../config";
import { logger } from "../logger";
import { Position } from "../types";
import { JupiterService } from "./jupiter";
import { Keypair } from "@solana/web3.js";

type CloseHandler = (position: Position, reason: "tp" | "sl", estExitQuoteUi: number) => Promise<void>;

export class PositionManager {
  private intervalRef: NodeJS.Timeout | null = null;

  constructor(
    private readonly owner: Keypair,
    private readonly jupiter: JupiterService,
    private readonly config: AppConfig,
    private readonly getPositions: () => Position[],
    private readonly onCloseSignal: CloseHandler
  ) {}

  public start(): void {
    if (!this.config.autoSellEnabled || this.intervalRef) {
      return;
    }

    this.intervalRef = setInterval(() => {
      void this.tick();
    }, this.config.positionCheckIntervalMs);

    logger.info({ intervalMs: this.config.positionCheckIntervalMs }, "Position manager started");
  }

  public stop(): void {
    if (!this.intervalRef) {
      return;
    }
    clearInterval(this.intervalRef);
    this.intervalRef = null;
  }

  private async tick(): Promise<void> {
    const positions = this.getPositions();

    for (const position of positions) {
      try {
        const quote = await this.jupiter.getQuote(
          position.mint,
          this.config.quoteMint,
          BigInt(position.tokenAmountRaw)
        );

        const outQuoteUi = Number(quote.outAmount) / 1_000_000_000;

        if (outQuoteUi >= position.targetValueQuoteUi) {
          await this.onCloseSignal(position, "tp", outQuoteUi);
          continue;
        }

        if (outQuoteUi <= position.stopValueQuoteUi) {
          await this.onCloseSignal(position, "sl", outQuoteUi);
        }
      } catch (error) {
        logger.warn({ error, mint: position.mint }, "Position check failed");
      }
    }
  }
}