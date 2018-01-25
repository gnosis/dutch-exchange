/*
eslint no-console:0,
no-confusing-arrow:0,
no-unused-expressions:0,
*/
// `truffle test --silent` or `truffle test -s` to suppress logs
const {
  silent,
  contract: contractFlag,
  gas: gasLog,
  gasTx,
} = require('minimist')(process.argv.slice(2), { alias: { silent: 's', contract: 'c', gas: 'g', gasTx: 'gtx' } })

const log = silent ? () => {} : console.log.bind(console)
const logger = (desc, fn) => log(`---- \n => ${desc} ${fn ? `|| - - - - - - - - - -  - > ${fn}` : ''}`)

const varLogger = (varName, varValue) => log(varName, '--->', varValue)

/**
 * gasLogWrapper
 * @param {*} obj
 */
const gasLogWrapper = (contracts) => {
  let totalGas = 0
  const getGas = (gas = totalGas) => {
    totalGas = gas
    return totalGas
  }
  const handler = {
    // intercept all GETS to contracts
    get(target, propKey) {
      const origMethod = target[propKey]
      // if prompted prop !== a FUNCTION return prop
      if (typeof origMethod !== 'function') {
        return origMethod
      }
      // go one level deeper into actual METHOD - here access to (.call, .apply etc)
      return new Proxy(origMethod, {
        get(target, propKey) {
          const defaultFunctionMethod = target[propKey]
          // called if NON-tx function aka .call thing
          if (propKey === 'call') {
            return async function asyncReturn(...args) {
              // console.info('Method detected, calling...')
              const result = await Reflect.apply(defaultFunctionMethod, target, args)

              return result
            }
          }
          // returns estimateGas etc type Functions
          return defaultFunctionMethod
        },
        // called if @transaction function
        async apply(target, thisArg, argumentsList) {
          const result = await Reflect.apply(target, thisArg, argumentsList)
          const { receipt } = result
          // check that BOTH gas flags are used
          gasLog && gasTx && console.info(`
          ==============================
          TX name     ==> ${propKey}
          TX gasCost  ==> ${receipt && receipt.gasUsed ? receipt.gasUsed : 'No gasUsed found'}
          ==============================
          `)
          totalGas += receipt && receipt.gasUsed ? receipt.gasUsed : 0
          return result
        },
      })
    },
  }

  return {
    gasLoggedContracts: contracts.map(c => new Proxy(c, handler)),
    getGas,
  }
}

/**
 * gasLogger
 * @param {contracts from testFunctions} contracts
 */
const gasLogger = (contracts) => {
  const { __totalGasUsed: getGasUse } = contracts
  gasLog && console.info(`
    *******************************
    TOTAL GAS 
    Gas ==> ${getGasUse()}
    *******************************
    `)
  getGasUse(0)
}

const assertRejects = async (q, msg) => {
  let res, catchFlag = false
  try {
    res = await q
    // checks if there was a Log event and its argument l contains string "R<number>"
    catchFlag = res.logs && !!res.logs.find(log => log.event === 'Log' && /\bR(\d+\.?)+/.test(log.args.l))
  } catch (e) {
    catchFlag = true
  } finally {
    if (!catchFlag) {
      assert.fail(res, null, msg)
    }
  }
}

const blockNumber = () => web3.eth.blockNumber

const timestamp = (block = 'latest') => web3.eth.getBlock(block).timestamp

// keeps track of watched events
let stopWatching = {}
/**
 * eventWatcher                - ...watches events
 * @param {contract} contract  - dx, usually
 * @param {string} event       - name of event on DutchExchange.sol to track
 * @param {Object} args?       - not required, args to look for
 * @returns stopWatching function
 */
const eventWatcher = (contract, eventName, argum = {}) => {
  const eventFunc = contract[eventName]
  if (!eventFunc) {
    log(`No event ${eventName} available in the contract`)
    return null
  }

  const eventObject = eventFunc(argum).watch((err, result) => {
    const { event, args } = result
    if (err) return log(err)

    switch (event) {
      // const { args: { returned, tulipsIssued } } = result
      case 'LogNumber':
        return log(`
        LOG FOUND:
        ========================
        ${args.l} ==> ${Number(args.n).toEth()}
        ========================
        `)
      case 'ClaimBuyerFunds':
        return log(`
        LOG FOUND:
        ========================
        RETURNED      ==> ${Number(args.returned).toEth()}
        TULIPS ISSUED ==> ${Number(args.tulipsIssued).toEth()}
        ========================
        `)
      default:
        return log(`
        LOG FOUND:
        ========================
        Event Name: ${event}
        Args:       
        ${JSON.stringify(args, undefined, 2)}
        ========================
        `)
    }
  })
  const contractEvents = stopWatching[contract.address] || (stopWatching[contract.address] = {})
  if (contractEvents[eventName]) contractEvents[eventName]()
  const unwatch = contractEvents[eventName] = eventObject.stopWatching.bind(eventObject)

  return unwatch
}

/**
 * eventWatcher.stopWatching    - stops watching an event
 * @param {contract} contract?  - dx, ususally,
 *                                if none specified stops watching all contracts
 * @param {string} event?       - name of event to stop watching,
 *                                if none specified stops watching all events for this contract
 */
eventWatcher.stopWatching = (contract, event) => {
  // if given particular event name, stop watching it
  if (contract && typeof contract === 'object' && contract.address) {
    const contractEvents = stopWatching[contract.address]

    if (!contractEvents) {
      log('contract was never watched')
      return
    }

    // if event isn't specified
    // stop watching all for this contract
    if (!event) {
      for (const ev of Object.keys(contractEvents)) {
        contractEvents[ev]()
      }
      delete stopWatching[contract.address]
      return
    }

    // stop watching a single event
    const unwatch = contractEvents[event]
    if (unwatch) {
      unwatch()
      delete stopWatching[event]
    } else {
      log(`${event} event was never watched`)
    }

    return
  }

  // otherwise stop watching all events
  const unwatchAll = () => {
    for (const key of Object.keys(stopWatching)) {
      const contractEvents = stopWatching[key]
      for (const ev of Object.keys(contractEvents)) {
        contractEvents[ev]()
      }
    }
    stopWatching = {}
  }

  // allow to be used as a direct input to mocha hooks (contract === done callback)
  if (typeof contract === 'function') {
    // don't wait if no events were watched
    if (!Object.keys(stopWatching).length) {
      contract()
      return
    }
    // unwatch after a delay as not all events a typically has been displayed
    // in case of after() hook
    setTimeout(() => {
      unwatchAll()
      contract()
    }, 500)
  } else unwatchAll()
}

const enableContractFlag = (...contractTests) => {
  const cTest = contractTests[contractFlag - 1]
  if (cTest) cTest()
  else contractTests.forEach(c => c())
}

module.exports = {
  assertRejects,
  blockNumber,
  enableContractFlag,
  eventWatcher,
  gasLogger,
  gasLogWrapper,
  log,
  logger,
  timestamp,
  varLogger,
}
