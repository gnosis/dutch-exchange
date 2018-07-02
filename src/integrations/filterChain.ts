import { promisedWeb3 } from 'api/web3Provider'
import { Account } from 'types'
import { TransactionObject, BlockReceipt, Hash } from 'api/types'
type Error1stCallback<T = any> = (error: Error, result: T) => void

interface Web3Filter {
  get(cb: Error1stCallback): void,
  watch(cb: Error1stCallback): void,
  stopWatching(): void,
}

type BlockStr = 'latest' | 'pending'
type BlockN = BlockStr | number

interface FilterOptions {
  fromBlock: BlockN,
  toBlock: BlockN,
  address: Account | Account[],
  topics: string[],
}



let mainFilter: Web3Filter
const accumCB: Error1stCallback<Hash>[] = []
const mainFilterCB: Error1stCallback<Hash> = (error, blockHash) => {
  if (error) return console.error(error)

  for (const cb of accumCB) cb(error, blockHash)
}

export const getFilter = async (options: BlockN | FilterOptions = 'latest', reuse = true): Promise<Web3Filter> => {
  if (mainFilter && reuse) return mainFilter

  const { web3 } = await promisedWeb3
  const filter = web3.eth.filter('latest', options)
  if (reuse) mainFilter = filter

  return filter
}

export const watch = async (cb: Error1stCallback<Hash>): Promise<Web3Filter['stopWatching']> => {
  const filter = await getFilter()
  
  accumCB.push(cb)
  console.log('STARTED WATCHING')
  // if it's the first callback added
  // start watching
  if (accumCB.length === 1) filter.watch(mainFilterCB)  

  return filter.stopWatching.bind(filter)
}

export const stopWatching = (filter = mainFilter) => filter.stopWatching()

export const isTxInBlock = (blockReceipt: BlockReceipt, tx:Hash) => {
  const { transactions } = blockReceipt

  if (transactions.length === 0) return false
  if (typeof transactions[0] === 'string') return (transactions as Hash[]).includes(tx)
  return (transactions as TransactionObject[]).find(txObj => txObj.hash === tx)
}

export const getBlock = async (bl: Hash, returnTransactionObjects?: boolean) => {
  const { getBlock } = await promisedWeb3
  return getBlock(bl, returnTransactionObjects)
}

// creates new filter, so that we don't call watch multiple times on the mainFilter
export const waitForTx = async (hash: Hash, reuse: boolean = true) => {
  const filter = await getFilter('latest', reuse)

  await new Promise(async (resolve, reject) => {
    const watchFunc  = reuse ? watch : filter.watch.bind(filter)
    watchFunc.watch(async (e: Error, bl: Hash) => {
      if (e) return reject(e)


      const blReceipt = await getBlock(bl)

      if (isTxInBlock(blReceipt, hash)) resolve(true)
    })
  })

  // don't stop watching the mainFilter
  if (reuse) filter.stopWatching()

  return true
}