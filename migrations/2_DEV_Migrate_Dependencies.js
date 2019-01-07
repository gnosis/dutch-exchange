/* global artifacts */
/* eslint no-undef: "error" */

const migrateDx = require('@gnosis.pm/dx-contracts/src/migrations-truffle-4')

module.exports = (deployer, network, accounts) => migrateDx({
  artifacts,
  deployer,
  network,
  accounts,
  web3,
  thresholdNewTokenPairUsd: process.env.THRESHOLD_NEW_TOKEN_PAIR_USD,
  thresholdAuctionStartUsd: process.env.THRESHOLD_AUCTION_START_USD,
})
