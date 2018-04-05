export const windowLoaded = new Promise((accept, reject) => {
  if (typeof window === 'undefined') {
    return accept()
  }

  if (typeof window.addEventListener !== 'function') {
    return reject(new Error('expected to be able to register event listener'))
  }

  window.addEventListener('load', function loadHandler(event) {
    window.removeEventListener('load', loadHandler, false)
    return accept(event)
  }, false)
})

export const readFileUpload = (file: any) =>
    new Promise((resolve) => {
      const r = new FileReader()
      r.onload = (e: any) => resolve(e.target.result)
      r.readAsArrayBuffer(file)
    })

export const promisify = (func: Function, context: object, ...defArgs: any[]) =>
  (...args: any[]): Promise<any> => new Promise((res, rej) => {
    func.apply(context, [...defArgs, ...args, (err: Error, result: any) => err ? rej(err) : res(result)])
  })
