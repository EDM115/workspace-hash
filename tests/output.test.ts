import path from "node:path"

import {
  readFile,
  remove,
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

describe("monorepo-hash output", () => {
  let cliScript: string
  let cwd: string
  const cli = "node"

  beforeAll(() => {
    cwd = globalThis.tmpRoot
    cliScript = path.join(cwd, "monorepo-hash.js")
  })

  it("reports unchanged when no files changed, and exit code 0", async () => {
    await execa(cli, [ cliScript, "--generate" ], { cwd })
    const result = await execa(cli, [ cliScript, "--compare" ], { cwd, reject: false, all: true })

    expect(result.exitCode).toBe(0)

    expect(result.all).toMatch(/✅ Unchanged \(3\) :/m)
    expect(result.all).toMatch(new RegExp(`• packages${sep.replace(/\\/g, "\\\\")}pkg-a`, "m"))
    expect(result.all).toMatch(new RegExp(`• packages${sep.replace(/\\/g, "\\\\")}pkg-b`, "m"))
    expect(result.all).toMatch(new RegExp(`• packages${sep.replace(/\\/g, "\\\\")}pkg-c`, "m"))
  })

  it("detects a file change and exits with non-zero, listing the changed workspace", async () => {
    if (!globalThis.tmpRoot) {
      throw new Error("tmpRoot is not set")
    }

    await execa(cli, [ cliScript, "--generate" ], { cwd })
    const pkgBIndex = path.join(globalThis.tmpRoot, "packages", "pkg-b", "index.js")

    await writeFile(pkgBIndex, "export const msg = \"pkg-b (edited)\"\n")
    const result = await execa(cli, [ cliScript, "--compare" ], { cwd, reject: false, all: true })

    expect(result.exitCode).toBe(1)

    const expectedPattern = new RegExp(
      "✅ Unchanged \\(1\\) :\\s*"
      + `• packages${sep.replace(/\\/g, "\\\\")}pkg-c\\s*`
      + "⚠️  Changed \\(2\\) :\\s*"
      + `• packages${sep.replace(/\\/g, "\\\\")}pkg-a[\\s\\S]*?`
      + "🚧 changed dependency\\(s\\) :[\\s\\S]*?"
      + `• packages${sep.replace(/\\/g, "\\\\")}pkg-b[\\s\\S]*?`
      + `• packages${sep.replace(/\\/g, "\\\\")}pkg-b`,
      "ms",
    )

    expect(result.all).toMatch(expectedPattern)
  })

  it("reports missing .hash if you delete a hash file and run --compare", async () => {
    if (!globalThis.tmpRoot) {
      throw new Error("tmpRoot is not set")
    }

    await execa(cli, [ cliScript, "--generate" ], { cwd })
    const rootHashPath = path.join(globalThis.tmpRoot, ".hash")
    const hashes = JSON.parse(await readFile(rootHashPath, "utf8")) as Record<string, string>
    delete hashes["packages/pkg-a"]
    await writeFile(rootHashPath, JSON.stringify(hashes, null, 2))
    const result = await execa(cli, [ cliScript, "--compare" ], { cwd, reject: false, all: true })

    expect(result.exitCode).toBe(1)
    expect(result.all).toContain("❓ Missing .hash files (1) :")
    expect(result.all).toContain(`• packages${sep}pkg-a`)
  })

  it("produces deterministic hashes across consecutive --generate runs", async () => {
    if (!globalThis.tmpRoot) {
      throw new Error("tmpRoot is not set")
    }

    await execa(cli, [ cliScript, "--generate" ], { cwd })
    const rootHashPath = path.join(globalThis.tmpRoot, ".hash")
    const firstMap = JSON.parse(await readFile(rootHashPath, "utf8")) as Record<string, string>
    const firstA = firstMap["packages/pkg-a"]
    const firstB = firstMap["packages/pkg-b"]

    await remove(rootHashPath)
    await execa(cli, [ cliScript, "--generate" ], { cwd })
    const secondMap = JSON.parse(await readFile(rootHashPath, "utf8")) as Record<string, string>
    const secondA = secondMap["packages/pkg-a"]
    const secondB = secondMap["packages/pkg-b"]

    expect(secondA).toBe(firstA)
    expect(secondB).toBe(firstB)
  })
})
