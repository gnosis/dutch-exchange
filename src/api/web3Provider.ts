import { ProviderInterface } from './types'
import { windowLoaded, promisify } from './utils'
import { Account } from 'types'
import Web3 from 'web3'

const getProvider = () => {
  if (typeof window !== 'undefined' && window.web3) {
    return window.web3.currentProvider
  }

  return new Web3.providers.HttpProvider('http://localhost:8545')
}

const setupWeb3 = async () => {
  await windowLoaded

  return new Web3(getProvider())
}

export const promisedWeb3 = init()

async function init(): Promise<ProviderInterface> {
  const web3 = await setupWeb3()

  const getAccounts = promisify(web3.eth.getAccounts, web3.eth)
  const getBalance = promisify(web3.eth.getBalance, web3.eth)

  const getCurrentAccount = async () => {
    const [account] = await getAccounts()

    return account
  }

  const getETHBalance = async (account: Account, inETH?: boolean) => {
    const wei = await getBalance(account)

    return inETH ? web3.fromWei(wei, 'ether') : wei
  }

  const getNetwork = promisify(web3.version.getNetwork, web3.version)

  const isConnected = web3.isConnected.bind(web3)

  const setProvider = web3.setProvider.bind(web3)

  const resetProvider = () => setProvider(getProvider())

  const getTimestamp = async (block = 'latest') => {
    const blockData = await promisify(web3.eth.getBlock, web3.eth)(block)

    return blockData.timestamp
  }

  return {
    getCurrentAccount,
    getAccounts,
    getETHBalance,
    getNetwork,
    isConnected,
    get currentProvider() {
      return web3.currentProvider
    },
    web3,
    setProvider,
    resetProvider,
    getTimestamp,
  }
}
