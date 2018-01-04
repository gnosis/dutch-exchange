/* eslint no-console:0, max-len:0, no-plusplus:0, no-mixed-operators:0, no-trailing-spaces:0 */

const DutchExchange = artifacts.require('DutchExchange')
const EtherToken = artifacts.require('EtherToken')
const PriceOracle = artifacts.require('PriceOracle')
const PriceOracleInterface = artifacts.require('PriceOracleInterface')
const TokenGNO = artifacts.require('TokenGNO')
const TokenTUL = artifacts.require('TokenTUL')

// const MathSol = artifacts.require('Math')
// const StandardToken = artifacts.require('StandardToken')
// const Token = artifacts.require('./Token.sol')
// const OWL = artifacts.require('OWL')

const { 
  eventWatcher,
  logger,
  timestamp,
} = require('./utils')

const { wait } = require('@digix/tempo')(web3)

const MaxRoundingError = 100000

// Test VARS
let eth
let gno
let dx
let oracle
let tokenTUL
// testing Auction Functions
const setupTest = async (accounts) => {
  // get buyers, sellers set up and running
  gno = await TokenGNO.deployed()
  eth = await EtherToken.deployed()
  tokenTUL = await TokenTUL.deployed()
  // create dx
  dx = await DutchExchange.deployed()
  // create price Oracle
  oracle = await PriceOracle.deployed()

  // Await ALL Promises for each account setup
  await Promise.all(accounts.map((acct) => {
    /* eslint array-callback-return:0 */
    if (acct === accounts[0]) return

    eth.deposit({ from: acct, value: 10 ** 9 })
    eth.approve(dx.address, 10 ** 9, { from: acct })
    gno.transfer(acct, 10 ** 18, { from: accounts[0] })
    gno.approve(dx.address, 10 ** 18, { from: acct })
  }))
  // Deposit depends on ABOVE finishing first... so run here
  await Promise.all(accounts.map((acct) => {
    if (acct === accounts[0]) return

    dx.deposit(eth.address, 10 ** 9, { from: acct })
    dx.deposit(gno.address, 10 ** 18, { from: acct })
  }))
  // add token Pair
  // updating the oracle Price. Needs to be changed later to another mechanism
  await oracle.updateETHUSDPrice(60000, { from: accounts[0] })
}

const setAndCheckAuctionStarted = async (ST, BT) => {
  const startingTimeOfAuction = (await dx.auctionStarts.call(ST.address, BT.address)).toNumber()

  // wait for the right time to send buyOrder

  await wait(startingTimeOfAuction - timestamp())
  assert.equal(timestamp() >= startingTimeOfAuction, true)
}

/**
 * waitUntilPriceIsXPercentOfPreviousPrice
 * @param {*} ST  - sellToken
 * @param {*} BT  - buyToken
 * @param {*} p   - percentage of the previous price
 */
const waitUntilPriceIsXPercentOfPreviousPrice = async (ST, BT, p) => {
  const startingTimeOfAuction = (await dx.auctionStarts.call(ST.address, BT.address)).toNumber()
  const timeToWaitFor = (86400 - p * 43200) / (1 + p) + startingTimeOfAuction
  // wait until the price is good
  await wait(timeToWaitFor - timestamp())
  assert.equal(timestamp() >= timeToWaitFor, true)
}

/**
 * checkBalanceBeforeClaim
 * @param {string} acct       => acct to check Balance of
 * @param {number} idx        => auctionIndex to check
 * @param {string} claiming   => 'seller' || 'buyer'
 * @param {string} sellToken  => gno || eth
 * @param {string} buyToken   => gno || eth
 * @param {number} amt        => amt to check
 * @param {number} round      => rounding error threshold
 */
