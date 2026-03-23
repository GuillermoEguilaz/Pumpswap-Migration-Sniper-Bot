# Pumpswap Migration Sniper Bot

Production-style TypeScript Solana bot scaffold to:
- monitor pump.fun migration signals
- detect pump.fun -> PumpSwap migration events
- buy immediately on migration
- manage exits with take-profit / stop-loss
- gather and persist runtime trade metrics

> This bot is provided as a framework. You must validate program IDs, instruction discriminators, slippage, and execution assumptions on devnet/test wallets before mainnet use.

## Features

- **Pump.fun migration monitoring**
  - watches pump.fun and PumpSwap program logs in real-time
  - emits migration events when configured keywords/discriminators are seen
- **Fast buy execution**
  - executes swaps through Jupiter API (route can include PumpSwap pools when available)
  - signs and sends raw swap transactions through your RPC
- **Risk management**
  - per-position take-profit / stop-loss checks
  - single-position lock to avoid overlapping entries (configurable)
- **Gather function (metrics)**
  - tracks realized/unrealized PnL, win/loss, and open positions
  - persists metrics snapshots to disk at interval
- **Config-first**
  - `.env` driven settings for RPC, wallet, risk params, and log parsing

## Project Structure

- `src/index.ts` - app bootstrap
- `src/config.ts` - env config parsing and validation
- `src/logger.ts` - pino logger setup
- `src/services/pumpfun-monitor.ts` - migration signal watcher
- `src/services/pumpswap-sniper.ts` - buy logic + position orchestration
- `src/services/position-manager.ts` - take-profit / stop-loss loop
- `src/services/jupiter.ts` - quote/swap integration
- `src/services/metrics-gatherer.ts` - gather function (runtime stats + persistence)
- `src/services/wallet.ts` - keypair loader

## Requirements

- Node.js 20+
- npm 9+
- Solana wallet with SOL for fees and quote token balance for buys
- RPC endpoint with websocket support (Helius/Triton/QuickNode recommended)

## Quick Start

1. Install dependencies:

```bash
npm install
```

2. Create env file:

```bash
copy .env.example .env
```

3. Fill `.env` values:
- `RPC_HTTP_URL`, `RPC_WS_URL`
- `WALLET_PRIVATE_KEY` (base58 secret key)
- `PUMPFUN_PROGRAM_ID`, `PUMPSWAP_PROGRAM_ID`
- buy/sell parameters (`BUY_AMOUNT_SOL`, `TAKE_PROFIT_PCT`, `STOP_LOSS_PCT`, etc.)

4. Start bot:

```bash
npm run dev
```

For compiled run:

```bash
npm run build
npm start
```

## Strategy Flow

1. Subscribe to logs:
   - pump.fun program (migrate-ready hints)
   - PumpSwap program (migration/pool creation hints)
2. Parse logs and identify candidate token mint.
3. Run guard checks (`MAX_OPEN_POSITIONS`, cooldown, duplicate mint protection).
4. Buy token immediately via Jupiter swap tx.
5. Open position tracker:
   - repeatedly quote sell value
   - execute sell when TP/SL threshold reached
6. Gather metrics and persist snapshots (`./runtime/metrics.json`).

## Important Notes

- **Instruction parsing** in this scaffold is keyword/discriminator based for speed and flexibility. You should harden with full IDL/Borsh decode for pump.fun and PumpSwap instructions you target.
- **Jupiter dependency** means execution quality depends on available routes and API latency.
- **MEV risk** is real. Consider priority fees, Jito bundles, and private RPC for competitive sniping.
- **Do not run with large capital first.**

## Safety Checklist Before Mainnet

- Validate all program IDs and migration log signatures
- Backtest on historical migrated tokens
- Tune `SLIPPAGE_BPS` by token volatility
- Add max market cap / liquidity filters
- Add anti-honeypot and freeze-authority checks
- Run on a dedicated wallet and machine

## Scripts

- `npm run dev` - run with `tsx`
- `npm run build` - compile TypeScript
- `npm start` - run compiled bot

## License

MIT
