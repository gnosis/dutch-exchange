/* eslint no-console:0, max-len:0, no-plusplus:0, no-mixed-operators:0 */
const {
  // timestamp,
  // blockNumber,
  assertRejects,
  wait,
} = require('./utils')

// > Import files
const [
  DutchExchange,
  EtherToken,
  PriceOracle,
  TokenGNO,
  StandardToken,
  Token,
  OWL,
] = ['DutchExchange', 'EtherToken', 'PriceOracle', 'TokenGNO', 'StandardToken', 'Token', 'OWL'].map(c => artifacts.require(c))

// > Test VARS
let eth
let gno
let dx
let oracle

// > Other Variables
// Variables must be at top so they are referencable
const tokenPairs = []

const approvedTokens = []

contract('DutchExchange', async (accounts) => {
  it('sets up tests', async () => {
    await setupTest(accounts)
  })

  for (let j = 0; j < 50; j++) {
    it(`transaction details: ${j.toString()}`, async () => {
      console.log('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~')
      console.log('another transaction', j)
      console.log('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~')
      const t = await selectTransaction()
      console.log(t[0])
      wait(1800)
      await anotherTransaction(accounts, t, j)
    })
  }
})

// > selectTransaction()
async function selectTransaction() {
  // const r = Math.floor(Math.random() * 6)
  // const r = Math.floor(Math.random() * 2) + 2
  const r = 2
  let fn
  const auctionAction = [
    addTokenPair,
    updateApprovalOfToken,
    postSellOrder,
    postBuyOrder,
    claimSellerFunds,
    claimBuyerFunds,
  ]
  fn = auctionAction[r]

  if (r > 1) {
    const u = Math.floor(Math.random() * 5)

    const tokenPair = tokenPairs[Math.floor(Math.random() * tokenPairs.length)]
    let [Ts, Tb] = tokenPair
    if (Math.floor(Math.random() * 2) == 1) [Ts, Tb] = [Tb, Ts]

    const lAI = (await dx.getAuctionIndex(tokenPair[0], tokenPair[1])).toNumber()
    const aI = Math.floor(Math.random() * 3) - 1 + lAI

    const t = [
      `executing ${fn.name}(${Ts}, ${Tb}, ${aI}, ...)`,
      fn,
      Ts,
      Tb,
      u,
      aI,
    ]

    if (r == 2 || r == 3) {
      // random amount
      t.push(10 ** 9)
      return t
    }
    return t
  }
  return [
    fn.name,
    fn,
  ]
}

async function addTokenPair() {

}

async function updateApprovalOfToken() {

}

async function postSellOrder(Ts, Tb, u, aI, am) {
  let expectToPass = true
  let i = 0
  while (expectToPass && i < 2) {
    expectToPass = await postSellOrderConditions(i, Ts, Tb, u, aI, am)
    i++
  }
  log(expectToPass)
  if (expectToPass) {
    await dx.postSellOrder(Ts, Tb, aI, am, { from: u })
  } else {
    await assertRejects(dx.postSellOrder(Ts, Tb, aI, am, { from: u }))
  }
}
async function postBuyOrder(Ts, Tb, u, aI, am) {
  let expectToPass = true
  let i = 0
  while (expectToPass && i < 4) {
    expectToPass = await postBuyOrderConditions(i, Ts, Tb, u, aI, am)
    i++
  }
  if (expectToPass) {
    console.log('successful')
    await dx.postBuyOrder(Ts, Tb, aI, am, { from: u })
  } else {
    console.log('rejected')
    assertRejects(dx.postBuyOrder(Ts, Tb, aI, am, { from: u }))
  }
}
async function claimSellerFunds(Ts, Tb, u, aI) {
  await dx.claimSellerFunds(Ts, Tb, u, aI, { from: u })
}
async function claimBuyerFunds(Ts, Tb, u, aI) {
  await dx.claimBuyerFunds(Ts, Tb, u, aI, { from: u })
}

