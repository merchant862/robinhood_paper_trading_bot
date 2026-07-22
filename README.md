# Robinhood Chain Paper Bot

JavaScript paper-trading scanner for Robinhood Chain meme-token discovery.

This version does not trade real funds. It watches Robinhood Chain market feeds, stores tokens and pools in MySQL, scores opportunities, opens virtual paper trades, and sends WhatsApp alerts through Green API.

## What It Does

- Watches the Robinhood public sequencer WebSocket feed.
- Backfills Uniswap V2/V3 pool creation logs from onchain data.
- Uses DexScreener only for delayed enrichment and backup discovery.
- Stores tokens, pools, snapshots, paper trades, alerts, and wallet events in MySQL.
- Opens virtual paper trades when a token score passes the configured threshold.
- Sends WhatsApp alerts through Green API, with dry-run mode enabled by default.

## Current Safety Mode

There is no private key, no wallet, and no live swap execution in this phase. The bot is for data collection and paper trading only.

## Setup

```bash
npm install
cp .env.example .env
```

Create a MySQL database:

```sql
CREATE DATABASE robinhood_bot CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Edit `.env` and set your MySQL credentials:

```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=robinhood_bot
DB_USER=root
DB_PASSWORD=your_password
```

Sync tables:

```bash
npm run db:sync
```

Run:

```bash
npm start
```

## WhatsApp Alerts

The bot uses Green API for WhatsApp alerts.

For a safe first run, keep alerts in dry-run mode:

```env
WHATSAPP_ENABLED=false
```

When Green API is ready, set:

```env
GREEN_API_INSTANCE_ID=your_instance_id
GREEN_API_TOKEN=your_api_token
WHATSAPP_CHAT_ID=923001234567@c.us
WHATSAPP_ENABLED=true
```

Alert controls:

```env
WHATSAPP_MIN_SCORE=70
WHATSAPP_MAX_ALERTS_PER_HOUR=30
```

## Feed Settings

Default Robinhood Chain endpoints:

```env
ROBINHOOD_CHAIN_ID=4663
ROBINHOOD_RPC_HTTP=https://rpc.mainnet.chain.robinhood.com
ROBINHOOD_RPC_WSS=wss://feed.mainnet.chain.robinhood.com
```

The sequencer feed is the primary trigger:

```env
SEQUENCER_FEED_ENABLED=true
CHAIN_POLL_MS=5000
CHAIN_HTTP_FALLBACK_MS=60000
CHAIN_LOOKBACK_BLOCKS=250
CHAIN_MAX_BLOCK_RANGE=200
```

`CHAIN_POLL_MS` debounces the high-frequency WebSocket feed so the bot does not spam HTTP `getLogs` calls. `CHAIN_HTTP_FALLBACK_MS` is only a safety backfill if the feed stalls or reconnects.

## Feed Priority

1. Uniswap onchain factory/pool events
2. Robinhood sequencer WebSocket as the live trigger
3. DexScreener enrichment and delayed discovery
4. Blockscout/explorer links for manual verification

## Paper Trading Settings

```env
PAPER_TRADE_USD=50
PAPER_ENTRY_MIN_SCORE=70
PAPER_MAX_OPEN_TRADES=20
```

The bot creates a virtual entry when the score is high enough. The score is intentionally simple in this first version and will improve as real data comes in.

## Scripts

```bash
npm start       # run the bot
npm run dev     # run with node --watch
npm run db:sync # sync Sequelize tables
```

## Important Notes

- Public Robinhood endpoints are fine for paper trading, but production/live trading should use a paid RPC/WSS provider.
- DexScreener is not treated as the fastest source. It is used for enrichment because it can be delayed.
- WhatsApp alerts should stay throttled so the number does not get spammed.
- Live trading should only be added after the paper data proves the filters are useful.
