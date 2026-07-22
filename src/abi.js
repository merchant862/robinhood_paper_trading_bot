module.exports = {
  erc20: [
    'function name() view returns (string)',
    'function symbol() view returns (string)',
    'function decimals() view returns (uint8)',
    'function totalSupply() view returns (uint256)',
  ],
  uniswapV2Factory: [
    'event PairCreated(address indexed token0, address indexed token1, address pair, uint256)',
  ],
  uniswapV3Factory: [
    'event PoolCreated(address indexed token0, address indexed token1, uint24 indexed fee, int24 tickSpacing, address pool)',
  ],
};
