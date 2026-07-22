const { Interface, JsonRpcProvider } = require('ethers');
const WebSocket = require('ws');
const config = require('../config');
const constants = require('../constants');
const abi = require('../abi');
const logger = require('../logger');
const { handlePoolDetected } = require('../services/token-processor');

const v2Interface = new Interface(abi.uniswapV2Factory);
const v3Interface = new Interface(abi.uniswapV3Factory);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function chunkRange(fromBlock, toBlock, maxRange) {
  const ranges = [];
  let start = fromBlock;
  while (start <= toBlock) {
    const end = Math.min(start + maxRange - 1, toBlock);
    ranges.push([start, end]);
    start = end + 1;
  }
  return ranges;
}

class UniswapLogPoller {
  constructor() {
    this.provider = new JsonRpcProvider(config.chain.httpRpc, config.chain.id);
    this.running = false;
    this.lastBlock = null;
    this.ws = null;
    this.pollInFlight = false;
    this.pendingPoll = false;
    this.fallbackTimer = null;
    this.reconnectTimer = null;
    this.debounceTimer = null;
    this.lastPollStartedAt = 0;
  }

  async start() {
    this.running = true;
    const currentBlock = await this.provider.getBlockNumber();
    this.lastBlock = Math.max(0, currentBlock - config.scanner.lookbackBlocks);
    logger.info({ currentBlock, startBlock: this.lastBlock }, 'uniswap log poller started');

    if (config.scanner.sequencerFeedEnabled) {
      this.startSequencerFeed();
      this.startHttpFallback();
      return new Promise(() => {});
    }

    while (this.running) {
      await this.pollOnceSafely();
      await sleep(config.scanner.pollMs);
    }
  }

  stop() {
    this.running = false;
    if (this.ws) this.ws.close();
    if (this.fallbackTimer) clearInterval(this.fallbackTimer);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
  }

  startHttpFallback() {
    this.fallbackTimer = setInterval(() => {
      this.pollOnceSafely('http_fallback');
    }, config.scanner.httpFallbackMs);
  }

  startSequencerFeed() {
    if (!this.running) return;

    logger.info({ url: config.chain.wssRpc }, 'connecting sequencer feed');
    this.ws = new WebSocket(config.chain.wssRpc, { perMessageDeflate: false });

    this.ws.on('open', () => {
      logger.info('sequencer feed connected');
    });

    this.ws.on('message', (data) => {
      const blockNumber = this.extractBlockNumber(data);
      if (blockNumber !== null) {
        logger.debug({ blockNumber }, 'sequencer feed message');
      }
      this.requestPoll('sequencer_feed');
    });

    this.ws.on('error', (error) => {
      logger.warn({ error: error.message }, 'sequencer feed error');
    });

    this.ws.on('close', (code, reason) => {
      logger.warn({ code, reason: reason.toString() }, 'sequencer feed closed');
      if (!this.running) return;
      this.reconnectTimer = setTimeout(() => this.startSequencerFeed(), 3000);
    });
  }

  extractBlockNumber(data) {
    try {
      const text = Buffer.isBuffer(data) ? data.toString('utf8') : String(data);
      const payload = JSON.parse(text);
      const messages = Array.isArray(payload.messages) ? payload.messages : [];
      for (const item of messages) {
        const blockNumber =
          item?.message?.message?.header?.blockNumber ||
          item?.message?.message?.message?.header?.blockNumber;
        if (Number.isFinite(Number(blockNumber))) return Number(blockNumber);
      }
    } catch {
      return null;
    }
    return null;
  }

  requestPoll(source) {
    const now = Date.now();
    const elapsed = now - this.lastPollStartedAt;

    if (elapsed >= config.scanner.pollMs) {
      this.pollOnceSafely(source);
      return;
    }

    if (this.debounceTimer) return;
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      this.pollOnceSafely(`${source}_debounced`);
    }, config.scanner.pollMs - elapsed);
  }

  async pollOnceSafely(source = 'poll') {
    if (this.pollInFlight) {
      this.pendingPoll = true;
      return;
    }

    this.pollInFlight = true;
    this.lastPollStartedAt = Date.now();
    try {
      await this.pollOnce(source);
    } catch (error) {
      logger.error({ error, source }, 'uniswap poll failed');
    } finally {
      this.pollInFlight = false;
      if (this.pendingPoll && this.running) {
        this.pendingPoll = false;
        setTimeout(() => this.pollOnceSafely('queued'), 0);
      }
    }
  }

  async pollOnce(source = 'poll') {
    const tip = await this.provider.getBlockNumber();
    if (tip <= this.lastBlock) return;

    const fromBlock = this.lastBlock + 1;
    const toBlock = tip;
    logger.debug({ source, fromBlock, toBlock }, 'fetching uniswap logs');
    for (const [from, to] of chunkRange(fromBlock, toBlock, config.scanner.maxBlockRange)) {
      await this.fetchV2Logs(from, to);
      await this.fetchV3Logs(from, to);
      this.lastBlock = to;
    }
  }

  async fetchV2Logs(fromBlock, toBlock) {
    const logs = await this.provider.getLogs({
      address: constants.uniswap.v2Factory,
      fromBlock,
      toBlock,
      topics: [v2Interface.getEvent('PairCreated').topicHash],
    });

    for (const log of logs) {
      const parsed = v2Interface.parseLog(log);
      await handlePoolDetected(this.provider, {
        source: 'uniswap_v2',
        dex: 'uniswap_v2',
        token0: parsed.args.token0,
        token1: parsed.args.token1,
        poolAddress: parsed.args.pair,
        txHash: log.transactionHash,
        blockNumber: log.blockNumber,
      });
    }
  }

  async fetchV3Logs(fromBlock, toBlock) {
    const logs = await this.provider.getLogs({
      address: constants.uniswap.v3Factory,
      fromBlock,
      toBlock,
      topics: [v3Interface.getEvent('PoolCreated').topicHash],
    });

    for (const log of logs) {
      const parsed = v3Interface.parseLog(log);
      await handlePoolDetected(this.provider, {
        source: 'uniswap_v3',
        dex: 'uniswap_v3',
        token0: parsed.args.token0,
        token1: parsed.args.token1,
        feeTier: Number(parsed.args.fee),
        poolAddress: parsed.args.pool,
        txHash: log.transactionHash,
        blockNumber: log.blockNumber,
      });
    }
  }
}

module.exports = { UniswapLogPoller };
