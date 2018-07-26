import { connect } from 'react-redux'

import OrderPanel from 'components/OrderPanel'
import { RedirectHomeIfNoAccountHOC } from 'components/RedirectIf'

import { pushAndMoveToElement } from 'actions'
import { getSellTokenBalance } from 'selectors'

import { State, BigNumber } from 'types'
import { EMPTY_TOKEN } from 'globals'

const isTokenApproved = ({ approvedTokens, tokenPair: { sell = EMPTY_TOKEN, buy = EMPTY_TOKEN } }: State) =>
  (approvedTokens.has(sell.address) && approvedTokens.has(buy.address)) || (sell.isETH || buy.isETH)

const mapStateToProps = (state: State) => {
  const { tokenPair: { sell = EMPTY_TOKEN, buy = EMPTY_TOKEN, sellAmount }, tokenOverlay, blockchain } = state
  const sellTokenBalance = getSellTokenBalance(state)
  // const { sellAmount } = state.tokenPair
  const maxSellAmount: BigNumber = sellTokenBalance.div(10 ** sell.decimals)

  const validTokens = sell !== EMPTY_TOKEN && buy !== EMPTY_TOKEN

  return {
    sellTokenSymbol: sell.symbol || sell.name || sell.address,
    buyTokenSymbol: buy.symbol || buy.name || buy.address,
    validSellAmount: validTokens && +sellAmount > 0 && maxSellAmount.greaterThanOrEqualTo(sellAmount),
    overlayOpen: tokenOverlay.open,
    generatesMGN: isTokenApproved(state),
    currentAccount: blockchain.currentAccount,
  }
}

export default connect(mapStateToProps, { pushAndMoveToElement })(RedirectHomeIfNoAccountHOC(OrderPanel))
