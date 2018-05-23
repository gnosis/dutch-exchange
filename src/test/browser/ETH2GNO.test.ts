import expect from 'expect'

declare module 'expect' {
  interface Expectation<T> {
    toBeLessThanOrEqual: Expectation<T>['toBeLessThanOrEqualTo']
    toBeGreaterThanOrEqual: Expectation<T>['toBeGreaterThanOrEqualTo']
  }
}

import { delay, metamaskWarning } from '../utils'
import web3Utils from '../utils/trufflescriptsUtils.js'

import DXart from '../../../build/contracts/DutchExchangeETHGNO.json'
import ETHart from '../../../build/contracts/TokenETH.json'
import GNOart from '../../../build/contracts/TokenGNO.json'
import TULart from '../../../build/contracts/Token.json'

import TC from 'truffle-contract'
import Web3 from 'web3'

const DX = TC(DXart)
const ETH = TC(ETHart)
const GNO = TC(GNOart)
const TUL = TC(TULart)

const currentProvider = typeof window !== 'undefined' && window.web3 && window.web3.currentProvider
console.log('currentProvider', currentProvider)

// when running testrpc via truffle develop change port to 9545
const localProvider = new Web3.providers.HttpProvider('http://localhost:8545')
// Metamask returns only current account from web3.eth.accounts
// so we get all accounts from local testrpc instance
const web3 = new Web3(localProvider)

DX.setProvider(localProvider)
ETH.setProvider(localProvider)
GNO.setProvider(localProvider)
TUL.setProvider(localProvider)

console.log('accounts', web3.eth.accounts)

const setLocalProvider = () => {
  // quickly switch providers to testrpc if needed
  currentProvider && DX.setProvider(localProvider)
}
const setCurrentProvider = () => {
  // switch providers back
  currentProvider && DX.setProvider(currentProvider)
}

const withLocalProvider = async (func: () => void) => {
  setLocalProvider()
  await func()
  setCurrentProvider()
}

const { getTime, increaseTimeBy, setTime } = web3Utils(web3)

