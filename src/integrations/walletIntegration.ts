import { registerProvider, updateProvider, initDutchX, updateMainAppState } from 'actions/blockchain'
import initialize from './initialize'

import { Store } from 'redux'

export default async function walletIntegration(store: Store<any>) {
  const { dispatch, getState } = store
  // wraps actionCreator in dispatch
  const dispatchProviderAction = (actionCreator: any) =>
    async (provider: any, data: any) => dispatch(actionCreator({
      provider,
      ...data,
    }))

  const providerOptions = {
    getState,
    updateProvider: dispatchProviderAction(updateProvider),
    registerProvider: dispatchProviderAction(registerProvider),
    updateMainAppState: dispatchProviderAction(updateMainAppState),
  }

  try {
    await initialize(providerOptions)
  } catch (error) {
    console.warn('Error initializing wallet providers:', error.message || error)
  } finally {
    dispatch(initDutchX())
  }
}