const checkBalanceBeforeClaim = async (
  acct,
  idx,
  claiming,
  sellToken = eth,
  buyToken = gno,
  amt = (10 ** 9),
  round = MaxRoundingError,
) => {
  if (claiming === 'buyer') {
    // const auctionIndex = await getAuctionIndex()
    const balanceBeforeClaim = (await dx.balances.call(sellToken.address, acct)).toNumber()
    await dx.claimBuyerFunds(sellToken.address, buyToken.address, acct, idx)
    console.log(`${balanceBeforeClaim}-->${amt}-->-->${(await dx.balances.call(sellToken.address, acct)).toNumber()}`)
    assert.equal(Math.abs(balanceBeforeClaim + amt - (await dx.balances.call(sellToken.address, acct)).toNumber()) < round, true)
  } else {
    const balanceBeforeClaim = (await dx.balances.call(buyToken.address, acct)).toNumber()
    await dx.claimSellerFunds(sellToken.address, buyToken.address, acct, idx)
    console.log(`${balanceBeforeClaim}-->${amt}-->-->${(await dx.balances.call(buyToken.address, acct)).toNumber()}`)
    assert.equal(Math.abs(balanceBeforeClaim + amt - (await dx.balances.call(buyToken.address, acct)).toNumber()) < round, true)
  }
}

const mintTulipTokensByTradingWithItselveAfterAnAuctionWasClosed = async (
  acct,
  exchangeOwner,
  sellToken = eth,
  buyToken = gno,
  amt = (10 ** 9),
) => {
  logger('tulip balance before trade:', await tokenTUL.balances.call(acct))
  await dx.updateApprovalOfToken(eth.address, true, { from: exchangeOwner })
  await dx.updateApprovalOfToken(gno.address, true, { from: exchangeOwner })
  priceETH = await oracle.getUSDETHPrice.call() / 100
  // //priceGNO=await oracle.getUSDETHPrice.call()*2; //> should acctually be await dx.oraclePrice() ipo 2
  // //needed volume:
  volume = amt / priceETH / 2
  auctionIndex = await getAuctionIndex()
  // await dx.postSellOrder(eth.address, gno.address, auctionIndex, volume, { from: acct })
  // logger('sell order went through')
  // logger('setandCheck returns:', await setAndCheckAuctionStarted(eth, gno))
  // await waitUntilPriceIsXPercentOfPreviousPrice(eth, gno, 1)
  // await dx.postBuyOrder(eth.address, gno.address, auctionIndex, volume * 2, { from: acct })
 
  // await checkBalanceBeforeClaim(seller1, auctionIndex, 'buyer', eth, gno, (volume - volume / 200))
  // await checkBalanceBeforeClaim(seller1, auctionIndex, 'seller', eth, gno, (volume *2 - volume * 2 / 200))
 
  logger('tulip balance after trade:', await tokenTUL.balances(acct))
}

const getAuctionIndex = async (sell = eth, buy = gno) => (await dx.getAuctionIndex.call(buy.address, sell.address)).toNumber()
// const getStartingTimeOfAuction = async (sell = eth, buy = gno) => (await dx.auctionStarts.call(sell.address, buy.address)).toNumber()

contract('DutchExchange-TULIP', (accounts) => {
  const [owner, seller1, , buyer1] = accounts

  beforeEach(async () => {
    // set up accounts and tokens
    await setupTest(accounts)

    // add tokenPair ETH GNO
    await dx.addTokenPair(
      eth.address,
      gno.address,
      10 ** 9,
      0,
      2,
      1,
      { from: seller1 },
    )
  })

  it('test mining of tulip tokens', async () => {
    let auctionIndex
    logger('close old auction')

    auctionIndex = await getAuctionIndex()
    await setAndCheckAuctionStarted(eth, gno)
    await waitUntilPriceIsXPercentOfPreviousPrice(eth, gno, 1)
    await dx.postBuyOrder(eth.address, gno.address, auctionIndex, 10 ** 9 * 2, { from: buyer1 })

    logger('test starting')
    await mintTulipTokensByTradingWithItselveAfterAnAuctionWasClosed(seller1, owner, eth.address, gno.address, 10000)
  })
})

