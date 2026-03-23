import { EventEmitter } from "node:events";
import { Connection, Logs, PublicKey } from "@solana/web3.js";
import { AppConfig } from "../config";
import { logger } from "../logger";
import { MigrationSignal, MigrationSource } from "../types";

const BASE58_LIKE = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g;

export class PumpfunMigrationMonitor extends EventEmitter {
  private readonly subscriptions: number[] = [];
  private readonly recentPumpfunHints = new Map<string, number>();

  constructor(
    private readonly connection: Connection,
    private readonly config: AppConfig
  ) {
    super();
  }

  public async start(): Promise<void> {
    const pumpfunSub = this.connection.onLogs(
      new PublicKey(this.config.pumpfunProgramId),
      (logs, ctx) => this.handleLogs("pumpfun", logs, ctx.slot),
      "confirmed"
    );

    const pumpswapSub = this.connection.onLogs(
      new PublicKey(this.config.pumpswapProgramId),
      (logs, ctx) => this.handleLogs("pumpswap", logs, ctx.slot),
      "confirmed"
    );

    this.subscriptions.push(pumpfunSub, pumpswapSub);

    logger.info(
      {
        pumpfunProgramId: this.config.pumpfunProgramId,
        pumpswapProgramId: this.config.pumpswapProgramId
      },
      "Migration monitor started"
    );
  }

  public async stop(): Promise<void> {
    await Promise.all(
      this.subscriptions.map((id) =>
        this.connection
          .removeOnLogsListener(id)
          .catch((error: unknown) => logger.warn({ error, id }, "Failed to remove log subscription"))
      )
    );
    this.subscriptions.length = 0;
  }

  private handleLogs(source: MigrationSource, logs: Logs, slot: number): void {
    const matched = this.matchesMigrationSignal(logs.logs);
    if (!matched) {
      return;
    }

    const mints = this.extractMints(logs.logs);
    if (mints.length === 0) {
      return;
    }

    for (const mint of mints) {
      if (source === "pumpfun") {
        this.recentPumpfunHints.set(mint, Date.now());
      }

      if (source === "pumpswap" && this.config.requirePumpfunHint) {
        const hintedAt = this.recentPumpfunHints.get(mint) ?? 0;
        if (Date.now() - hintedAt > this.config.skipSameMintWindowMs) {
          continue;
        }
      }

      const signal: MigrationSignal = {
        mint,
        source,
        signature: logs.signature,
        slot,
        logs: logs.logs,
        detectedAt: Date.now()
      };

      this.emit("migration", signal);
      logger.debug({ source, mint, signature: logs.signature }, "Migration signal emitted");
    }

    this.pruneHints();
  }

  private matchesMigrationSignal(logLines: string[]): boolean {
    const lower = logLines.map((line) => line.toLowerCase());

    const keywordHit = this.config.migrationLogKeywords.some((keyword) =>
      lower.some((line) => line.includes(keyword.toLowerCase()))
    );

    if (keywordHit) {
      return true;
    }

    if (this.config.migrationDiscriminators.length === 0) {
      return false;
    }

    return this.config.migrationDiscriminators.some((disc) =>
      logLines.some((line) => line.includes(disc))
    );
  }

  private extractMints(logLines: string[]): string[] {
    const mints = new Set<string>();

    for (const line of logLines) {
      const matches = line.match(BASE58_LIKE);
      if (!matches) {
        continue;
      }

      for (const maybeMint of matches) {
        if (maybeMint === this.config.pumpfunProgramId || maybeMint === this.config.pumpswapProgramId) {
          continue;
        }
        mints.add(maybeMint);
      }
    }

    return [...mints];
  }

  private pruneHints(): void {
    const now = Date.now();
    for (const [mint, timestamp] of this.recentPumpfunHints.entries()) {
      if (now - timestamp > this.config.skipSameMintWindowMs) {
        this.recentPumpfunHints.delete(mint);
      }
    }
  }
}