describe('ETH 2 GNO contract standalone', () => {
  // TODO: proper types
  let dx: any, eth: any, gno: any, tul: any
  const [master, seller, buyer]: string[] = web3.eth.accounts
  // if Metamask is injected, switch to its provider
  setCurrentProvider()

  let dxa: string

  const accs = { master, seller, buyer }

  // delays interaction so that we can switch accounts in Metamask
  // if running without metamask -- no delay
  const delayFor = (name: string, timeout?: number) => currentProvider
    && (metamaskWarning(name, accs[name]), delay(timeout))

  // TODO: snapshot testrpc state
  // WORKAROUND: truffle migrate --reset before tests


  before(async () => {
    dx = await DX.deployed()
    dxa = DX.address
    eth = await ETH.deployed()
    gno = await GNO.deployed()
    tul = await TUL.deployed()

    Object.assign(accs, { dx: DX.address, eth: ETH.address, gno: GNO.address, tul: TUL.addresss })

    watchAllEventsFor(dx, 'DutchExchange')
    watchAllEventsFor(eth, 'ETH')
    watchAllEventsFor(gno, 'GNO')

    // seller must have initial balance of ETH
    // allow a transfer
    await eth.approve(seller, 100, { from: master })
    console.log('master approved seller to withdraw 100 ETH')

    // transfer initial balance of 100 ETH
    await eth.transferFrom(master, seller, 100, { from: seller })
    // same as
    // await eth.transfer(seller, 100, { from: master })
    console.log('seller', seller, 'received 100 ETH')


    // buyer must have initial balance of GNO
    // allow a transfer
    await gno.approve(buyer, 1000, { from: master })
    console.log('master approved buyer to withdraw 1000 GNO')

    // transfer initial balance of 1000 GNO
    await gno.transferFrom(master, buyer, 1000, { from: buyer })
    console.log('buyer', buyer, 'received 1000 GNO')

    // if Metamask is injected, use it for interaction with DX
    // by switching providers to it
    setCurrentProvider()

    await checkBalances()
  })

  after(async () => {
    await checkBalances()
  })


  it('contracts are deployed', () => {
    expect(dx && eth && gno && tul).toBeTruthy()
  })


  it('accounts are available', () => {
    [master, seller, buyer].forEach(address => expect(address).toMatch(/^0x\w{40}$/))
  })



  it('contracts are deployed with expected initial data', async () => {
    // initial price is set
    let initialClosingPrice = await dx.closingPrices(0)
    initialClosingPrice = initialClosingPrice.map((n: any) => n.toNumber())

    expect(initialClosingPrice).toEqual([2, 1])

    // sell token is set
    const ETHaddress = await dx.sellToken()
    expect(ETHaddress).toBe(ETH.address)

    // buy token is set
    const GNOaddress = await dx.buyToken()
    expect(GNOaddress).toBe(GNO.address)

    // TUL token is set
    const TULaddress = await dx.TUL()
    expect(TULaddress).toBe(TUL.address)
  })

  it('master is ETH and GNO owner', async () => {
    const ETHowner = await eth.owner()
    const GNOowner = await gno.owner()

    expect(master).toBe(ETHowner)
    expect(master).toBe(GNOowner)
  })

  it('all accounts have the right balance', async () => {
    const ETHtotal = await eth.getTotalSupply()
    const masterETHBalance = await eth.balanceOf(master)
    const sellerETHBalance = await eth.balanceOf(seller)
    const buyerETHBalance = await eth.balanceOf(buyer)

    const GNOtotal = await gno.getTotalSupply()
    const masterGNOBalance = await gno.balanceOf(master)
    const sellerGNOBalance = await gno.balanceOf(seller)
    const buyerGNOBalance = await gno.balanceOf(buyer)

    expect(masterETHBalance.add(sellerETHBalance).add(buyerETHBalance)).toEqual(ETHtotal)
    expect(masterGNOBalance.add(sellerGNOBalance).add(buyerGNOBalance)).toEqual(GNOtotal)
  })

  it('seller can submit order to an auction', async () => {
    const amount = 30

    await delayFor('seller')

    // allow the contract to move tokens
    await eth.approve(dxa, amount, { from: seller })

    // currently in auction
    const emptyAuctionVol = await dx.sellVolumeCurrent()
    expect(emptyAuctionVol.toNumber()).toBe(0)

    // seller submits order and returns transaction object
    // that includes logs of events that fired during function execution
    const { logs: [log] } = await dx.postSellOrder(amount, { from: seller, gas: 4712388 })
    const { _auctionIndex, _from, amount: submittedAmount } = log.args

    // submitter is indeed the seller
    expect(_from).toBe(seller)
    // amount is the same
    expect(submittedAmount.toNumber()).toBe(amount)

    // currently in auction
    const filledAuctionVol = await dx.sellVolumeCurrent()

    // auction received the exact sum from the seller
    expect(filledAuctionVol.add(emptyAuctionVol).toNumber()).toEqual(amount)

    // seller is now assigned a balance
    const sellerBalance = await dx.sellerBalances(_auctionIndex, seller)
    expect(sellerBalance.toNumber()).toEqual(amount)
  })

  it('auction is started', async () => {
    const auctionIndex = (await dx.auctionIndex()).toNumber()

    // still on the first auction
    expect(auctionIndex).toBe(1)
    const auctionStart = (await dx.auctionStart()).toNumber()
    let now = getTime()

    // auction hasn't started yet
    expect(auctionStart).toBeGreaterThan(now)
    const timeUntilStart = auctionStart - now

    await withLocalProvider(async () => {
      // move time to start + 1 hour
      increaseTimeBy(timeUntilStart + 3600)
      now = getTime()
    })

    // auction has started
    expect(auctionStart).toBeLessThan(now)

    const getPrice = async (ind: number) => (await dx.getPrice(ind)).map((n: any) => n.toNumber())
    const [num, den] = await getPrice(auctionIndex)
    const [lastNum, lastDen] = await getPrice(auctionIndex - 1)

    // current num/den are derived from last closing price according to formula in DutchExchange.getPrice
    // that is double the last closing price minus function of time passed
    expect(36000 * lastNum).toBe(num)
    expect((now - auctionStart + 18000) * lastDen).toBe(den)
  })


  it('buyer can submit a buy order', async () => {
    const amount = 10

    const auctionIndex = (await dx.auctionIndex()).toNumber()
    const claimed = (await dx.claimedAmounts(auctionIndex, buyer)).toNumber()
    const buyerBalance = (await dx.buyerBalances(auctionIndex, buyer)).toNumber()
    const buyVolume = (await dx.buyVolumes(auctionIndex)).toNumber()

    // nothing yet claimed or bought
    expect(claimed).toBe(0)
    expect(buyerBalance).toBe(0)
    expect(buyVolume).toBe(0)

    await delay(5000)

    await withLocalProvider(async () => {
      // allow DX to withdraw GNO from buyer's account
      await gno.approve(dxa, amount, { from: buyer })

      // submit a buy order for the current auction
      await dx.postBuyOrder(amount, auctionIndex, { from: buyer, gas: 4712388 })
    })

    const buyerBalancesAfter = (await dx.buyerBalances(auctionIndex, buyer)).toNumber()
    const buyVolumeAfter = (await dx.buyVolumes(auctionIndex)).toNumber()

    // buyer's balance increased
    expect(buyerBalance + amount).toBe(buyerBalancesAfter)
    // auction7s buy volume increased
    expect(buyVolumeAfter).toBe(buyVolume + amount)
    // there's only one buyer
    expect(buyerBalancesAfter).toBe(buyVolumeAfter)
  })


  it('buyer can claim the amount bought', async () => {
    const auctionIndex = (await dx.auctionIndex()).toNumber()
    const claimed = (await dx.claimedAmounts(auctionIndex, buyer)).toNumber()
    const buyerBalance = (await dx.buyerBalances(auctionIndex, buyer)).toNumber()
    const buyVolume = (await dx.buyVolumes(auctionIndex)).toNumber()

    // nothing yet claimed
    expect(claimed).toBe(0)
    // something bought
    expect(buyerBalance).toBeGreaterThan(0)
    // by one buyer
    expect(buyVolume).toBe(buyerBalance)

    const [num, den] = (await dx.getPrice(auctionIndex)).map((n: any) => n.toNumber())

    await withLocalProvider(async () => {
      await dx.claimBuyerFunds(auctionIndex, { from: buyer })
      const claimedAmountAfter = (await dx.claimedAmounts(auctionIndex, buyer)).toNumber()
      const buyerBalancesAfter = (await dx.buyerBalances(auctionIndex, buyer)).toNumber()

      // return is a function of price, which itself is a function of time passed
      const expectedReturn = Math.floor(buyerBalancesAfter * den / num) - claimed
      const buyVolumeAfter = (await dx.buyVolumes(auctionIndex)).toNumber()

      // claimed what it could
      expect(expectedReturn + claimed).toBe(claimedAmountAfter)
      // balance is kept as a record, just can't be claimed twice
      expect(buyerBalance).toBe(buyerBalancesAfter)
      expect(buyVolumeAfter).toBe(buyVolume)
    })

  })


  it('buyer can\'t claim more at this time', async () => {
    const auctionIndex = (await dx.auctionIndex()).toNumber()
    try {
      await withLocalProvider(async () => {
        await dx.claimBuyerFunds(auctionIndex, { from: buyer })
      })
      // break test if reached
      expect(true).toBe(false)
    } catch (error) {
      expect(error.message).toContain('revert')
    }
  })

  it('seller can\'t claim before auction ended', async () => {
    await delayFor('seller', 10)
    const auctionIndex = (await dx.auctionIndex()).toNumber()
    try {
      // trying to claim from the ongoing auction
      await dx.claimSellerFunds(auctionIndex, { from: seller })
      // break test if reached
      expect(true).toBe(false)
    } catch (error) {
      expect(error.message).toContain('revert')
    }
  })


  it('auction ends with time', async () => {
    const auctionIndex = (await dx.auctionIndex()).toNumber()

    const buyVolume = (await dx.buyVolumes(auctionIndex)).toNumber()
    const sellVolume = (await dx.sellVolumeCurrent()).toNumber()
    const auctionStart = (await dx.auctionStart()).toNumber()

    // Auction clears when sellVolume * price = buyVolume
    // Since price is a function of time, so we have to rearrange the equation for time, which gives
    const timeWhenAuctionClears = Math.ceil(72000 * sellVolume / buyVolume - 18000 + auctionStart)

    await withLocalProvider(async () => {
      setTime(timeWhenAuctionClears)
      const buyerBalance = (await dx.buyerBalances(auctionIndex, buyer)).toNumber()
      const amount = 1
      await gno.approve(dxa, amount, { from: buyer })
      await dx.postBuyOrder(amount, auctionIndex, { from: buyer })
      const buyVolumeAfter = (await dx.buyVolumes(auctionIndex)).toNumber()
      const buyerBalanceAfter = (await dx.buyerBalances(auctionIndex, buyer)).toNumber()

      // no changes, as the auction has ended
      expect(buyVolume).toBe(buyVolumeAfter)
      expect(buyerBalance).toBe(buyerBalanceAfter)

      const newAuctionIndex = (await dx.auctionIndex()).toNumber()

      expect(newAuctionIndex).toBe(auctionIndex + 1)
    })


    await delay(5000)
  })

  it('next auction is scheduled', async () => {
    const auctionIndex = (await dx.auctionIndex()).toNumber()

    // still on the first auction
    expect(auctionIndex).toBe(2)
    const auctionStart = (await dx.auctionStart()).toNumber()
    const now = getTime()

    // next auction hasn't started yet
    expect(auctionStart).toBeGreaterThan(now)
    // it will, in 6 hours
    expect(auctionStart).toBeLessThanOrEqual(now + 21600)
  })

  it('buyer can claim the remainder of the funds', async () => {
    const lastAuctionIndex = (await dx.auctionIndex()).toNumber() - 1
    let claimed = (await dx.claimedAmounts(lastAuctionIndex, buyer)).toNumber()
    const buyerBalance = (await dx.buyerBalances(lastAuctionIndex, buyer)).toNumber()
    const buyVolume = (await dx.buyVolumes(lastAuctionIndex)).toNumber()

    // some funds were claimed
    expect(claimed).toBeGreaterThan(0)
    // there's non-zero buyers' balance
    expect(buyerBalance).toBeGreaterThan(0)
    // that belongs to one buyer
    expect(buyVolume).toBe(buyerBalance)
    // there are still funds to be claimed
    expect(claimed).toBeLessThan(buyerBalance)

    await withLocalProvider(async () => {
      // claim what can be claimed
      await dx.claimBuyerFunds(lastAuctionIndex, { from: buyer })
      claimed = (await dx.claimedAmounts(lastAuctionIndex, buyer)).toNumber()

      const [num, den] = (await dx.getPrice(lastAuctionIndex)).map((n: any) => n.toNumber())
      // assuming all buyerBalance got converted toETH at the closing price
      const balance2ETH = Math.floor(buyerBalance * den / num)

      // everything was claimed
      expect(claimed).toBe(balance2ETH)
    })

  })


  it('seller can claim funds', async () => {
    await delayFor('seller')

    const lastAuctionIndex = (await dx.auctionIndex()).toNumber() - 1
    let sellerBalance = (await dx.sellerBalances(lastAuctionIndex, seller)).toNumber()
    const [num, den] = (await dx.getPrice(lastAuctionIndex)).map((n: any) => n.toNumber())

    // transaction receipt includes amount returned
    const claimReceipt = await dx.claimSellerFunds(lastAuctionIndex, { from: seller })

    const returned = claimReceipt.logs[0].args._returned.toNumber()


    // closing price * balance
    const expectedReturn = Math.floor(sellerBalance * num / den)
    expect(expectedReturn).toBe(returned)

    sellerBalance = (await dx.sellerBalances(lastAuctionIndex, seller)).toNumber()
    // balance is drained
    expect(sellerBalance).toBe(0)
  })


  it('seller has some GNO tokens, buyer has some ETH', async () => {
    const buyerETHBalance = (await eth.balanceOf(buyer)).toNumber()
    const sellerGNOBalance = (await gno.balanceOf(seller)).toNumber()
    const buyerGNOBalance = (await gno.balanceOf(buyer)).toNumber()
    const sellerETHBalance = (await eth.balanceOf(seller)).toNumber()

    const masterGNOBalance = (await gno.balanceOf(master)).toNumber()
    const masterETHBalance = (await eth.balanceOf(master)).toNumber()

    const totalETH = (await eth.getTotalSupply()).toNumber()
    const totalGNO = (await gno.getTotalSupply()).toNumber()

    const sellerStartETH = totalETH - masterETHBalance
    const buyerStartGNO = totalGNO - masterGNOBalance

    // seller received GNO
    expect(sellerGNOBalance).toBeGreaterThan(0)
    // buyer received ETH
    expect(buyerETHBalance).toBeGreaterThan(0)

    // buyer received all ETH seller sent to aucion
    expect(sellerStartETH - sellerETHBalance).toBe(buyerETHBalance)
    // seller received all GNO buyer sent to auction
    const buyerGNODiff = buyerStartGNO - buyerGNOBalance
    expect(sellerGNOBalance).toBeLessThanOrEqual(buyerGNODiff)
    expect(sellerGNOBalance).toBeGreaterThanOrEqual(buyerGNODiff - 1)
  })

  async function checkBalances() {
    // don't spam browser console
    if (currentProvider) return

    const buyerETHBalance = (await eth.balanceOf(buyer)).toNumber()
    const sellerGNOBalance = (await gno.balanceOf(seller)).toNumber()
    const masterGNOBalance = (await gno.balanceOf(master)).toNumber()
    const masterETHBalance = (await eth.balanceOf(master)).toNumber()
    const buyerGNOBalance = (await gno.balanceOf(buyer)).toNumber()
    const sellerETHBalance = (await eth.balanceOf(seller)).toNumber()
    const totalETH = (await eth.getTotalSupply()).toNumber()
    const totalGNO = (await gno.getTotalSupply()).toNumber()

    console.log()
    console.log('  ETH\tGNO')
    console.log(`S ${sellerETHBalance}\t${sellerGNOBalance}`)
    console.log(`B ${buyerETHBalance}\t${buyerGNOBalance}`)
    console.log(`M ${masterETHBalance}\t${masterGNOBalance}`)
    console.log('__________________________')
    console.log(`= ${totalETH}\t${totalGNO}`)
  }

  function watchAllEventsFor(contract: any, name: string) {
    const addr2acc = Object.entries(accs).reduce((accum, [name, addr]) => (accum[addr] = name, accum), {})
    contract.allEvents((err: Error, log: any) => {
      if (err) {
        console.error(err)
        return
      }
      const { args, event } = log
      for (const arg of Object.keys(args)) {
        const val = args[arg]
        if (val.toNumber) {
          // convert BigNumbers
          args[arg] = val.toNumber()
        } else if (typeof val === 'string' && /^0x\w{40}$/.test(val)) {
          args[arg] = addr2acc[val] || val
        }
      }

      console.log(`${name}::${event}`, args)
    })
  }

})