contract('DutchExchange-TULIP', (accounts) => {
  const [, seller1, , buyer1] = accounts

  beforeEach(async () => {
    // set up accounts and tokens
    await setupTest(accounts)

    // add tokenPair ETH GNO
    await dx.addTokenPair(
      eth.address,
      gno.address,
      10 ** 9,
      10 ** 8 * 5,
      2,
      1,
      { from: seller1 },
    )
  })

  xit('test workflow of lock/unlocking tulip token', async () => {
    // TODO
  })
})
contract('DutchExchange-TULIP', (accounts) => {
  const [, seller1, buyer1] = accounts

  beforeEach(async () => {
    // set up accounts and tokens
    await setupTest(accounts)

    // add tokenPair ETH GNO
    await dx.addTokenPair(
      eth.address,
      gno.address,
      10 ** 9,
      10 ** 8 * 5,
      2,
      1,
      { from: seller1 },
    )
  })

  xit('test mining of exactly x percent of total tulip tokens supply', async () => {
    // TODO
  })
})

contract('DutchExchange-TULIP', (accounts) => {
  const [, seller1, buyer1] = accounts

  beforeEach(async () => {
    // set up accounts and tokens
    await setupTest(accounts)

    // add tokenPair ETH GNO
    await dx.addTokenPair(
      eth.address,
      gno.address,
      10 ** 9,
      10 ** 8 * 5,
      2,
      1,
      { from: seller1 },
    )
  })

  xit('test transaction fees with x percent of total tulip tokens supply', async () => {
    // TODO
  })
})
/*
  const checkConstruction = async function () {
    // initial price is set
    let initialClosingPrice = await dx.closingPrices(0);
    initialClosingPrice = initialClosingPrice.map(x => x.toNumber());
    assert.deepEqual(initialClosingPrice, [2, 1], 'initialClosingPrice set correctly');

    // sell token is set
    const exchangeSellToken = await dx.sellToken();
    assert.equal(exchangeSellToken, sellToken.address, 'sellToken set correctly');

    // buy token is set
    const exchangeBuyToken = await dx.buyToken();
    assert.equal(exchangeBuyToken, buyToken.address, 'buyToken set correctly');

    // TUL token is set
    const exchangeTUL = await dx.TUL();
    assert.equal(exchangeTUL, TUL.address, 'TUL set correctly');

    // next auction is scheduled correctly
    await nextAuctionScheduled();
  }

  const approveAndSell = async function (amount) {
    const sellerBalancesBefore = (await dx.sellerBalances(1, seller)).toNumber();
    const sellVolumeBefore = (await dx.sellVolumeCurrent()).toNumber();

    await sellToken.approve(dxa, amount, { from: seller });
    await dx.postSellOrder(amount, { from: seller });

    const sellerBalancesAfter = (await dx.sellerBalances(1, seller)).toNumber();
    const sellVolumeAfter = (await dx.sellVolumeCurrent()).toNumber();

    assert.equal(sellerBalancesBefore + amount, sellerBalancesAfter, 'sellerBalances updated');
    assert.equal(sellVolumeBefore + amount, sellVolumeAfter, 'sellVolume updated');
  }

  const postSellOrders = async function () {
    await utils.assertRejects(approveAndBuy(50));
    await approveAndSell(50);
    await approveAndSell(50);
  }

  const approveAndBuy = async function (amount) {
    const buyerBalancesBefore = (await dx.buyerBalances(1, buyer)).toNumber();
    const buyVolumeBefore = (await dx.buyVolumes(1)).toNumber();

    await buyToken.approve(dxa, amount, { from: buyer });
    const price = (await dx.getPrice(1)).map(x => x.toNumber());

    await dx.postBuyOrder(amount, 1, { from: buyer });

    const buyerBalancesAfter = (await dx.buyerBalances(1, buyer)).toNumber();
    const buyVolumeAfter = (await dx.buyVolumes(1)).toNumber();

    assert.equal(buyerBalancesBefore + amount, buyerBalancesAfter, 'buyerBalances updated');
    assert.equal(buyVolumeBefore + amount, buyVolumeAfter, 'buyVolumes updated');
  }

  const approveBuyAndClaim = async function (amount) {
    const claimedAmountBefore = (await dx.claimedAmounts(1, buyer)).toNumber();
    const buyerBalancesBefore = (await dx.buyerBalances(1, buyer)).toNumber();
    const buyVolumeBefore = (await dx.buyVolumes(1)).toNumber();

    await buyToken.approve(dxa, amount, { from: buyer });
    const price = (await dx.getPrice(1)).map(x => x.toNumber());
    await dx.postBuyOrderAndClaim(amount, 1, { from: buyer });

    const claimedAmountAfter = (await dx.claimedAmounts(1, buyer)).toNumber();
    const buyerBalancesAfter = (await dx.buyerBalances(1, buyer)).toNumber();
    const expectedReturn = Math.floor(buyerBalancesAfter * price[1] / price[0]) - claimedAmountBefore;
    const buyVolumeAfter = (await dx.buyVolumes(1)).toNumber();

    assert.equal(expectedReturn + claimedAmountBefore, claimedAmountAfter, 'claimedAmounts updated');
    assert.equal(buyerBalancesBefore + amount, buyerBalancesAfter, 'buyerBalances updated');
    assert.equal(buyVolumeAfter, buyVolumeBefore + amount, 'buyVolumes updated');
  }

  const postBuyOrdersAndClaim = async function () {
    await approveAndBuy(50);
    await approveBuyAndClaim(25);
    await utils.assertRejects(approveAndSell(50));
    await auctionStillRunning();
  }

  const auctionStillRunning = async function () {
    const auctionIndex = (await dx.auctionIndex()).toNumber();
    assert.equal(auctionIndex, 1, 'auction index same');
  }

  const startAuction = async function () {
    const exchangeStart = (await dx.auctionStart()).toNumber();
    const now = (await dx.now()).toNumber();
    const timeUntilStart = exchangeStart - now;
    await dx.increaseTimeBy(1, timeUntilStart);
  }

  const runThroughAuctionBeforeClear = async function () {
    await checkConstruction();
    await postSellOrders();

    await startAuction();
    await postBuyOrdersAndClaim();
  }

  const clearAuctionWithTime = async function () {
    const buyVolume = (await dx.buyVolumes(1)).toNumber();
    const sellVolume = (await dx.sellVolumeCurrent()).toNumber();
    const auctionStart = (await dx.auctionStart()).toNumber();

    // Auction clears when sellVolume * price = buyVolume
    // Since price is a function of time, so we have to rearrange the equation for time, which gives
    timeWhenAuctionClears = Math.ceil(72000 * sellVolume / buyVolume - 18000 + auctionStart);
    await dx.setTime(timeWhenAuctionClears);
    const buyerBalance = (await dx.buyerBalances(1, buyer)).toNumber();

    await buyToken.approve(dxa, 1, { from: buyer });
    await dx.postBuyOrder(1, 1, { from: buyer });

    const buyVolumeAfter = (await dx.buyVolumes(1)).toNumber();
    const buyerBalanceAfter = (await dx.buyerBalances(1, buyer)).toNumber();

    // Nothing has been updated
    assert.equal(buyVolume, buyVolumeAfter, 'buyVolume constant');
    assert.equal(buyerBalance, buyerBalanceAfter, 'buyerBalance constant');

    // New auction has been scheduled
    await auctionCleared();
  }

  const clearAuctionWithBuyOrder = async function () {
    const buyerBalanceBefore = (await dx.buyerBalances(1, buyer)).toNumber();
    const buyVolumeBefore = (await dx.buyVolumes(1)).toNumber();
    const sellVolume = (await dx.sellVolumeCurrent()).toNumber();
    const auctionStart = (await dx.auctionStart()).toNumber();
    const price = (await dx.getPrice(1)).map(x => x.toNumber());

    // Auction clears when sellVolume * price = buyVolume
    // Solidity rounds down, so slightly less is required
    const amountToClearAuction = Math.floor(sellVolume * price[0] / price[1]) - buyVolumeBefore;
    // Let's add a little overflow to see if it handles it
    const amount = amountToClearAuction + 10;

    // It should subtract it before transferring

    await buyToken.approve(dxa, amount, { from: buyer });
    await dx.postBuyOrder(amount, 1, { from: buyer });

    const buyVolumeAfter = (await dx.buyVolumes(1)).toNumber();
    const buyerBalanceAfter = (await dx.buyerBalances(1, buyer)).toNumber();

    assert.equal(buyVolumeBefore + amountToClearAuction, buyVolumeAfter, 'buyVolume updated');
    assert.equal(buyerBalanceBefore + amountToClearAuction, buyerBalanceAfter, 'buyerBalances updated');

    // New auction has been scheduled
    await auctionCleared();
  }

  const claimBuyerFunds = async function () {
    const buyerBalance = (await dx.buyerBalances(1, buyer)).toNumber();
    const claimedAmountBefore = (await dx.claimedAmounts(1, buyer)).toNumber();

    await dx.claimBuyerFunds(1, { from: buyer });

    // Calculate returned value
    const price = (await dx.getPrice(1)).map(x => x.toNumber());
    const returned = Math.floor(buyerBalance * price[1] / price[0]) - claimedAmountBefore;
    const claimedAmountAfter = (await dx.claimedAmounts(1, buyer)).toNumber();

    assert.equal(claimedAmountBefore + returned, claimedAmountAfter, 'claimedAmount updated');

    // Follow-up claims should fail
    utils.assertRejects(dx.claimBuyerFunds(1, { from: buyer }));
  }

  const claimSellerFunds = async function () {
    const sellerBalance = (await dx.sellerBalances(1, seller)).toNumber();

    const claimReceipt = await dx.claimSellerFunds(1, { from: seller });

    const returned = claimReceipt.logs[0].args._returned.toNumber();

    const price = (await dx.getPrice(1)).map(x => x.toNumber());
    const expectedReturn = Math.floor(sellerBalance * price[0] / price[1]);
    assert.equal(expectedReturn, returned, 'returned correct amount');

    // Follow-up claims should fail
    utils.assertRejects(dx.claimSellerFunds(1, { from: seller }));
  }

  const auctionCleared = async function () {
    // Get exchange variables
    const price = (await dx.getPrice(1)).map(x => x.toNumber());
    const closingPrice = (await dx.closingPrices(1)).map(x => x.toNumber());
    const sellVolumeCurrent = (await dx.sellVolumeCurrent()).toNumber();
    const sellVolumeNext = (await dx.sellVolumeNext()).toNumber();
    const auctionIndex = (await dx.auctionIndex()).toNumber();

    // Variables have been updated
    assert.deepEqual(closingPrice, price);
    assert.equal(sellVolumeCurrent, 0);
    assert.equal(sellVolumeNext, 0);
    assert.equal(auctionIndex, 2);

    // Next auction scheduled
    await nextAuctionScheduled();
  }

  const nextAuctionScheduled = async function () {
    const exchangeStart = (await dx.auctionStart()).toNumber();
    const now = (await dx.now()).toNumber();
    assert(now < exchangeStart, 'auction starts in future');
    assert(now + 21600 >= exchangeStart, 'auction starts within 6 hrs');
  }

  it('runs correctly through auction until clearing', runThroughAuctionBeforeClear)

  it('clears auction with time', async function () {
    await runThroughAuctionBeforeClear();
    await clearAuctionWithTime();
  })

  it('claims funds correctly after clearing', async function () {
    await runThroughAuctionBeforeClear();
    await clearAuctionWithBuyOrder();

    await claimBuyerFunds();
    await claimSellerFunds();
  })

  it('claims funds correctly after new auction began', async function () {
    await runThroughAuctionBeforeClear();
    await clearAuctionWithBuyOrder();

    await startAuction();

    await claimBuyerFunds();
    await claimSellerFunds();
  }) */
