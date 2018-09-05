import { connect } from 'react-redux'
import AuctionStatus from 'components/AuctionStatus'

import { toBigNumber } from 'web3/lib/utils/utils.js'

import { State } from 'types'
import { AuctionStatus as Status } from 'globals'

const mapStateToProps = ({ tokenPair: { sell, buy } }: State) => ({
  sellToken: sell,
  buyToken: buy,
  // TODO: get buyAmount based on what can be claimed, i.e. at the end of auction
  buyAmount: toBigNumber(2.5520300),
  // TODO: make sure time and status are populated in the store by DutchX
  timeLeft: 73414,
  status: Status.INIT,
})

export default connect(mapStateToProps)(AuctionStatus)
