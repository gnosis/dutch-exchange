import { connect, Dispatch } from 'react-redux'
import WalletPanel, { WalletPanelProps } from 'components/WalletPanel'
// import { State } from 'types'
import { submitSellOrder } from 'actions'

const mapStateToProps = () => ({
  // TODO: get address from store, populated by contract addresses
  auctionAddress: '0x03494929349594',
})

const mapDispatchToProps = (dispatch: Dispatch<any>) => ({
  
  submitOrder(proceedTo: string, modalName: string) {
    console.log('Submitting order')

    dispatch(submitSellOrder(proceedTo, modalName))
  },
})

const mergeProps = (
  stateProps: Partial<WalletPanelProps>,
  dispatchProps: { submitOrder: Function },
  ownProps: Partial<WalletPanelProps>,
) => ({
  ...stateProps,
  submitOrder(e: MouseEvent) {
    // don't go to /auction/0x03494929349594 just yet
    e.preventDefault()

    dispatchProps.submitOrder(`/auction/${stateProps.auctionAddress}`, 'TransactionModal')
  },
  ...ownProps,
})


export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(WalletPanel)
