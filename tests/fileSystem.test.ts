import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { ComparisonFileSystem, isInside } from '../src/fileSystem'

let fixture: string
let left: string
let right: string
let outside: string
let service: ComparisonFileSystem

async function write(file: string, content: string | Uint8Array = 'original') {
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, content)
}

beforeEach(async () => {
  fixture = await fs.mkdtemp(path.join(await fs.realpath(os.tmpdir()), 'worstcompare-safe-'))
  left = path.join(fixture, 'left')
  right = path.join(fixture, 'right')
  outside = path.join(fixture, 'outside')
  for (const dir of [left, right, outside]) await fs.mkdir(dir)
  service = await ComparisonFileSystem.create(left, right)
})

afterEach(async () => {
  await fs.rm(fixture, { recursive: true, force: true })
})

describe('comparison root boundaries', () => {
  it.each(['read', 'save', 'copy-from', 'copy-to', 'delete'])(
    'rejects an outside %s operation without touching its file',
    async operation => {
      const foreign = path.join(outside, 'important.txt')
      const inside = path.join(left, 'file.txt')
      await write(foreign, 'keep outside')
      await write(inside)
      const request =
        operation === 'read'
          ? service.readFile(foreign)
          : operation === 'save'
            ? service.saveFile(foreign, 'overwrite')
            : operation === 'copy-from'
              ? service.copyItem(foreign, path.join(right, 'copy.txt'))
              : operation === 'copy-to'
                ? service.copyItem(inside, foreign)
                : service.deleteItem(foreign)
      await expect(request).rejects.toThrow()
      expect(await fs.readFile(foreign, 'utf8')).toBe('keep outside')
    }
  )

  it.each(['../outside/important.txt', 'nested/../../outside/important.txt'])(
    'rejects raw traversal %s',
    async relative => {
      const target = `${left}/${relative}`
      await expect(service.saveFile(target, 'overwrite')).rejects.toThrow()
      await expect(service.deleteItem(target)).rejects.toThrow()
    }
  )

  it('rejects sibling-prefix paths, relative paths, NULs, and non-string inputs', async () => {
    const sibling = path.join(fixture, 'left-other', 'file.txt')
    for (const target of [sibling, 'file.txt', `${left}/bad\0name`, null, 42]) {
      await expect(service.readFile(target as string)).rejects.toThrow()
    }
  })

  it.each([0, 1])('does not overwrite, copy onto, or delete selected root %s', async side => {
    const root = [left, right][side]
    await write(path.join(left, 'source.txt'))
    await expect(service.saveFile(root, 'bad')).rejects.toThrow()
    await expect(service.copyItem(path.join(left, 'source.txt'), root)).rejects.toThrow()
    await expect(service.deleteItem(root)).rejects.toThrow()
    expect((await fs.stat(root)).isDirectory()).toBe(true)
  })

  it('protects a nested comparison root and its ancestors', async () => {
    const nested = path.join(left, 'parent', 'right')
    await fs.mkdir(nested, { recursive: true })
    const nestedService = await ComparisonFileSystem.create(left, nested)
    await write(path.join(nested, 'keep.txt'), 'keep nested root')
    await expect(nestedService.deleteItem(path.join(left, 'parent'))).rejects.toThrow()
    await expect(nestedService.deleteItem(nested)).rejects.toThrow()
    expect(await fs.readFile(path.join(nested, 'keep.txt'), 'utf8')).toBe('keep nested root')
  })

  it('allows comparison of identical roots but blocks copies onto themselves', async () => {
    await write(path.join(left, 'same.txt'))
    const same = await ComparisonFileSystem.create(left, left)
    expect(await same.compare([])).toEqual([{ path: 'same.txt', status: 'same' }])
    await expect(
      same.copyItem(path.join(left, 'same.txt'), path.join(left, 'same.txt'))
    ).rejects.toThrow()
  })

  it('handles Windows drive, UNC, traversal, case, and sibling boundaries using native Windows semantics', () => {
    const win = path.win32
    expect(isInside('C:\\Work', 'c:\\work\\src\\index.ts', win)).toBe(true)
    expect(isInside('C:\\Work', 'C:\\Work-other\\file', win)).toBe(false)
    expect(isInside('C:\\Work', 'C:\\Work\\..\\outside', win)).toBe(false)
    expect(isInside('C:\\Work', 'D:\\Work\\file', win)).toBe(false)
    expect(isInside('C:\\Work', '\\\\server\\share\\file', win)).toBe(false)
    expect(isInside('\\\\server\\share\\root', '\\\\server\\share\\root-other', win)).toBe(false)
  })
})