// > anotherTransaction()
async function anotherTransaction(accounts, t) {
  if (t.length > 2) {
    // pSO & pBO are handled differently
    if (t[1] === postSellOrder || t[1] === postBuyOrder) {
      // find out if should be accepted or rejected
      await t[1](t[2], t[3], accounts[t[4]], t[5], t[6])
    }
    // so are cSF & cBF
    else {
      // find out if should be accepted or rejected
      await t[1](t[2], t[3], accounts[t[4]], t[5])
    }
  }
}

async function postSellOrderConditions(i, Ts, Tb, u, aI, am) {
  if (i == 0) {
    const bal = (await dx.balances(Ts, u)).toNumber()
    if (am > bal) { console.log('failed at 1st case'); return false }
  } else if (i == 1) {
    const lAI = (await dx.getAuctionIndex(Ts, Tb)).toNumber()
    if (aI !== lAI) { console.log('failed at 2nd case'); return false }
  }

  return true
}
/**
 * async postBuyOrderConditions
 * @param {*} i   = index
 * @param {*} Ts  = Token to Sell
 * @param {*} Tb  = Token to Buy
 * @param {*} u   = ???
 * @param {*} aI  = Auction index
 * @param {*} am  = ???
 */
async function postBuyOrderConditions(i, Ts, Tb, u, aI, am) {
  // await doesn't work with switch()...
  if (i == 0) {
    const aS = (await dx.getAuctionStart(Ts, Tb)).toNumber()
    console.log('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~')
    console.log('aS', aS)
    console.log('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~')
    console.log('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~')
    console.log('new Date', (new Date()).getTime() / 1000)
    console.log('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~')
    if (aS > (new Date()).getTime() / 1000) { log(i); return false }
  } else if (i == 1) {
    if (aI <= 0) { log(i); return false }
  } else if (i == 2) {
    const lAI = (await dx.getAuctionIndex(Ts, Tb)).toNumber()
    console.log('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~')
    console.log('lAI', lAI)
    console.log('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~')
    if (aI !== lAI) { log(i); return false }
  } else if (i == 3) {
    const cP = (await dx.closingPrices(Ts, Tb, aI)).map(x => x.toNumber())
    console.log('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~')
    console.log('cP', cP)
    console.log('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~')
    if (cP[0] !== 0) { log(i); return false }
  }

  return true
}

// > setupTest()
async function setupTest(accounts) {
  gno = await TokenGNO.deployed()
  eth = await EtherToken.deployed()
  dx = await DutchExchange.deployed()
  oracle = await PriceOracle.deployed()

  await Promise.all(accounts.map((acct) => {
    if (acct === accounts[0]) return

    // deposit ETH into ETH token & approve
    eth.deposit({ from: acct, value: 10 ** 9 })
    eth.approve(dx.address, 10 ** 9, { from: acct })

    // transfer GNO from owner & approve
    gno.transfer(acct, 10 ** 18, { from: accounts[0] })
    gno.approve(dx.address, 10 ** 18, { from: acct })
  }))

  // Deposit depends on ABOVE finishing first... so run here
  await Promise.all(accounts.map((acct) => {
    if (acct === accounts[0]) return

    dx.deposit(eth.address, 10 ** 9, { from: acct })
    dx.deposit(gno.address, 10 ** 18, { from: acct })
  }))

  // updating the oracle Price. Needs to be changed later to another mechanism
  await oracle.updateETHUSDPrice(700)

  // add token Pair
  await dx.addTokenPair(
    eth.address,
    gno.address,
    10 ** 9,
    0,
    2,
    1,
    { from: accounts[1] },
  )

  tokenPairs.push([eth.address, gno.address])
}

function log(arg) {
  if (typeof arg == 'number') {
    console.log('failed at', arg)
  } else if (typeof arg == 'boolean') {
    if (arg) console.log('successful')
    else console.log('rejected')
  }
}
