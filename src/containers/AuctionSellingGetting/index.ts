import { connect } from 'react-redux'
import { setSellTokenAmount } from 'actions'
import { getSellTokenBalance } from 'selectors'
import { FIXED_DECIMALS } from 'globals'
import { EMPTY_TOKEN } from 'tokens'

import { State } from 'types'
import AuctionSellingGetting, { AuctionSellingGettingProps } from 'components/AuctionSellingGetting'

const mapState = (state: State) => {
  const { network } = state.blockchain
  // TODO: always have some price for every pair in RatioPairs
  const { sell = EMPTY_TOKEN, buy = EMPTY_TOKEN, lastPrice: price } = state.tokenPair
  const sellTokenBalance = getSellTokenBalance(state)
  const { sellAmount } = state.tokenPair
  const maxSellAmount = sellTokenBalance.div(10 ** sell.decimals)

  return ({
    // TODO: change prop to sellTokenBalance
    maxSellAmount,
    sellTokenSymbol: sell.symbol || sell.name || sell.address,
    sellTokenAddress: sell.address,
    buyTokenSymbol: buy.symbol || buy.name || buy.address,
    sellAmount,
    // TODO: use BN.mult()
    buyAmount: (+sellAmount * +price).toFixed(FIXED_DECIMALS),
    network,
  }) as AuctionSellingGettingProps
}

export default connect<
  AuctionSellingGettingProps, {}, Pick<AuctionSellingGettingProps, 'onValidityChange'>
>(mapState, { setSellTokenAmount })(AuctionSellingGetting)
