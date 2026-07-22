const { Contract } = require('ethers');
const abi = require('../abi');
const logger = require('../logger');

async function readString(contractCall) {
  try {
    return await contractCall();
  } catch {
    return null;
  }
}

async function getTokenMetadata(provider, address) {
  const contract = new Contract(address, abi.erc20, provider);
  const [name, symbol, decimals] = await Promise.all([
    readString(() => contract.name()),
    readString(() => contract.symbol()),
    readString(() => contract.decimals()),
  ]);

  if (!name && !symbol) {
    logger.debug({ address }, 'token metadata unavailable');
  }

  return {
    name,
    symbol,
    decimals: decimals === null ? null : Number(decimals),
  };
}

module.exports = { getTokenMetadata };
