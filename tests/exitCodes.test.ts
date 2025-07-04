import path from "node:path"

import {
  writeFile,
  readFile,
  remove,
  writeJson,
} from "fs-extra"
import { execa } from "execa"
import {
  beforeAll,
  describe,
  expect,
  it,
} from "vitest"

describe("exit codes", () => {
  let cliScript: string
  let cwd: string
  const cli = "node"

  beforeAll(() => {
    cwd = globalThis.tmpRoot
    cliScript = path.join(cwd, "monorepo-hash.js")
  })

  it("returns 0 for --help", async () => {
    const result = await execa(cli, [ cliScript, "--help" ], { cwd, reject: false })

    expect(result.exitCode).toBe(0)
  })

  it("returns 2 when no mode is specified", async () => {
    const result = await execa(cli, [ cliScript ], { cwd, reject: false })

    expect(result.exitCode).toBe(2)
  })

  it("returns 2 when both --generate and --compare are specified", async () => {
    const result = await execa(cli, [ cliScript, "--generate", "--compare" ], { cwd, reject: false })

    expect(result.exitCode).toBe(2)
  })

  it("returns 3 for unknown option", async () => {
    const result = await execa(cli, [ cliScript, "--edm115" ], { cwd, reject: false })

    expect(result.exitCode).toBe(3)
  })

  it("returns 4 when pnpm-workspace.yaml is missing", async () => {
    if (!globalThis.tmpRoot) {
      throw new Error("tmpRoot is not set")
    }

    const workspaceFilePath = path.join(globalThis.tmpRoot, "pnpm-workspace.yaml")
    const workspaceContent = await readFile(workspaceFilePath, "utf8")

    await remove(workspaceFilePath)
    const result = await execa(cli, [ cliScript, "--generate" ], { cwd, reject: false })

    expect(result.exitCode).toBe(4)

    await writeFile(workspaceFilePath, workspaceContent)
  })

  it("uses package.json workspaces when pnpm-workspace.yaml is missing", async () => {
    if (!globalThis.tmpRoot) {
      throw new Error("tmpRoot is not set")
    }

    const workspaceFilePath = path.join(globalThis.tmpRoot, "pnpm-workspace.yaml")
    const workspaceContent = await readFile(workspaceFilePath, "utf8")

    await remove(workspaceFilePath)
    await writeJson(
      path.join(globalThis.tmpRoot, "package.json"),
      { private: true, workspaces: ["packages/*"] },
      { spaces: 2 },
    )

    const result = await execa(cli, [ cliScript, "--generate" ], { cwd, reject: false })

    expect(result.exitCode).toBe(0)

    await writeFile(workspaceFilePath, workspaceContent)
    await remove(path.join(globalThis.tmpRoot, "package.json"))
  })

  it("uses deno.json workspaces when others are missing", async () => {
    if (!globalThis.tmpRoot) {
      throw new Error("tmpRoot is not set")
    }

    const workspaceFilePath = path.join(globalThis.tmpRoot, "pnpm-workspace.yaml")
    const workspaceContent = await readFile(workspaceFilePath, "utf8")

    await remove(workspaceFilePath)
    await writeJson(
      path.join(globalThis.tmpRoot, "deno.json"),
      { workspaces: ["packages/*"] },
      { spaces: 2 },
    )

    const result = await execa(cli, [ cliScript, "--generate" ], { cwd, reject: false })

    expect(result.exitCode).toBe(0)

    await writeFile(workspaceFilePath, workspaceContent)
    await remove(path.join(globalThis.tmpRoot, "deno.json"))
  })

  it("returns 5 on unexpected error", async () => {
    if (!globalThis.tmpRoot) {
      throw new Error("tmpRoot is not set")
    }

    // Corrupt pkg-a package.json to trigger a parse error
    const packageJsonPath = path.join(globalThis.tmpRoot, "packages", "pkg-a", "package.json")
    const packageJsonContent = await readFile(packageJsonPath, "utf8")

    await writeFile(packageJsonPath, "{ invalid json }")
    const result = await execa(cli, [ cliScript, "--generate" ], { cwd, reject: false })

    expect(result.exitCode).toBe(5)

    await writeFile(packageJsonPath, packageJsonContent)
  })
})
