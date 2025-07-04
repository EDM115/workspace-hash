import path from "node:path"

import {
  copyFile,
  mkdirp,
  pathExists,
  readFile,
  remove,
  writeFile,
  writeJson,
} from "fs-extra"
import { execa } from "execa"
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest"


describe("hash generation", () => {
  let cliScript: string
  let cwd: string
  let demoDir: string
  const cli = "node"

  beforeAll(async () => {
    cwd = globalThis.tmpRoot
    cliScript = path.join(cwd, "monorepo-hash.js")
    demoDir = path.join(cwd, "small-monorepo")

    // Scaffold a small 5-package monorepo
    await mkdirp(demoDir)
    const workspaceYaml = `
packages:
  - "packages/*"
  - "services/*"
  - "database"
`

    await writeFile(path.join(demoDir, "pnpm-workspace.yaml"), `${workspaceYaml.trim()}\n`)

    // database
    const db = path.join(demoDir, "database")

    await mkdirp(db)
    await writeJson(path.join(db, "package.json"), { name: "database", version: "0.1.0", type: "module" }, { spaces: 2 })
    await writeFile(path.join(db, "index.js"), "export const foo = \"db\"\n")

    // packages/linter
    const lint = path.join(demoDir, "packages", "linter")

    await mkdirp(lint)
    await writeJson(path.join(lint, "package.json"), { name: "linter", version: "0.1.0", type: "module" }, { spaces: 2 })
    await writeFile(path.join(lint, "index.js"), "export const lint = () => true\n")

    // packages/cli-tools
    const cliTools = path.join(demoDir, "packages", "cli-tools")

    await mkdirp(cliTools)
    await writeJson(path.join(cliTools, "package.json"), { name: "cli-tools", version: "0.1.0", type: "module" }, { spaces: 2 })
    await writeFile(path.join(cliTools, "index.js"), "export const run = () => {}\n")

    // services/backend depends on database, linter, cli-tools
    const backend = path.join(demoDir, "services", "backend")

    await mkdirp(backend)
    await writeJson(path.join(backend, "package.json"), {
      name: "backend",
      version: "0.1.0",
      type: "module",
      dependencies: {
        "database": "workspace:^",
        "linter": "workspace:^",
        "cli-tools": "workspace:^",
      },
    }, { spaces: 2 })
    await writeFile(path.join(backend, "index.js"), "export const serve = () => {}\n")

    // services/frontend depends on linter
    const frontend = path.join(demoDir, "services", "frontend")

    await mkdirp(frontend)
    await writeJson(path.join(frontend, "package.json"), {
      name: "frontend",
      version: "0.1.0",
      type: "module",
      dependencies: { linter: "workspace:^" },
    }, { spaces: 2 })
    await writeFile(path.join(frontend, "index.js"), "export const render = () => {}\n")

    await copyFile(path.join(globalThis.tmpRoot, "monorepo-hash.js"), path.join(demoDir, "monorepo-hash.js"))
  })

  afterAll(async () => {
    if (await pathExists(demoDir)) {
      await remove(demoDir)
    }
  })

  const pkgs = [
    "database",
    path.join("packages", "linter"),
    path.join("packages", "cli-tools"),
    path.join("services", "backend"),
    path.join("services", "frontend"),
  ]

  it("generates all hashes and matches snapshot", async () => {
    await execa(cli, [ cliScript, "--generate" ], { cwd: demoDir })

    const rootHashPath = path.join(demoDir, ".hash")
    const hashes = JSON.parse(await readFile(rootHashPath, "utf8")) as Record<string, string>

    expect(hashes).toMatchSnapshot()
  })

  it("generates hash for a single workspace", async () => {
    // clean up any existing .hash file
    const rootHashPath = path.join(demoDir, ".hash")
    if (await pathExists(rootHashPath)) {
      await remove(rootHashPath)
    }
    await execa(cli, [ cliScript, "--generate", "--target=packages/cli-tools" ], { cwd: demoDir })

    const hashes = JSON.parse(await readFile(rootHashPath, "utf8")) as Record<string, string>
    expect(Object.keys(hashes)).toEqual(["packages/cli-tools"]) 
  })

  it("produces the same hash for a workspace with transitive deps as in full generate", async () => {
    // full generate
    await execa(cli, [ cliScript, "--generate" ], { cwd: demoDir })
    const fullMap = JSON.parse(await readFile(path.join(demoDir, ".hash"), "utf8")) as Record<string, string>
    const full = fullMap["services/backend"]

    // remove root .hash
    await remove(path.join(demoDir, ".hash"))

    // partial generate
    await execa(cli, [ cliScript, "--generate", "--target=services/backend" ], { cwd: demoDir })
    const partialMap = JSON.parse(await readFile(path.join(demoDir, ".hash"), "utf8")) as Record<string, string>
    const partial = partialMap["services/backend"]

    expect(Object.keys(partialMap)).toEqual(["services/backend"])
    expect(partial).toBe(full)
  })
})
