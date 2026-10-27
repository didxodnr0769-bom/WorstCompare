import fs from 'node:fs/promises'
import { constants, type Stats } from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

export function isInside(root: string, target: string, paths = path): boolean {
  const relative = paths.relative(root, target)
  return (
    relative === '' ||
    (!paths.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${paths.sep}`))
  )
}

function absolutePath(value: unknown): string {
  if (typeof value !== 'string' || value.includes('\0') || !path.isAbsolute(value)) {
    throw new Error('올바른 절대 경로가 필요합니다.')
  }
  const segments = value.split(process.platform === 'win32' ? /[\\/]/ : '/')
  if (segments.includes('..')) throw new Error('상위 폴더를 참조하는 경로는 사용할 수 없습니다.')
  return path.resolve(value)
}

async function lstat(filePath: string): Promise<Stats | null> {
  try {
    return await fs.lstat(filePath)
  } catch (error) {
    if ((error as { code?: string }).code === 'ENOENT') return null
    throw error
  }
}

interface Root {
  path: string
  realPath: string
}

interface CheckedPath {
  path: string
  realPath: string
  stats: Stats | null
}

export class ComparisonFileSystem {
  private constructor(private readonly roots: [Root, Root]) {}

  static async create(left: string, right: string): Promise<ComparisonFileSystem> {
    const approve = async (input: string): Promise<Root> => {
      const rootPath = absolutePath(input)
      const stats = await lstat(rootPath)
      if (!stats?.isDirectory() || stats.isSymbolicLink()) {
        throw new Error('실제 폴더를 비교 대상으로 선택해 주세요.')
      }
      return { path: rootPath, realPath: await fs.realpath(rootPath) }
    }
    return new ComparisonFileSystem([await approve(left), await approve(right)])
  }

  private async check(input: string, allowRoot = false): Promise<CheckedPath> {
    const target = absolutePath(input)
    const root = this.roots
      .filter(item => isInside(item.path, target))
      .sort((a, b) => b.path.length - a.path.length)[0]
    if (!root || (!allowRoot && this.roots.some(item => item.path === target))) {
      throw new Error('현재 비교 폴더 내부의 항목만 작업할 수 있습니다.')
    }
    const rootStats = await lstat(root.path)
    if (
      !rootStats?.isDirectory() ||
      rootStats.isSymbolicLink() ||
      (await fs.realpath(root.path)) !== root.realPath
    ) {
      throw new Error('비교 폴더가 변경되었습니다. 폴더를 다시 비교해 주세요.')
    }
    let cursor = root.path
    let realPath = root.realPath
    let stats: Stats | null = rootStats
    const relative = path.relative(root.path, target)
    for (const part of relative ? relative.split(path.sep) : []) {
      cursor = path.join(cursor, part)
      stats = await lstat(cursor)
      if (stats?.isSymbolicLink()) throw new Error('심볼릭 링크는 작업할 수 없습니다.')
      if (stats) {
        realPath = await fs.realpath(cursor)
        if (!isInside(root.realPath, realPath))
          throw new Error('비교 폴더 밖의 항목은 작업할 수 없습니다.')
      } else {
        realPath = path.resolve(realPath, path.relative(path.dirname(cursor), target))
        break
      }
    }
    return { path: target, realPath, stats }
  }

  private protectRoots(target: CheckedPath): void {
    if (
      this.roots.some(
        root => isInside(target.path, root.path) || isInside(target.realPath, root.realPath)
      )
    ) {
      throw new Error('비교 폴더 또는 그 상위 폴더는 변경할 수 없습니다.')
    }
  }

  private async inspectTree(input: string): Promise<void> {
    const checked = await this.check(input)
    if (!checked.stats) return
    if (checked.stats.isDirectory()) {
      for (const name of await fs.readdir(checked.path))
        await this.inspectTree(path.join(checked.path, name))
    } else if (!checked.stats.isFile()) {
      throw new Error('일반 파일과 폴더만 작업할 수 있습니다.')
    }
  }

  async listFiles(side: 0 | 1, excludes: string[]): Promise<string[]> {
    const root = this.roots[side]
    const walk = async (directory: string): Promise<string[]> => {
      const checked = await this.check(directory, true)
      if (!checked.stats?.isDirectory()) throw new Error('비교 폴더를 읽을 수 없습니다.')
      const files: string[] = []
      for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
        const fullPath = path.join(directory, entry.name)
        const relative = path.relative(root.path, fullPath).split(path.sep).join('/')
        if (excludes.some(pattern => relative.includes(pattern)) || entry.isSymbolicLink()) continue
        if (entry.isDirectory()) files.push(...(await walk(fullPath)))
        else if (entry.isFile()) {
          await this.check(fullPath)
          files.push(relative)
        }
      }
      return files
    }
    return walk(root.path)
  }

  async compare(
    excludes: string[]
  ): Promise<
    { path: string; status: 'same' | 'modified' | 'left-only' | 'right-only' | 'error' }[]
  > {
    if (!Array.isArray(excludes) || excludes.some(value => typeof value !== 'string')) {
      throw new Error('제외 패턴이 올바르지 않습니다.')
    }
    const left = new Set(await this.listFiles(0, excludes))
    const right = new Set(await this.listFiles(1, excludes))
    const files = [...new Set([...left, ...right])].sort()
    const results: Awaited<ReturnType<ComparisonFileSystem['compare']>> = []
    for (const file of files) {
      if (left.has(file) && right.has(file)) {
        try {
          const a = await this.readFile(path.join(this.roots[0].path, file))
          const b = await this.readFile(path.join(this.roots[1].path, file))
          if (a === null || b === null) throw new Error('파일이 변경되었습니다.')
          results.push({
            path: file,
            status: a.replace(/\r\n/g, '\n') === b.replace(/\r\n/g, '\n') ? 'same' : 'modified',
          })
        } catch {
          results.push({ path: file, status: 'error' })
        }
      } else results.push({ path: file, status: left.has(file) ? 'left-only' : 'right-only' })
    }
    return results
  }

  async readFile(input: string): Promise<string | null> {
    const checked = await this.check(input)
    if (!checked.stats) return null
    if (!checked.stats.isFile()) throw new Error('일반 파일만 읽을 수 있습니다.')
    const handle = await fs.open(checked.path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0))
    try {
      if (!(await handle.stat()).isFile()) throw new Error('일반 파일만 읽을 수 있습니다.')
      return await handle.readFile('utf8')
    } finally {
      await handle.close()
    }
  }

  private async writeFile(
    input: string,
    write: (handle: Awaited<ReturnType<typeof fs.open>>) => Promise<void>,
    modeOverride?: number
  ): Promise<void> {
    const checked = await this.check(input)
    this.protectRoots(checked)
    if (checked.stats && !checked.stats.isFile()) throw new Error('일반 파일만 덮어쓸 수 있습니다.')
    await fs.mkdir(path.dirname(checked.path), { recursive: true })
    await this.check(input)
    // 기존 inode를 직접 덮어쓰지 않아 하드 링크로 연결된 다른 파일의 내용을 보존합니다.
    const temporary = path.join(path.dirname(checked.path), `.worstcompare-${randomUUID()}.tmp`)
    const mode = modeOverride ?? (checked.stats ? checked.stats.mode & 0o777 : undefined)
    const handle = await fs.open(temporary, 'wx', mode ?? 0o666)
    try {
      await write(handle)
      if (mode !== undefined) await handle.chmod(mode)
      await handle.close()
      const current = await this.check(input)
      this.protectRoots(current)
      await fs.rename(temporary, current.path)
    } finally {
      await handle.close().catch(() => {})
      await fs.rm(temporary, { force: true })
    }
  }

  async saveFile(input: string, content: string): Promise<void> {
    if (typeof content !== 'string') throw new Error('저장할 내용이 올바르지 않습니다.')
    await this.writeFile(input, handle => handle.writeFile(content, 'utf8'))
  }

  async copyItem(source: string, destination: string): Promise<void> {
    const from = await this.check(source)
    const to = await this.check(destination)
    this.protectRoots(to)
    if (!from.stats) throw new Error('복사할 항목이 없습니다.')
    if (isInside(from.realPath, to.realPath) || isInside(to.realPath, from.realPath)) {
      throw new Error('같거나 중첩된 경로 사이에는 복사할 수 없습니다.')
    }
    await this.inspectTree(source)
    await this.inspectTree(destination)
    const copy = async (src: string, dest: string): Promise<void> => {
      const current = await this.check(src)
      const target = await this.check(dest)
      this.protectRoots(target)
      if (current.stats?.isDirectory()) {
        if (target.stats && !target.stats.isDirectory())
          throw new Error('폴더를 파일 위에 복사할 수 없습니다.')
        await fs.mkdir(target.path, { recursive: true, mode: 0o700 })
        await this.check(dest)
        try {
          for (const name of await fs.readdir(current.path))
            await copy(path.join(src, name), path.join(dest, name))
        } finally {
          if (!target.stats) {
            await this.check(dest)
            await fs.chmod(target.path, current.stats.mode & 0o777)
          }
        }
      } else {
        if (!current.stats?.isFile()) throw new Error('일반 파일만 복사할 수 있습니다.')
        const handle = await fs.open(current.path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0))
        try {
          if (!(await handle.stat()).isFile()) throw new Error('일반 파일만 복사할 수 있습니다.')
          await this.writeFile(
            dest,
            async output => {
              const buffer = Buffer.allocUnsafe(64 * 1024)
              for (;;) {
                const { bytesRead } = await handle.read(buffer, 0, buffer.length, null)
                if (!bytesRead) break
                let offset = 0
                while (offset < bytesRead) {
                  const { bytesWritten } = await output.write(
                    buffer,
                    offset,
                    bytesRead - offset,
                    null
                  )
                  if (!bytesWritten) throw new Error('파일을 복사할 수 없습니다.')
                  offset += bytesWritten
                }
              }
            },
            current.stats.mode & 0o777
          )
        } finally {
          await handle.close()
        }
      }
    }
    await copy(source, destination)
  }

  async deleteItem(input: string): Promise<void> {
    const target = await this.check(input)
    this.protectRoots(target)
    await this.inspectTree(input)
    await this.check(input)
    await fs.rm(target.path, { recursive: true, force: true })
  }
}
