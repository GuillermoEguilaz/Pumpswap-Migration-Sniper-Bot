import { Connection } from "@solana/web3.js";
import { config } from "./config";
import { logger } from "./logger";
import { JupiterService } from "./services/jupiter";
import { MetricsGatherer } from "./services/metrics-gatherer";
import { PumpfunMigrationMonitor } from "./services/pumpfun-monitor";
import { PumpswapSniper } from "./services/pumpswap-sniper";
import { loadKeypairFromSecret } from "./services/wallet";

async function main(): Promise<void> {
  const connection = new Connection(config.rpcHttpUrl, {
    commitment: "confirmed",
    wsEndpoint: config.rpcWsUrl
  });

  const owner = loadKeypairFromSecret(config.walletPrivateKey);

  const jupiter = new JupiterService(connection, config);
  const metrics = new MetricsGatherer();
  const monitor = new PumpfunMigrationMonitor(connection, config);
  const sniper = new PumpswapSniper(owner, jupiter, metrics, config);

  monitor.on("migration", async (signal) => {
    await sniper.handleMigration(signal);
  });

  sniper.start();
  await monitor.start();

  const metricsInterval = setInterval(() => {
    void metrics
      .flushToFile("runtime/metrics.json")
      .then(() => logger.debug({ openPositions: sniper.getOpenPositionCount() }, "Metrics flushed"))
      .catch((error) => logger.warn({ error }, "Failed to flush metrics"));
  }, config.metricsFlushIntervalMs);

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, "Shutting down bot");
    clearInterval(metricsInterval);
    sniper.stop();
    await monitor.stop();
    await metrics.flushToFile("runtime/metrics.json");
    process.exit(0);
  };

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });

  logger.info(
    {
      wallet: owner.publicKey.toBase58(),
      pumpfunProgramId: config.pumpfunProgramId,
      pumpswapProgramId: config.pumpswapProgramId,
      buyAmountSol: config.buyAmountSol,
      takeProfitPct: config.takeProfitPct,
      stopLossPct: config.stopLossPct
    },
    "Pumpswap migration sniper bot started"
  );
}

main().catch((error) => {
  logger.fatal({ error }, "Fatal startup error");
  process.exit(1);
});