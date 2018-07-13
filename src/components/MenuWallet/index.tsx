import React from 'react'

import Loader from 'components/Loader'

import { Account, BigNumber, TokenBalances } from 'types'
import { FIXED_DECIMALS } from 'globals'

export interface WalletProps {
  account: Account,
  addressToSymbolDecimal: {},
  balance: BigNumber,
  tokens: TokenBalances,
}

// TODO: use below to map addressToSymbolMap[token] = token name or symbol
/* addressToSymbolMap: {
  0x1234: 'ETH'
} */

export const MenuWallet: React.SFC<WalletProps> = ({ account, addressToSymbolDecimal, balance, tokens }) => (
  <div className="menuWallet">
    <span>
      <code>{`${account ? account.slice(0, 10) : 'No Wallet Detected'}...`}</code>
      <small>{balance != null ? balance.toNumber().toFixed(FIXED_DECIMALS) : '0'} ETH</small>
    </span>
    {account && <div>
      <Loader
      hasData={Object.keys(addressToSymbolDecimal).length > 0}
      message="Enable wallet"
      svgHeight={35}
      reSize={0.25}
      render={() =>
        <table>
          <thead>
            <tr>
              <th>Token</th>
              <th>Balance</th>
            </tr>
          </thead>
          <tbody>
            {Object.keys(tokens).map((addressKey: any) => {
              if (!addressToSymbolDecimal[addressKey]) return null
              const { name, decimals } = addressToSymbolDecimal[addressKey]
              return (
                tokens[addressKey].gt(0) &&
                <tr key={addressKey}>
                  <td>{name || 'Unknown'}</td>
                  <td>{(tokens[addressKey]).div(10 ** decimals).toFixed(FIXED_DECIMALS)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      }/>
    </div>}
  </div>
)

export default MenuWallet
