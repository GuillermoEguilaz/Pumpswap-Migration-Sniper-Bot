import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { MetricsSnapshot } from "../types";

export class MetricsGatherer {
  private readonly startedAt = Date.now();
  private totalBuys = 0;
  private totalSells = 0;
  private wins = 0;
  private losses = 0;
  private realizedPnlQuoteUi = 0;
  private openPositions = 0;

  public onBuy(): void {
    this.totalBuys += 1;
    this.openPositions += 1;
  }

  public onSell(realizedPnlQuoteUi: number): void {
    this.totalSells += 1;
    this.openPositions = Math.max(0, this.openPositions - 1);
    this.realizedPnlQuoteUi += realizedPnlQuoteUi;

    if (realizedPnlQuoteUi >= 0) {
      this.wins += 1;
      return;
    }

    this.losses += 1;
  }

  public setOpenPositions(count: number): void {
    this.openPositions = Math.max(0, count);
  }

  public snapshot(): MetricsSnapshot {
    return {
      startedAt: this.startedAt,
      uptimeMs: Date.now() - this.startedAt,
      totalBuys: this.totalBuys,
      totalSells: this.totalSells,
      wins: this.wins,
      losses: this.losses,
      realizedPnlQuoteUi: this.realizedPnlQuoteUi,
      openPositions: this.openPositions,
      lastUpdatedAt: Date.now()
    };
  }

  public async flushToFile(path: string): Promise<void> {
    const payload = JSON.stringify(this.snapshot(), null, 2);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, payload, "utf8");
  }
}