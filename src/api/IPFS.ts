import IPFS from 'ipfs'
import { windowLoaded } from './utils'
import { FileBuffer } from 'types'
/**
 * @returns Promise<IPFS>
 */
const setupIPFS = async () => {
  await windowLoaded

  const node = new IPFS({ host: 'ipfs.infura.io', port: 5001, protocol: 'https' })
  return node
}

export const promisedIPFS = init()

async function init() {
  const ipfs = await setupIPFS()

  /**
   * ipfsAddFile - takes uint8Array Buffer and sends to IPFS node
   * @param {uint8[]} fileBuffer - uint8Array encoded JSON
   */
  const ipfsAddFile = async (fileBuffer: FileBuffer, oFile: File) => {
    const [file0] = await ipfs.files.add({
      path: oFile.name,
      content: Buffer.from(fileBuffer),
    })

    const { hash: fileHash, path: filePath } = file0

    console.warn('IPFS file added: ', { fileHash, filePath })

    return {
      fileHash,
      filePath,
    }
  }

  /**
   * ipfsGetAndDecode - grabs IPFS file via hash and decodes from uint8Array to string
   * @param {string} fileHash - hash value stored in IPFS
   */
  const ipfsGetAndDecode = async (fileHash: string) => {
    const [file0] = await ipfs.files.get(fileHash)
    const { content: contentArrayBuffer } = file0

    console.warn('IPFS file grabbed receipt: ', contentArrayBuffer)

    const fileContent = new window.TextDecoder('utf-8').decode(contentArrayBuffer)

    return fileContent
  }

  return {
    ipfs,
    ipfsGetAndDecode,
    ipfsAddFile,
  }
}


