import TruffleContract from 'truffle-contract'
import { promisedWeb3 } from './web3Provider'
import {
  DXAuction,
  ETHInterface,
  GNOInterface,
  OWLInterface,
  MGNInterface,
  SimpleContract,
  DeployedContract,
  ContractArtifact,
} from './types'

const contractNames = [
  'DutchExchange',          // Stays in dx-contracts
  'TokenFRT',               // Stays in dx-contracts
  'Proxy',                  // Stays in dx-contracts - will be renamed DutchExchangeProxy

  'EtherToken',             // will be @gnosis/util-contracts
  'TokenGNO',               // will be @gnosis/token-gno
  'TokenOWL',               // will be @gnosis/token-owl
  'TokenOWLProxy',          // will be @gnosis/token-owl

  'TokenOMG',               // will be deleted - use TokenERC20
  'TokenRDN',               // will be deleted - use TokenERC20
]

// fill contractsMap from here if available
const filename2ContractNameMap = {
  EtherToken: 'TokenETH',
}


interface ContractsMap {
  DutchExchange:  DXAuction,
  TokenETH:       ETHInterface,
  TokenGNO:       GNOInterface,
  TokenOWL:       OWLInterface,
  TokenMGN:       MGNInterface,
  TokenOMG:       GNOInterface,
  TokenRDN:       GNOInterface,
}

interface ContractsMapWProxy extends ContractsMap {
  Proxy: DeployedContract,
  TokenOWLProxy: DeployedContract,
}

const req = require.context(
  '@gnosis.pm/dx-contracts/build/contracts/',
  false,
  /(DutchExchange|Proxy|EtherToken|TokenGNO|TokenOWL|TokenOWLProxy|TokenFRT|TokenOMG|TokenRDN)\.json$/,
)

export const HumanFriendlyToken = TruffleContract(require('@gnosis.pm/util-contracts/build/contracts/HumanFriendlyToken.json'))

type TokenArtifact =
  './DutchExchange.json'  |
  './Proxy.json'          |   // rename to DutchExchangeProxy.json in dx-contracts@0.9.3
  './TokenFRT.json'       |
  './TokenOWL.json'       |   // Moving to @gnosis.pm/owl-token
  './TokenOWLProxy.json'  |   // Moving to @gnosis.pm/owl-token
  './EtherToken.json'     |   // Moving to @gnosis.pm/util-contracts
  './TokenGNO.json'       |   // Moving to @gnosis.pm/gno-token
  './TokenOMG.json'       |   // deleted in dx-contracts@0.9.1+
  './TokenRDN.json'           // deleted in dx-contracts@0.9.1+

const reqKeys = req.keys() as TokenArtifact[]
const ContractsArtifacts: ContractArtifact[] = contractNames.map(
  c => req(reqKeys.find(key => key === `./${c}.json`)),
)

// in development use different contract addresses
/* if (process.env.NODE_ENV === 'development') {
  // from networks-%ENV%.json
  const networks = require('@gnosis.pm/dx-contracts/networks-dev.json')

  for (const contrArt of ContractsArtifacts) {
    const { contractName } = contrArt
    // assign networks from the file, overriding from /build/contracts with same network id
    // but keeping local network ids
    if (networks[contractName]) Object.assign(contrArt.networks, networks[contractName])
  }
} */

const Contracts: SimpleContract[] = ContractsArtifacts.map(
  art => TruffleContract(art),
)

// name => contract mapping
export const contractsMap = contractNames.reduce((acc, name, i) => {
  acc[filename2ContractNameMap[name] || name] = Contracts[i]
  return acc
}, {}) as {[K in keyof ContractsMapWProxy]: SimpleContract}

(window as any).m = contractsMap

export const setProvider = (provider: any) => Contracts.concat(HumanFriendlyToken).forEach((contract) => {
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
  const deployedContracts = contractNames.reduce((acc, name, i) => {
    if (name === 'TokenFRT') {
      acc['TokenMGN'] = instances[i]
    } else {
      acc[filename2ContractNameMap[name] || name] = instances[i]
    }
    return acc
  }, {}) as ContractsMapWProxy

  const { address: proxyAddress } = deployedContracts.Proxy
  const { address: owlProxyAddress } = deployedContracts.TokenOWLProxy

  deployedContracts.DutchExchange = contractsMap.DutchExchange.at(proxyAddress)
  deployedContracts.TokenOWL = contractsMap.TokenOWL.at(owlProxyAddress)

  delete deployedContracts.Proxy
  delete deployedContracts.TokenOWLProxy

  console.log(deployedContracts)
  return (window as any).Dd = deployedContracts as ContractsMap
}
