/* eslint prefer-const:0, max-len:0, object-curly-newline:1, no-param-reassign:0, no-console:0, no-mixed-operators:0 */
const { wait } = require('@digix/tempo')(web3)
const { timestamp, varLogger, log } = require('./utils')

const MaxRoundingError = 1000000

const contractNames = [
  'DutchExchange',
  'EtherToken',
  'TokenGNO',
  'TokenTUL',
  'PriceOracle',
]
/**
 * getContracts - async loads contracts and instances
 *
 * @returns { Mapping(contractName => deployedContract) }
 */
const getContracts = async () => {
  const depContracts = contractNames.map(c => artifacts.require(c)).map(cc => cc.deployed())
  const contractInstances = await Promise.all(depContracts)

  const deployedContracts = contractNames.reduce((acc, name, i) => {
    acc[name] = contractInstances[i]
    return acc
  }, {})

  return deployedContracts
}

/**
 * >setupTest()
 * @param {Array[address]} accounts => ganache-cli accounts passed in globally
 * @param {Object}         contract => Contract object obtained via: const contract = await getContracts() (see above)
 */
const setupTest = async (accounts, {
  DutchExchange: dx, EtherToken: eth, TokenGNO: gno, PriceOracle: oracle,
}) => {
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

// testing Auction Functions
/**
 * setAndCheckAuctionStarted - gets Auction Idx for curr Token Pair and moves time to auction start if: start = false
 * @param {address} ST - Sell Token
 * @param {address} BT - Buy Token
 */
const setAndCheckAuctionStarted = async (ST, BT) => {
  const { DutchExchange: dx, EtherToken: eth, TokenGNO: gno } = await getContracts()
  ST = ST || eth; BT = BT || gno

  const startingTimeOfAuction = (await dx.getAuctionStart.call(ST.address, BT.address)).toNumber()

  // wait for the right time to send buyOrder
  // implements isAtLeastZero (aka will not go BACK in time)
  await wait((startingTimeOfAuction - timestamp()) + 500)

  log(`
  time now ----------> ${new Date(timestamp() * 1000)}
  auction starts ----> ${new Date(startingTimeOfAuction * 1000)}
  `)

  assert.equal(timestamp() >= startingTimeOfAuction, true)
}

/**
 * waitUntilPriceIsXPercentOfPreviousPrice
 * @param {address} ST  => Sell Token
 * @param {address} BT  => Buy Token
 * @param {unit}    p   => percentage of the previous price
 */
const waitUntilPriceIsXPercentOfPreviousPrice = async (ST, BT, p) => {
  const { DutchExchange: dx, EtherToken: eth, TokenGNO: gno } = await getContracts()
  const startingTimeOfAuction = (await dx.getAuctionStart.call(ST.address, BT.address)).toNumber()
  const timeToWaitFor = Math.ceil((86400 - p * 43200) / (1 + p)) + startingTimeOfAuction
  // wait until the price is good
  await wait(timeToWaitFor - timestamp())
  const [num, den] = (await dx.getPriceForJS(eth.address, gno.address, 1)).map(n => n.toNumber())
  log(num, den, 'Price at this moment === ', num / den)
  assert.equal(timestamp() >= timeToWaitFor, true)
}

/**
 * checkBalanceBeforeClaim
 * @param {string} acct       => acct to check Balance of
 * @param {number} idx        => auctionIndex to check
 * @param {string} claiming   => 'seller' || 'buyer'
 * @param {address} ST        => Sell Token
 * @param {address} BT        => Buy Token
 * @param {number} amt        => amt to check
 * @param {number} round      => rounding error threshold
 */
const checkBalanceBeforeClaim = async (
  acct,
  idx,
  claiming,
  ST,
  BT,
  amt = (10 ** 9),
  round = (MaxRoundingError),
) => {
  const { DutchExchange: dx, EtherToken: eth, TokenGNO: gno } = await getContracts()
  ST = ST || eth; BT = BT || gno

  let token = ST
  if (claiming === 'seller') {
    token = BT
  }

  const balanceBeforeClaim = (await dx.balances.call(token.address, acct)).toNumber()

  if (claiming === 'buyer') {
    await dx.claimBuyerFunds(ST.address, BT.address, acct, idx)
  } else {
    await dx.claimSellerFunds(ST.address, BT.address, acct, idx)
  }

  const balanceAfterClaim = (await dx.balances.call(token.address, acct)).toNumber()
  const difference = Math.abs(balanceBeforeClaim + amt - balanceAfterClaim)
  varLogger('claiming for', claiming)
  varLogger('balanceBeforeClaim', balanceBeforeClaim)
  varLogger('amount', amt)
  varLogger('balanceAfterClaim', balanceAfterClaim)
  varLogger('difference', difference)
  assert.equal(difference < round, true)
}

const getAuctionIndex = async (sell, buy) => {
  const { DutchExchange: dx, EtherToken: eth, TokenGNO: gno } = await getContracts()
  sell = sell || eth; buy = buy || gno

  return (await dx.getAuctionIndex.call(buy.address, sell.address)).toNumber()
}

// const getStartingTimeOfAuction = async (sell = eth, buy = gno) => (await dx.getAuctionStart.call(sell.address, buy.address)).toNumber()

/**
 * postBuyOrder
 * @param {address} ST      => Sell Token
 * @param {address} BT      => Buy Token
 * @param {uint}    aucIdx  => auctionIndex
 * @param {uint}    amt     => amount
 *
 * @returns { tx receipt }
 */
const postBuyOrder = async (ST, BT, aucIdx, amt, acct) => {
  const { DutchExchange: dx, EtherToken: eth, TokenGNO: gno } = await getContracts()
  ST = ST || eth; BT = BT || gno
  let auctionIdx = aucIdx || await getAuctionIndex()

  log(`
  Current Auction Index -> ${auctionIdx}
  Posting Buy Amt -------> ${amt} in ETH for GNO
  `)

  // TODO David wants to correc this
  // const currentSellVolume = (await dx.sellVolumesCurrent[ST.address][BT.address]).toNumber()
  // const currentBuyVolume = (await dx.sellVolumesCurrent[ST.address][BT.address]).toNumber()
  // const [priceNum, priceDen] = (await dx.getPriceForJS(ST.address, BT.address))
  // const outstandingVolume = currentSellVolume - currentBuyVolume * priceNum / priceDen

  // Post buyOrder
  await dx.postBuyOrder(ST.address, BT.address, auctionIdx, amt, { from: acct })

  // TODO David wants to correc this
  // if (outstandingVolume <= amt) {
  //   assert.equal(currentBuyVolume + outstandingVolume, (await dx.closingPrice(ST.address, BT.address)))
  //   assert.equal((await dx.buyVolumes(ST.address, BT.address)).toNumber(), 0)
  // } else {
  //   assert.equal(0, 0)
  // }
}

/**
 * claimBuyerFunds
 * @param {address} ST      => Sell Token
 * @param {address} BT      => Buy Token
 * @param {address} user    => user address
 * @param {uint}    aucIdx  => auction Index [@default => getAuctionindex()]
 * @param {address} acct    => signer of tx if diff from user [@default = user]
 *
 * @returns { [uint returned, uint tulipsToIssue] }
 */
const claimBuyerFunds = async (ST, BT, user, aucIdx, acct) => {
  const { DutchExchange: dx, EtherToken: eth, TokenGNO: gno } = await getContracts()
  ST = ST || eth; BT = BT || gno; user = user || acct
  let auctionIdx = aucIdx || await getAuctionIndex()

  return dx.claimBuyerFunds(ST.address, BT.address, user, auctionIdx, { from: user })
}

/**
   * checkUserReceivesTulipTokens
   * @param {address} ST    => Sell Token: token using to buy buyToken (normally ETH)
   * @param {address} BT    => Buy Token: token to buy
   * @param {address} user  => address of current user buying and owning tulips
   */
const checkUserReceivesTulipTokens = async (ST, BT, user) => {
  const {
    DutchExchange: dx, EtherToken: eth, TokenGNO: gno, TokenTUL: tokenTUL,
  } = await getContracts()

  ST = ST || eth; BT = BT || gno

  const aucIdx = await getAuctionIndex()
  const [returned, tulips] = (await dx.claimBuyerFunds.call(ST.address, BT.address, user, aucIdx)).map(amt => amt.toNumber())
  // set global tulips state
  log(`
    RETURNED  = ${returned}
    TULIPS    = ${tulips}
  `)
  assert.equal(returned, tulips, 'for ETH -> * pair returned tokens should equal tulips minted')

  /*
     * SUB TEST 3: CLAIMBUYERFUNDS - CHECK BUYVOLUMES - CHECK LOCKEDTULIPS AMT = 1:1 FROM AMT IN POSTBUYORDER
     */
  const { receipt: { logs } } = await claimBuyerFunds(ST, BT, false, false, user)
  log(logs ? '\tCLAIMING FUNDS SUCCESSFUL' : 'CLAIM FUNDS FAILED')
  log(logs)

  const buyVolumes = (await dx.buyVolumes.call(ST.address, BT.address)).toNumber()
  log(`
    CURRENT ETH//GNO bVolume = ${buyVolumes}
  `)

  const tulFunds = (await tokenTUL.balanceOf.call(user)).toNumber()
  const lockedTulFunds = (await tokenTUL.getLockedAmount.call(user)).toNumber()
  // set global state
  // userTulips = lockedTulFunds
  const newBalance = (await dx.balances.call(ST.address, user)).toNumber()
  log(`
    USER'S OWNED TUL AMT = ${tulFunds}
    USER'S LOCKED TUL AMT = ${lockedTulFunds}

    USER'S ETH AMT = ${newBalance}
  `)
  // due to passage of time(stamp)
  assert.isAtLeast(lockedTulFunds, tulips, 'final tulip tokens are slightly > than calculated from dx.claimBuyerFunds.call')
  assert.isAtLeast(newBalance, lockedTulFunds, 'for ETH -> * pair returned tokens should equal tulips minted')
}

/**
 * unlockTulipTokens
 * @param {address} user => address to unlock Tokens for
 */
const unlockTulipTokens = async (user) => {
  const { TokenTUL: tokenTUL } = await getContracts()

  const userTulips = (await tokenTUL.getLockedAmount.call(user)).toNumber()
  /*
   * SUB TEST 1: CHECK UNLOCKED AMT + WITHDRAWAL TIME
   * [should be 0,0 as none unlocked yet]
   */
  let [unlockedFunds, withdrawTime] = (await tokenTUL.unlockedTULs.call(user)).map(n => n.toNumber())    
  log(`
  AMT OF UNLOCKED FUNDS  = ${unlockedFunds}
  TIME OF WITHDRAWAL     = ${withdrawTime} [0 means no withdraw time as there are 0 locked tokens]
  `)
  assert.equal(unlockedFunds, 0, 'unlockedFunds should be 0')
  assert.equal(withdrawTime, 0, 'Withdraw time should be 0 ')

  /*
   * SUB TEST 2: LOCK TOKENS
   */
  // lock tokens - arbitarily high amt to force Math.min
  await tokenTUL.lockTokens(userTulips, { from: user })
  const totalAmtLocked = (await tokenTUL.lockTokens.call(userTulips, { from: user })).toNumber()
  log(`
  TOKENS LOCKED           = ${totalAmtLocked}
  `)
  assert.equal(totalAmtLocked, userTulips, 'Total locked tulips should equal total user balance of tulips')

  /*
   * SUB TEST 3: UN-LOCK TOKENS
   */
  await tokenTUL.unlockTokens(userTulips, { from: user });
  ([unlockedFunds, withdrawTime] = (await tokenTUL.unlockTokens.call(userTulips, { from: user })).map(t => t.toNumber()))
  log(`
  AMT OF UNLOCKED FUNDS  = ${unlockedFunds}
  TIME OF WITHDRAWAL     = ${withdrawTime} --> ${new Date(withdrawTime * 1000)}
  `)
  assert.equal(unlockedFunds, userTulips, 'unlockedFunds should be = userTulips')
  // assert withdrawTime === now (in seconds) + 24 hours (in seconds)
  assert.equal(withdrawTime, timestamp() + (24 * 3600), 'Withdraw time should be equal to [(24 hours in seconds) + (current Block timestamp in seconds)]')
}
/**
 * calculateTokensInExchange - calculates the tokens held by the exchange
 * @param {address} token => address to unlock Tokens for
 */
const calculateTokensInExchange = async (Accounts, Tokens) => {
  let results = []
  const { DutchExchange: dx } = await getContracts()
  for (let token of Tokens) {
    // add all normal balances
    let balance = 0
    for (let acct of Accounts) {
      balance += (await dx.balances.call(token.address, acct)).toNumber()
    }

    // check balances in each trading pair token<->tokenToTradeAgainst
    // check through all auctions

    for (let tokenPartner of Tokens) {
      if (token.address !== tokenPartner.address) {
        let lastAuctionIndex = (await dx.getAuctionIndex.call(token.address, tokenPartner.address)).toNumber()
        // check old auctions balances
        for (let auctionIndex = 1; auctionIndex < lastAuctionIndex; auctionIndex += 1) {
          for (let acct of Accounts) {
            if ((await dx.buyerBalances(token.address, tokenPartner.address, auctionIndex, acct)) > 0) {
              const [w] = (await dx.claimBuyerFunds.call(token.address, tokenPartner.address, acct, auctionIndex))
              balance += w.toNumber()
            }
            if ((await dx.sellerBalances(tokenPartner.address, token.address, auctionIndex, acct)).toNumber() > 0) {
              const [w] = await dx.claimSellerFunds.call(tokenPartner.address, token.address, acct, auctionIndex)
              balance += w.toNumber()
            }
          }
        }
        // check current auction balances
        balance += (await dx.buyVolumes.call(tokenPartner.address, token.address)).toNumber()
        balance += (await dx.sellVolumesCurrent.call(token.address, tokenPartner.address)).toNumber()

        // check next auction balances
        balance += (await dx.sellVolumesNext.call(token.address, tokenPartner.address)).toNumber()
        balance += (await dx.extraTokens.call(token.address, tokenPartner.address, lastAuctionIndex)).toNumber()
        balance += (await dx.extraTokens.call(token.address, tokenPartner.address, lastAuctionIndex + 1)).toNumber()
        balance += (await dx.extraTokens.call(token.address, tokenPartner.address, lastAuctionIndex + 2)).toNumber()
        // logger('extraTokens',(await dx.extraTokens.call(token.address, tokenPartner.address, lastAuctionIndex)).toNumber())
      }
    }
    results.push(balance)
  }
  return results
}

module.exports = {
  checkBalanceBeforeClaim,
  checkUserReceivesTulipTokens,
  claimBuyerFunds,
  getAuctionIndex,
  getContracts,
  postBuyOrder,
  setAndCheckAuctionStarted,
  setupTest,
  unlockTulipTokens,
  waitUntilPriceIsXPercentOfPreviousPrice,
  calculateTokensInExchange,
}
