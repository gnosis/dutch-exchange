// import { WALLET_PROVIDER } from 'globals'
// import { WalletProvider } from '../types'
import Web3 from 'web3'
// @ts-ignore
import TransportU2F from '@ledgerhq/hw-transport-u2f'
// @ts-ignore
import createLedgerSubprovider from '@ledgerhq/web3-subprovider'
// @ts-ignore
import ProviderEngine from 'web3-provider-engine'
// @ts-ignore
import FetchSubprovider from 'web3-provider-engine/subproviders/fetch'
// @ts-ignore
import RpcSubprovider from 'web3-provider-engine/subproviders/rpc.js'
// @ts-ignore
import Eth from '@ledgerhq/hw-app-eth'

import { getTime } from 'api'

import { promisify } from 'utils'

import { Balance } from 'types'
import { WalletProvider } from 'integrations/types'

import { ETHEREUM_NETWORKS, networkById, network2RPCURL } from 'globals'

const rpcUrl = network2RPCURL.RINKEBY

export const getAccount = async (provider: WalletProvider): Promise<Account> => {
  const [account] = await promisify(provider.web3.eth.getAccounts, provider.web3.eth)()

  return account
}

export const getNetwork = async (provider: WalletProvider): Promise<ETHEREUM_NETWORKS> => {
  const networkId = await promisify(provider.web3.version.getNetwork, provider.web3.version)()

  return networkById[networkId] || ETHEREUM_NETWORKS.UNKNOWN
}

export const getBalance = async (provider: WalletProvider, account: Account): Promise<Balance> => {
  const balance = await promisify(provider.web3.eth.getBalance, provider.web3.eth)(account)

  return provider.web3.fromWei(balance, 'ether').toString()
}

// get Provider state
export const grabProviderState = async (provider: WalletProvider) => {
  const [account, network, timestamp] = await Promise.all([
    getAccount(provider),
    getNetwork(provider),
    getTime(),
  ])

  const balance = account && await getBalance(provider, account)
  const available = provider.walletAvailable
  const unlocked = !!(available && account)
  const newState = { account, network, balance, available, unlocked, timestamp }

  return newState
}

const Providers = {
  // runtime providers (METAMASK/MIST/PARITY)
  INJECTED_WALLET: {
    priority: 90,
    providerType: 'INJECTED_WALLET',

    get providerName() {
      if (!this.checkAvailability()) return null

      if (window.web3.currentProvider.isMetaMask) return 'METAMASK'
      if ((window as any).mist && window.web3.currentProvider.constructor.name === 'EthereumProvider') return 'MIST'

      return window.web3.currentProvider.constructor.name
    },

    checkAvailability() {
      if (this.web3) return this.walletAvailable = true
      return this.walletAvailable = typeof window.web3 !== 'undefined' && window.web3.currentProvider.constructor
    },

    initialize() {
      if (!this.checkAvailability()) return
      this.web3 = new Web3(window.web3.currentProvider)
      this.state = {}

      return this.web3
    },
  },
  // Hardware Provider - LEDGER
  LEDGER: {
    priority: 80,
    providerName: 'LEDGER',
    providerType: 'HARDWARE_WALLET',

    async checkAvailability() {
      if (this.ledger) return this.walletAvailable = true
      // return this.walletAvailable = !!(this.web3) && await promisify(this.ledger.getAccounts, this.ledger)
      return this.walletAvailable = true
    },

    async initialize() {
      try {
        const device = await (new Eth(await TransportU2F.create(1500, 5000))).getAppConfiguration()

        const engine = new ProviderEngine()
        const getTransport = async () => TransportU2F.create(1500, 5000)
        const ledger = createLedgerSubprovider(getTransport, {
          networkId: '4',
          accountsLength: 5,
        })

        // set ETH App on ledger to provider object
        this.device = device

        engine.addProvider(ledger)
        engine.addProvider(new RpcSubprovider({ rpcUrl }))
        engine.start()

        this.web3 = new Web3(engine)
        this.state = {}

        return this.web3
      } catch (error) {
        console.error(error)
        this.walletAvailable = false
        throw new Error(error)
      }
    },
  },
}

export default Providers
