import React, { Component } from 'react'
import { handleKeyDown } from 'utils/helpers'

interface HamburgerProps {}

interface HamburgerState {
  isOpen: boolean
}

export default class Hamburger extends Component<HamburgerProps, HamburgerState> {

  state = {
    isOpen: false,
  }

  handleClick = () => this.setState({
    isOpen: !this.state.isOpen,
  })

  render() {
    const { isOpen } = this.state

    return (
      <div tabIndex={-1} onKeyDown={(e) => handleKeyDown(e, this.handleClick, 'Escape')}>
        <button
          className="hamburger"
          onClick={this.handleClick}></button>
        <nav className={isOpen ? 'show' : null}>
          <button
            className="buttonExit"
            onClick={this.handleClick}>
          </button>
          <a href="#">How it works</a>
          <a href="#">Screencast</a>
          <a href="#">Tokens </a>
          <a href="#">Fees</a>
          <a href="#">FAQ</a>
          <a href="#">Technical </a>
          <a href="#">Downtime</a>
          <a href="#">Help</a>
        </nav>
      </div>
    )
  }
}
