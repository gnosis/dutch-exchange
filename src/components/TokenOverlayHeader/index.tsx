import React from 'react'

interface TokenOverlayHeaderProps {
  onChange(e: React.ChangeEvent<HTMLInputElement>): void,
  closeOverlay(): void,
}

const TokenOverlayHeader: React.SFC<TokenOverlayHeaderProps> = ({ onChange, closeOverlay }) => (
  <span className="tokenOverlayHeader">
    <input
      className="tokenSearch"
      type="text"
      name="tokenSearch"
      placeholder="Find token by name or code"
      onChange={onChange}
      autoFocus
    />
    <button className="buttonExit" onClick={closeOverlay} />
  </span>
)

export default TokenOverlayHeader
