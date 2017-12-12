import TruffleContract from 'truffle-contract'
import { promisedWeb3 } from './web3Provider'
import { DXAuction, ERC20Interface } from './types'

const contractNames = [
  'DutchExchange',
  'DutchExchangeETHGNO',
  'DutchExchangeGNOETH',
  'Token',
  'TokenETH',
  'TokenGNO',
]


interface ContractsMap {
  DutchExchange: DXAuction
  Token: ERC20Interface,
  TokenETH: ERC20Interface,
  TokenGNO: ERC20Interface,
}

const Contracts = contractNames.map(name => TruffleContract(require(`../../build/contracts/${name}.json`)))

// name => contract mapping
export const contractsMap = contractNames.reduce((acc, name, i) => {
  acc[name] = Contracts[i]
  return acc
}, {}) as ContractsMap

export const setProvider = (provider: any) => Contracts.forEach((contract) => {
  contract.setProvider(provider)
})

const getPromisedIntances = () => Promise.all(Contracts.map(contr => contr.deployed()))

export const promisedContractsMap = init()

async function init() {
  const { currentProvider } = await promisedWeb3
  setProvider(currentProvider)

  const instances = await getPromisedIntances()

  // name => contract instance mapping
  // e.g. TokenETH => deployed TokenETH contract
  return contractNames.reduce((acc, name, i) => {
    acc[name] = instances[i]
    return acc
  }, {}) as ContractsMap
}
