import path from "node:path"

import {
  pathExists,
  writeFile,
} from "fs-extra"
import { execa } from "execa"
import {
  beforeAll,
  describe,
  expect,
  it,
} from "vitest"

const { sep } = path

describe("debug mode", () => {
  let cliScript: string
  let cwd: string
  const cli = "node"

  beforeAll(() => {
    cwd = globalThis.tmpRoot
    cliScript = path.join(cwd, "monorepo-hash.js")
  })

  it("creates .debug-hash files and reports mismatched files", async () => {
    await execa(cli, [ cliScript, "--generate", "--debug" ], { cwd })

    const aDebug = path.join(cwd, "packages", "pkg-a", ".debug-hash")
    const bDebug = path.join(cwd, "packages", "pkg-b", ".debug-hash")

    expect(await pathExists(aDebug)).toBe(true)
    expect(await pathExists(bDebug)).toBe(true)

    const pkgBIndex = path.join(cwd, "packages", "pkg-b", "index.js")

    await writeFile(pkgBIndex, "export const msg = \"pkg-b (edited)\"\n")

    const result = await execa(
      cli,
      [ cliScript, "--compare", "--debug" ],
      { cwd, reject: false, all: true },
    )

    expect(result.all).toContain(`⚠️  <debug> packages${sep}pkg-b diverging files :`)
    expect(result.all).toContain("• index.js")
    expect(result.exitCode).toBe(1)
  })
})
