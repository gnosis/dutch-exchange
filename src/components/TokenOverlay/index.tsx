import React, { Component } from 'react'
import { createSelector } from 'reselect'

import TokenOverlayHeader from '../TokenOverlayHeader'
import TokenList from '../TokenList'

import { code2tokenMap } from 'globals'
import { DefaultTokenObject, TokenBalances, TokenMod, AccountsSet, AvailableAuctions, TokenPair } from 'types'
import Loader from '../Loader'

const getTokenModAndAddress = createSelector(
  (_: TokenOverlayState, { mod }: TokenOverlayProps) => mod,
  (_, { tokenPair }) => tokenPair,
  (mod, tokenPair) => ({
    mod,
    // token we clicked on
    oldAddress: tokenPair[mod] && tokenPair[mod].address,
    // opposite in a pair
    oppositeAddress: tokenPair[mod === 'sell' ? 'buy' : 'sell'] && tokenPair[mod === 'sell' ? 'buy' : 'sell'].address,
  })
)

const prefilterByAvailableAuctions = createSelector(
  (_: TokenOverlayState, props: TokenOverlayProps) => props.tokenList,
  (_, props) => props.availableAuctions,
  getTokenModAndAddress,
  (tokenList, availableAuctions, { mod, oldAddress, oppositeAddress }) => {
    console.log('{ mod, selectingAddress, oppositeAddress }: ', { mod, oldAddress, oppositeAddress });
    // if opposite token is an empty placeholder, show every token
    if (!oppositeAddress) return tokenList
    return tokenList.filter(token => {
      // don't show opposite token as it's already selected for the other position
      if (token.address === oppositeAddress) return false
      let pairStr
      // if selecting for sell position, check direct pairs with opposite token
      if (mod === 'sell') pairStr = `${oppositeAddress}-${token.address}`
      // otherwise opposite pairs
      else if (mod === 'buy') pairStr = `${token.address}-${oppositeAddress}`
      else throw new Error(`tokenPair.mod isn't set, ${mod}`)
      
      // show only token pairs that would actually allow a sell order
      return availableAuctions.has(pairStr)
    })
  }
)

const filterTokens = createSelector(
  (state: TokenOverlayState, _: TokenOverlayProps) => state.filter.toUpperCase(),
  prefilterByAvailableAuctions,
  (filter, tokens) => (filter ?
    tokens.filter(({
      symbol = '',
      name = code2tokenMap[symbol] || '',
    }) => symbol.includes(filter) || name.includes(filter)) :
    tokens
  ),
)

const dataLengthCheck = (o1: {} | any[], o2: {} | any[]) => {
  const o1kl = Array.isArray(o1) ? o1.length : Object.keys(o1).length,
		    o2kl = Array.isArray(o2) ? o2.length : Object.keys(o2).length

	 return o1kl <= o2kl
}

export interface TokenOverlayProps {
  tokenList: DefaultTokenObject[],
  tokenPair: TokenPair,
  closeOverlay(): any,
  selectTokenPairAndRatioPair(props: any): any,
  tokenBalances: TokenBalances,
  open: boolean,
  mod: TokenMod,
  approvedTokens: AccountsSet,
  availableAuctions: AvailableAuctions,
}

interface TokenOverlayState {
  filter: string
}

class TokenOverlay extends Component<TokenOverlayProps, TokenOverlayState> {
  state = {
    filter: '',
  }

  changeFilter = (e: React.ChangeEvent<HTMLInputElement>) => this.setState({
    filter: e.target.value,
  })

  selectTokenAndCloseOverlay: TokenOverlayProps['selectTokenPairAndRatioPair'] = (tokenProps) => {
    console.log('tokenProps: ', tokenProps)
    const { selectTokenPairAndRatioPair, mod } = this.props

    selectTokenPairAndRatioPair({ token: tokenProps, mod })
  }

  closeOverlay = () => {
    this.props.closeOverlay()
    this.setState({ filter: '' })
  }


  render() {
    if (!this.props.open) return null

    const { tokenBalances, approvedTokens } = this.props
    const { filter } = this.state

    const filteredTokens = filterTokens(this.state, this.props)

    return (
      <div className="tokenOverlay">
        <TokenOverlayHeader
          onChange={this.changeFilter}
          closeOverlay={this.closeOverlay}
          value={filter}
        />
        <Loader
          hasData={dataLengthCheck(filteredTokens, tokenBalances)}
          message="Loading token balances - please wait"
          reSize={0.72}
          render={() =>
          <TokenList
            tokens={filteredTokens}
            balances={tokenBalances}
            onTokenClick={this.selectTokenAndCloseOverlay}
            approvedTokens={approvedTokens}
          />
        } />
      </div>
    )
  }
}

export default TokenOverlay
