import { connect } from 'react-redux'
import TopAuctions from 'components/TopAuctions'
import { selectTokenPairAndSetClosingPrice } from 'actions'
import { State } from 'types'
import { selectTop5Pairs } from 'selectors/ratioPairs'

const mapStateToProps = (state: State) => ({
  pairs: selectTop5Pairs(state),
})

export default connect(mapStateToProps, { selectTokenPairAndSetClosingPrice })(TopAuctions)
