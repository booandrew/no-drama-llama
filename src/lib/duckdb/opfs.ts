export async function isOPFSAvailable(): Promise<boolean> {
  if (!('navigator' in globalThis && 'storage' in navigator && 'getDirectory' in navigator.storage)) {
    return false
  }
  try {
    const root = await navigator.storage.getDirectory()
    return !!root
  } catch {
    return false
  }
}

export class OPFSUtil {
  private rootDir: FileSystemDirectoryHandle | null = null
  private handles: Map<string, FileSystemFileHandle> = new Map()

  private async root(): Promise<FileSystemDirectoryHandle> {
    if (!this.rootDir) {
      this.rootDir = await navigator.storage.getDirectory()
    }
    return this.rootDir
  }

  async getFileHandle(filename: string, create = true): Promise<FileSystemFileHandle> {
    if (this.handles.has(filename)) {
      return this.handles.get(filename)!
    }
    const dir = await this.root()
    const handle = await dir.getFileHandle(filename, { create })
    this.handles.set(filename, handle)
    return handle
  }

  async fileExists(filename: string): Promise<boolean> {
    try {
      await this.getFileHandle(filename, false)
      return true
    } catch {
      return false
    }
  }

  async getFileSize(filename: string): Promise<number> {
    try {
      const handle = await this.getFileHandle(filename, false)
      const file = await handle.getFile()
      return file.size
    } catch {
      return 0
    }
  }

  async readFile(filename: string): Promise<ArrayBuffer> {
    const handle = await this.getFileHandle(filename, false)
    const file = await handle.getFile()
    return file.arrayBuffer()
  }

  async storeFile(filename: string, data: ArrayBuffer | Uint8Array): Promise<void> {
    const handle = await this.getFileHandle(filename, true)
    const writable = await handle.createWritable()
    try {
      const buffer =
        data instanceof ArrayBuffer ? data : new Uint8Array(data).buffer as ArrayBuffer
      await writable.write(buffer)
    } finally {
      await writable.close()
    }
  }

  async deleteFile(filename: string): Promise<void> {
    const dir = await this.root()
    this.handles.delete(filename)
    await dir.removeEntry(filename)
  }

  closeAllHandles(): void {
    this.handles.clear()
    this.rootDir = null
  }
}
