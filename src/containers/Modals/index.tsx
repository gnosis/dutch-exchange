import React, { Component } from 'react'

import { connect } from 'react-redux'
import { openModal, closeModal } from 'actions/modal'

import { history } from 'index'

import { State } from 'types'  

import * as Modals from 'components/Modals'

export interface ModalContainerProps {
  children: any;
  isOpen: boolean;
  modalName: string;
  modalProps: any;
  openModal(props: any): any,
  closeModal(): any,
  activeProvider: any
}

const backdropActive: any = {
  zIndex: 100,
  position: 'fixed',
  top: 0, left: 0, right: 0, bottom: 0,

  backgroundColor: '#00000091',
}

const blurred: any = {
  filter: 'blur(4px)',

  pointerEvents: 'none', userSelect: 'none',
}

const Aux = (props: any) => props.children

class ModalContainer extends Component<ModalContainerProps> {

  componentWillReceiveProps(nextProps: any) {
    const { isOpen } = this.props
    const unblock = history.block(`Are you sure you want to leave this page? You have not yet confirmed or rejected your sell order.` as any)

    // If MODAL is OPEN block movement
    if (nextProps.isOpen !== isOpen) {
      unblock
    }

    // Unblock Movement
    if (!nextProps.isOpen) {
      // calls return fn from unblock
      unblock()
    }

    return false
  }

  renderSpecificModal = (): null | Error | JSX.Element => {
    const { modalName, isOpen, ...rest } = this.props
    let Modal

    if (isOpen) {
      Modal = Modals[modalName]

      if (!modalName) {
        return new Error('No correct modal')
      }

      return (
        <div style={backdropActive}>
          <Modal {...rest}/>
        </div>
      )
    }
    return null
  }
  
  render() {
    const { children, isOpen } = this.props

    return (
      <Aux>
        {isOpen ? <div style={blurred}>{children}</div> : children}
        {this.renderSpecificModal()}
      </Aux>
    )
  }
}

const mapState = ({
  blockchain,
  modal: { 
    modalName, 
    modalProps, 
    isOpen, 
  }, 
}: State) => ({
  modalName,
  modalProps,
  isOpen,
  activeProvider: blockchain.activeProvider,
})

export default connect(mapState, { openModal, closeModal })(ModalContainer)
