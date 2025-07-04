import path from "node:path"
import os from "node:os"
import { mkdirp, writeJson, writeFile, pathExists, mkdtemp } from "fs-extra"
import { execa } from "execa"
import { beforeAll, describe, expect, it } from "vitest"

const cli = "node"
let cliScript: string

beforeAll(() => {
  cliScript = path.join(globalThis.tmpRoot, "monorepo-hash.js")
})

describe("workspace detection", () => {
  it("detects Yarn workspaces", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "yarn-ws-"))
    await mkdirp(path.join(root, "packages", "a"))
    await writeJson(path.join(root, "package.json"), { workspaces: [ "packages/*" ] }, { spaces: 2 })
    await writeFile(path.join(root, "yarn.lock"), "")
    await writeJson(path.join(root, "packages", "a", "package.json"), { name: "a", version: "0.0.0" }, { spaces: 2 })
    await writeFile(path.join(root, "packages", "a", "index.js"), "console.log('a')\n")

    const result = await execa(cli, [ cliScript, "--generate" ], { cwd: root, reject: false })

    expect(result.exitCode).toBe(0)
    expect(await pathExists(path.join(root, "packages", "a", ".hash"))).toBe(true)
  })

  it("detects NPM workspaces", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "npm-ws-"))
    await mkdirp(path.join(root, "packages", "a"))
    await writeJson(path.join(root, "package.json"), { workspaces: [ "packages/*" ] }, { spaces: 2 })
    await writeFile(path.join(root, "package-lock.json"), "{}")
    await writeJson(path.join(root, "packages", "a", "package.json"), { name: "a", version: "0.0.0" }, { spaces: 2 })
    await writeFile(path.join(root, "packages", "a", "index.js"), "console.log('a')\n")

    const result = await execa(cli, [ cliScript, "--generate" ], { cwd: root, reject: false })

    expect(result.exitCode).toBe(0)
    expect(await pathExists(path.join(root, "packages", "a", ".hash"))).toBe(true)
  })

  it("detects Bun workspaces", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "bun-ws-"))
    await mkdirp(path.join(root, "packages", "a"))
    await writeJson(path.join(root, "package.json"), { workspaces: [ "packages/*" ] }, { spaces: 2 })
    await writeFile(path.join(root, "bun.lock"), "")
    await writeJson(path.join(root, "packages", "a", "package.json"), { name: "a", version: "0.0.0" }, { spaces: 2 })
    await writeFile(path.join(root, "packages", "a", "index.js"), "console.log('a')\n")

    const result = await execa(cli, [ cliScript, "--generate" ], { cwd: root, reject: false })

    expect(result.exitCode).toBe(0)
    expect(await pathExists(path.join(root, "packages", "a", ".hash"))).toBe(true)
  })

  it("detects Deno workspaces", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "deno-ws-"))
    await mkdirp(path.join(root, "packages", "a"))
    await writeFile(path.join(root, "deno.json"), JSON.stringify({ workspace: [ "packages/*" ] }, null, 2))
    await writeJson(path.join(root, "packages", "a", "package.json"), { name: "a", version: "0.0.0" }, { spaces: 2 })
    await writeFile(path.join(root, "packages", "a", "index.js"), "console.log('a')\n")

    const result = await execa(cli, [ cliScript, "--generate" ], { cwd: root, reject: false })

    expect(result.exitCode).toBe(0)
    expect(await pathExists(path.join(root, "packages", "a", ".hash"))).toBe(true)
  })
})