describe('symbolic link boundaries', () => {
  it('rejects a symbolic link selected as a comparison root', async () => {
    const alias = path.join(fixture, 'root-link')
    await fs.symlink(left, alias, 'dir')
    await expect(ComparisonFileSystem.create(alias, right)).rejects.toThrow()
  })

  it('supports a system-style alias above a selected root and rejects a later alias target change', async () => {
    const alias = path.join(fixture, 'alias')
    await fs.symlink(left, alias, 'dir')
    await fs.mkdir(path.join(left, 'project'))
    await fs.mkdir(path.join(outside, 'project'))
    const aliased = await ComparisonFileSystem.create(path.join(alias, 'project'), right)
    await aliased.saveFile(path.join(alias, 'project', 'safe.txt'), 'safe')
    await fs.unlink(alias)
    await fs.symlink(outside, alias, 'dir')
    await expect(
      aliased.saveFile(path.join(alias, 'project', 'escape.txt'), 'bad')
    ).rejects.toThrow()
    await expect(fs.lstat(path.join(outside, 'project', 'escape.txt'))).rejects.toMatchObject({
      code: 'ENOENT',
    })
  })

  it.each(['file', 'directory', 'dangling'])(
    'rejects reads/writes/copies/deletes through a %s link',
    async kind => {
      const foreign = path.join(outside, 'important.txt')
      await write(foreign, 'keep outside')
      const link = path.join(left, 'link')
      await fs.symlink(
        kind === 'directory'
          ? outside
          : kind === 'dangling'
            ? path.join(outside, 'missing')
            : foreign,
        link,
        kind === 'directory' ? 'dir' : 'file'
      )
      const target = kind === 'directory' ? path.join(link, 'important.txt') : link
      await write(path.join(right, 'source.txt'))
      await expect(service.readFile(target)).rejects.toThrow()
      await expect(service.saveFile(target, 'bad')).rejects.toThrow()
      await expect(service.copyItem(target, path.join(right, 'copy.txt'))).rejects.toThrow()
      await expect(service.copyItem(path.join(right, 'source.txt'), target)).rejects.toThrow()
      await expect(service.deleteItem(target)).rejects.toThrow()
      expect(await fs.readFile(foreign, 'utf8')).toBe('keep outside')
      expect((await fs.lstat(link)).isSymbolicLink()).toBe(true)
    }
  )

  it('rejects a linked ancestor before creating missing destination directories', async () => {
    await fs.symlink(outside, path.join(right, 'linked'), 'dir')
    await expect(
      service.saveFile(path.join(right, 'linked', 'new', 'file.txt'), 'bad')
    ).rejects.toThrow()
    await expect(fs.lstat(path.join(outside, 'new'))).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it.each(['source', 'destination'])(
    'preflights hidden and excluded links inside the recursive %s tree before copying',
    async side => {
      const source = path.join(left, 'project')
      const destination = path.join(right, 'project')
      await write(path.join(source, 'normal.txt'), 'new')
      await write(path.join(destination, 'normal.txt'), 'old')
      const linked = path.join(side === 'source' ? source : destination, '.ignored', 'nested')
      await fs.mkdir(path.dirname(linked), { recursive: true })
      await fs.symlink(outside, linked, 'dir')
      await expect(service.copyItem(source, destination)).rejects.toThrow()
      expect(await fs.readFile(path.join(destination, 'normal.txt'), 'utf8')).toBe('old')
    }
  )

  it('does not delete a folder that contains a link', async () => {
    const directory = path.join(left, 'folder')
    await write(path.join(directory, 'keep.txt'))
    await fs.symlink(outside, path.join(directory, 'link'), 'dir')
    await expect(service.deleteItem(directory)).rejects.toThrow()
    expect(await fs.readFile(path.join(directory, 'keep.txt'), 'utf8')).toBe('original')
  })

  it('rejects a root replaced by a link after the comparison was authorized', async () => {
    await fs.rename(left, path.join(fixture, 'old-left'))
    await fs.symlink(outside, left, 'dir')
    await expect(service.saveFile(path.join(left, 'bad.txt'), 'bad')).rejects.toThrow()
  })

  it('omits links from comparisons without reading their targets', async () => {
    await write(path.join(outside, 'secret.txt'))
    await fs.symlink(path.join(outside, 'secret.txt'), path.join(left, 'secret.txt'))
    await write(path.join(right, 'secret.txt'), 'normal file')
    expect(await service.compare([])).toEqual([{ path: 'secret.txt', status: 'right-only' }])
  })
})

describe('normal operations and filename regression', () => {
  it('compares statuses, ignores CRLF differences, and applies comma-split substring exclusions', async () => {
    for (const root of [left, right])
      await write(path.join(root, 'same.txt'), root === left ? 'same\n' : 'same\r\n')
    await write(path.join(left, 'changed.txt'), 'left')
    await write(path.join(right, 'changed.txt'), 'right')
    await write(path.join(left, 'left.txt'))
    await write(path.join(right, 'right.txt'))
    await write(path.join(left, 'ignored', 'file.txt'))
    expect(await service.compare(['ignored'])).toEqual([
      { path: 'changed.txt', status: 'modified' },
      { path: 'left.txt', status: 'left-only' },
      { path: 'right.txt', status: 'right-only' },
      { path: 'same.txt', status: 'same' },
    ])
  })

  it('preserves a literal POSIX backslash filename through comparison, copy, save, and delete', async () => {
    if (process.platform === 'win32') return
    const name = '..\\sample.txt'
    const original = path.join(left, name)
    const copy = path.join(right, name)
    await write(original, 'literal filename')
    await write(path.join(fixture, 'sample.txt'), 'keep parent')
    expect(await service.compare([])).toEqual([{ path: name, status: 'left-only' }])
    await service.copyItem(original, copy)
    expect(await service.readFile(copy)).toBe('literal filename')
    await service.saveFile(copy, 'updated')
    await service.deleteItem(copy)
    expect(await fs.readFile(path.join(fixture, 'sample.txt'), 'utf8')).toBe('keep parent')
  })

  it('supports Korean/spaces/dots, missing destinations, and restoring deleted text', async () => {
    const file = path.join(left, '한글 폴더', 'file.. name.txt')
    await service.saveFile(file, '첫 내용')
    expect(await service.readFile(file)).toBe('첫 내용')
    const copy = path.join(right, 'new', 'nested', 'copy.txt')
    await service.copyItem(file, copy)
    const previous = await service.readFile(copy)
    await service.deleteItem(copy)
    expect(await service.readFile(copy)).toBe(null)
    await service.saveFile(copy, previous!)
    expect(await service.readFile(copy)).toBe('첫 내용')
    await service.copyItem(copy, file)
    expect(await service.readFile(file)).toBe('첫 내용')
  })

  it('copies binary bytes and whole directory contents including excluded files without truncation', async () => {
    const bytes = new Uint8Array(150_000).map((_, index) => index % 256)
    await write(path.join(left, 'project', 'image.bin'), bytes)
    await write(path.join(left, 'project', '.ignored', 'file.txt'))
    await service.copyItem(path.join(left, 'project'), path.join(right, 'project'))
    expect(await fs.readFile(path.join(right, 'project', 'image.bin'))).toEqual(Buffer.from(bytes))
    expect(await fs.readFile(path.join(right, 'project', '.ignored', 'file.txt'), 'utf8')).toBe(
      'original'
    )
    await service.deleteItem(path.join(right, 'project'))
    await expect(fs.lstat(path.join(right, 'project'))).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('replaces a hard-linked destination entry without changing its outside counterpart', async () => {
    const external = path.join(outside, 'hardlink.txt')
    const target = path.join(right, 'hardlink.txt')
    await write(external, 'keep outside')
    await fs.link(external, target)
    await service.saveFile(target, 'new inside')
    expect(await fs.readFile(external, 'utf8')).toBe('keep outside')
    await fs.unlink(target)
    await fs.link(external, target)
    await write(path.join(left, 'source.txt'), 'copied inside')
    await service.copyItem(path.join(left, 'source.txt'), target)
    expect(await fs.readFile(external, 'utf8')).toBe('keep outside')
    expect(await fs.readFile(target, 'utf8')).toBe('copied inside')
  })

  it('preserves private directory modes and keeps existing destination directory modes', async () => {
    if (process.platform === 'win32') return
    const source = path.join(left, 'private')
    const destination = path.join(right, 'private')
    await write(path.join(source, 'file.txt'))
    await fs.chmod(source, 0o700)
    await service.copyItem(source, destination)
    expect((await fs.stat(destination)).mode & 0o777).toBe(0o700)
    await fs.chmod(destination, 0o750)
    await service.copyItem(source, destination)
    expect((await fs.stat(destination)).mode & 0o777).toBe(0o750)
  })

  it('applies source file permissions on copy and preserves target permissions on save', async () => {
    if (process.platform === 'win32') return
    const source = path.join(left, 'private.txt')
    const destination = path.join(right, 'public.txt')
    await write(source, 'private')
    await write(destination, 'public')
    await fs.chmod(source, 0o600)
    await fs.chmod(destination, 0o644)
    await service.copyItem(source, destination)
    expect((await fs.stat(destination)).mode & 0o777).toBe(0o600)
    await service.saveFile(destination, 'updated')
    expect((await fs.stat(destination)).mode & 0o777).toBe(0o600)
    await fs.chmod(source, 0o755)
    await service.copyItem(source, path.join(right, 'script.sh'))
    expect((await fs.stat(path.join(right, 'script.sh'))).mode & 0o777).toBe(0o755)
  })

  it.each(['descendant', 'ancestor'])('rejects copying a directory to its %s', async direction => {
    await write(path.join(left, 'parent', 'child', 'file.txt'))
    const parent = path.join(left, 'parent')
    const child = path.join(parent, 'child')
    await expect(
      service.copyItem(
        direction === 'descendant' ? parent : child,
        direction === 'descendant' ? child : parent
      )
    ).rejects.toThrow()
  })

  it('rejects malformed comparison patterns and save content', async () => {
    await expect(service.compare(null as unknown as string[])).rejects.toThrow()
    await expect(service.compare([42 as unknown as string])).rejects.toThrow()
    await expect(
      service.saveFile(path.join(left, 'file.txt'), null as unknown as string)
    ).rejects.toThrow()
  })
})
