import { WALLET_PROVIDER } from 'integrations/constants'
import Web3 from 'web3'

export const getDutchXOptions = (provider: any) => {
  console.log('FIRING getDutchXOptions')
  const opts: any = {}

  if (provider && provider.name === WALLET_PROVIDER.METAMASK) {
    // Inject window.web3
    opts.ethereum = window.web3.currentProvider
  } else if (provider && provider === WALLET_PROVIDER.PARITY) {
    // Inject window.web3
    opts.ethereum = window.web3.currentProvider
  } else {
    // Default remote node
    opts.ethereum = new Web3(
      new Web3.providers.HttpProvider(`${process.env.ETHEREUM_URL}`),
    ).currentProvider
  }

  return opts
}

export const code2Network = (code: '1' | '4' | '42') => {
  switch (code) {
    case '1':
      return 'MAIN'

    case '4':
      return 'RINKEBY'

    case '42':
      return 'KOVAN'

    default:
      return 'UNKNOWN'
  }
}

export const timeoutCondition = (timeout: any, rejectReason: any) => new Promise((_, reject) => {
  setTimeout(() => {
    reject(rejectReason)
  }, timeout)
})

export const handleKeyDown = ({ key }: { key: string }, fn: Function, codeCheck: string = 'Escape') => {
  if (key === codeCheck) return fn()
  return
}
