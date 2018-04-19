import { promisedContractsMap } from './contracts'
import { DutchExchange, Index, Filter, ErrorFirstCallback, DutchExchangeEvents } from './types'
import { TokenPair, Account, Balance, TokenCode } from 'types'

export const promisedDutchX = init()

// TODO: get correct global addresses
// or create a json during migration
type T2A = Partial<{[P in TokenCode]: string}>


async function init(): Promise<DutchExchange> {
  const { DutchExchange: dx, ...tokens } = await promisedContractsMap

  const token2Address = Object.keys(tokens).reduce((acc, key) => {
    const contr = tokens[key]
    acc[key.replace('Token', '')] = contr.address
    return acc
  }, {}) as T2A

  const getTokenAddress = (code: TokenCode) => {
    const address = token2Address[code]

    if (!address) throw new Error(`No known address for ${code} token`)

    return address
  }

  const getTokenPairAddresses = ({ sell, buy }: TokenPair): [Account, Account] => {
    const sellAddress = getTokenAddress(sell)
    const buyAddress = getTokenAddress(buy)

    return [sellAddress, buyAddress]
  }

  const getLatestAuctionIndex = (pair: TokenPair) => {
    const [t1, t2] = getTokenPairAddresses(pair)
    return dx.getAuctionIndex.call(t1, t2)
  }

  const getAuctionStart = (pair: TokenPair) => {
    const [t1, t2] = getTokenPairAddresses(pair)
    return dx.getAuctionStart.call(t1, t2)
  }

  const getClosingPrice = (pair: TokenPair, index: Index) => {
    const [t1, t2] = getTokenPairAddresses(pair)

    return dx.closingPrices.call(t1, t2, index)
  }

  const getPrice = (pair: TokenPair, index: Index) => {
    const [t1, t2] = getTokenPairAddresses(pair)

    return dx.getCurrentAuctionPrice.call(t1, t2, index)
  }

  const getSellVolumesCurrent = (pair: TokenPair) => {
    const [t1, t2] = getTokenPairAddresses(pair)

    return dx.sellVolumesCurrent.call(t1, t2)
  }

  const getSellVolumesNext = (pair: TokenPair) => {
    const [t1, t2] = getTokenPairAddresses(pair)

    return dx.sellVolumesNext.call(t1, t2)
  }

  const getBuyVolumes = (pair: TokenPair) => {
    const [t1, t2] = getTokenPairAddresses(pair)

    return dx.buyVolumes.call(t1, t2)
  }

  const getExtraTokens = (pair: TokenPair) => {
    const [t1, t2] = getTokenPairAddresses(pair)

    return dx.extraTokens.call(t1, t2)
  }

  const getSellerBalances = (pair: TokenPair, index: Index, account: Account) => {
    const [t1, t2] = getTokenPairAddresses(pair)

    return dx.sellerBalances.call(t1, t2, index, account)
  }

  const getBuyerBalances = (pair: TokenPair, index: Index, account: Account) => {
    const [t1, t2] = getTokenPairAddresses(pair)

    return dx.buyerBalances.call(t1, t2, index, account)
  }

  const getClaimedAmounts = (pair: TokenPair, index: Index, account: Account) => {
    const [t1, t2] = getTokenPairAddresses(pair)

    return dx.claimedAmounts.call(t1, t2, index, account)
  }

  const postSellOrder = (
    pair: TokenPair,
    amount: Balance,
    index: Index,
    account: Account,
  ) => {
    const [t1, t2] = getTokenPairAddresses(pair)

    return dx.postSellOrder(t1, t2, index, amount, { from: account, gas: 4712388 })
  }

  postSellOrder.call = (
    pair: TokenPair,
    amount: Balance,
    index: Index,
    account: Account,
  ) => {
    const [t1, t2] = getTokenPairAddresses(pair)

    return dx.postSellOrder.call(t1, t2, index, amount, { from: account })
  }

  const postBuyOrder = (
    pair: TokenPair,
    amount: Balance,
    index: Index,
    account: Account,
  ) => {
    const [t1, t2] = getTokenPairAddresses(pair)

    return dx.postBuyOrder(t1, t2, index, amount, { from: account, gas: 4712388 })
  }

  postBuyOrder.call = (
    pair: TokenPair,
    amount: Balance,
    index: Index,
    account: Account,
  ) => {
    const [t1, t2] = getTokenPairAddresses(pair)

    return dx.postBuyOrder.call(t1, t2, index, amount, { from: account, gas: 4712388 })
  }

  const claimSellerFunds = (pair: TokenPair, index: Index, account: Account) => {
    const [t1, t2] = getTokenPairAddresses(pair)

    return dx.claimSellerFunds(t1, t2, account, index, { from: account })
  }

  claimSellerFunds.call = (pair: TokenPair, index: Index, account: Account) => {
    const [t1, t2] = getTokenPairAddresses(pair)

    return dx.claimSellerFunds.call(t1, t2, account, index)
  }

  claimSellerFunds.call = (pair: TokenPair, index: Index, account: Account) => {
    const [t1, t2] = getTokenPairAddresses(pair)

    return dx.claimSellerFunds.call(t1, t2, account, index)
  }

  const claimBuyerFunds = (pair: TokenPair, index: Index, account: Account) => {
    const [t1, t2] = getTokenPairAddresses(pair)

    return dx.claimBuyerFunds(t1, t2, account, index, { from: account })
  }

  const deposit = (code: TokenCode, amount: Balance, account: Account) => {
    const token = getTokenAddress(code)

    return dx.deposit(token, amount, { from: account })
  }

  const withdraw = (code: TokenCode, amount: Balance, account: Account) => {
    const token = getTokenAddress(code)

    return dx.withdraw(token, amount, { from: account })
  }

  const depositAndSell = (pair: TokenPair, amount: Balance, account: Account) => {
    const [t1, t2] = getTokenPairAddresses(pair)

    return dx.depositAndSell(t1, t2, amount, { from: account })
  }

  depositAndSell.call = (
    pair: TokenPair,
    amount: Balance,
  ) => {
    const [t1, t2] = getTokenPairAddresses(pair)

    return dx.depositAndSell.call(t1, t2, amount)
  }

  const claimAndWithdraw = (pair: TokenPair, index: Index, amount: Balance, account: Account) => {
    const [t1, t2] = getTokenPairAddresses(pair)

    return dx.claimAndWithdraw(t1, t2, account, index, amount, { from: account })
  }

  const isTokenApproved = (code: TokenCode) => dx.approvedTokens(getTokenAddress(code))

  const getBalance = (code: TokenCode, account: Account) => {
    const token = getTokenAddress(code)

    return dx.balances.call(token, account)
  }

  const getRunningTokenPairs = (tokenList: Account[]) => dx.getRunningTokenPairs.call(tokenList)

  const getSellerBalancesOfCurrentAuctions = (
    sellTokenArr: Account[],
    buyTokenArr: Account[],
    account: Account,
  ) => dx.getSellerBalancesOfCurrentAuctions.call(sellTokenArr, buyTokenArr, account)

  const getIndicesWithClaimableTokensForSellers = (
    sellToken: Account,
    buyToken: Account,
    account: Account,
    lastNAuctions: number = 0,
  ) => dx.getIndicesWithClaimableTokensForSellers.call(sellToken, buyToken, account, lastNAuctions)

  const getFeeRatio = (account: Account) => dx.getFeeRatio.call(account)

  const event: DutchExchange['event'] = (
    eventName: DutchExchangeEvents,
    valueFilter: object | void,
    filter: Filter,
    cb?: ErrorFirstCallback,
  ): any => {
    const event = dx[eventName]

    if (typeof event !== 'function') throw new Error(`No event with ${eventName} name found on DutchExchange contract`)

    return event(valueFilter, filter, cb)
  }

  const allEvents: DutchExchange['allEvents'] = dx.allEvents.bind(dx)

  return {
    get address() {
      return dx.address
    },
    isTokenApproved,
    getBalance,
    getLatestAuctionIndex,
    getAuctionStart,
    getClosingPrice,
    getPrice,
    getSellVolumesCurrent,
    getSellVolumesNext,
    getBuyVolumes,
    getExtraTokens,
    getSellerBalances,
    getBuyerBalances,
    getRunningTokenPairs,
    getSellerBalancesOfCurrentAuctions,
    getIndicesWithClaimableTokensForSellers,
    getClaimedAmounts,
    getFeeRatio,
    postSellOrder,
    postBuyOrder,
    claimSellerFunds,
    claimBuyerFunds,
    deposit,
    withdraw,
    depositAndSell,
    claimAndWithdraw,
    event,
    allEvents,
  }
}
