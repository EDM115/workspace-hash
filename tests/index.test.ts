import {
  copyFile,
  mkdirp,
  mkdtemp,
  pathExists,
  readFile,
  remove,
  writeFile,
  writeJson,
} from "fs-extra"
import os from "os"
import path from "path"

import { execa } from "execa"
import { describe, it, expect, beforeEach, afterEach } from "vitest"

describe("monorepo-hash CLI", () => {
  let tmpRoot: string

  beforeEach(async () => {
    tmpRoot = await mkdtemp(path.join(os.tmpdir(), "vitest-hash-"))
    const pnpmWorkspaceYaml = `
packages:
  - "packages/*"
`

    await writeFile(path.join(tmpRoot, "pnpm-workspace.yaml"), pnpmWorkspaceYaml.trim())

    const pkgADir = path.join(tmpRoot, "packages", "pkg-a")
    const pkgBDir = path.join(tmpRoot, "packages", "pkg-b")

    await mkdirp(pkgADir)
    await mkdirp(pkgBDir)

    await writeJson(
      path.join(pkgADir, "package.json"),
      {
        name: "pkg-a",
        version: "0.1.0",
        type: "module",
        dependencies: {
          // pkg-a depends on pkg-b (to test transitive hashing)
          "pkg-b": "workspace:^",
        },
      },
      { spaces: 2 },
    )

    await writeFile(
      path.join(pkgADir, "index.js"),
      "console.log(\"hello from pkg-a\")\n",
    )

    await writeJson(
      path.join(pkgBDir, "package.json"),
      {
        name: "pkg-b",
        type: "module",
        version: "0.1.0",
      },
      { spaces: 2 },
    )

    await writeFile(
      path.join(pkgBDir, "index.js"),
      "export const msg = \"pkg-b\"\n",
    )

    await copyFile(
      path.resolve(import.meta.dirname, "../dist/monorepo-hash.js"),
      path.join(tmpRoot, "monorepo-hash.js"),
    )
  })

  afterEach(async () => {
    if (tmpRoot && (await pathExists(tmpRoot))) {
      await remove(tmpRoot)
    }
  })

  it("generates .hash files for each workspace", async () => {
    const subprocess = execa("node", [ "monorepo-hash.js", "--generate" ], {
      cwd: tmpRoot,
      all: true,
    })

    const { exitCode } = await subprocess

    expect(exitCode).toBe(0)

    const hashAPath = path.join(tmpRoot, "packages", "pkg-a", ".hash")
    const hashBPath = path.join(tmpRoot, "packages", "pkg-b", ".hash")

    expect(await pathExists(hashAPath)).toBe(true)
    expect(await pathExists(hashBPath)).toBe(true)

    const hashA = (await readFile(hashAPath, "utf8")).trim()
    const hashB = (await readFile(hashBPath, "utf8")).trim()

    expect(hashA).toMatch(/^[0-9a-f]{64}$/)
    expect(hashB).toMatch(/^[0-9a-f]{64}$/)

    expect(hashA).not.toBe(hashB)

    // expect(hashA).toMatchSnapshot('pkg-a hash')
    // expect(hashB).toMatchSnapshot('pkg-b hash')
  })

  it("reports unchanged when no files changed, and exit code 0", async () => {
    await execa("node", [ "monorepo-hash.js", "--generate" ], { cwd: tmpRoot })

    const subprocess = execa("node", [ "monorepo-hash.js", "--compare" ], {
      cwd: tmpRoot,
      all: true,
      reject: false,
    })

    const { exitCode, stdout } = await subprocess

    expect(exitCode).toBe(0)

    const pkgAPath = path.join("packages", "pkg-a")
    const pkgBPath = path.join("packages", "pkg-b")

    expect(stdout).toContain("✅ Unchanged (2) :")
    expect(stdout).toContain(`• ${pkgAPath}`)
    expect(stdout).toContain(`• ${pkgBPath}`)
  })

  it("detects a file change and exits with non-zero, listing the changed workspace", async () => {
    await execa("node", [ "monorepo-hash.js", "--generate" ], { cwd: tmpRoot })

    const pkgBIndex = path.join(tmpRoot, "packages", "pkg-b", "index.js")

    await writeFile(pkgBIndex, "export const msg = \"pkg-b (edited)\"\n")

    const subprocess = execa("node", [ "monorepo-hash.js", "--compare" ], {
      cwd: tmpRoot,
      all: true,
      reject: false,
    })
    const { exitCode, stdout } = await subprocess

    expect(exitCode).toBe(1)

    expect(stdout).toContain("⚠️  Changed (2) :")

    const pkgAPath = path.join("packages", "pkg-a")
    const pkgBPath = path.join("packages", "pkg-b")

    expect(stdout).toContain(`• ${pkgBPath}`)
    expect(stdout).toContain(`• ${pkgAPath}`)
    expect(stdout).toMatch(/changed dependency/)

    const [ , changedBlock ] = stdout.split("⚠️  Changed")

    expect(changedBlock).toContain(pkgBPath)
    expect(changedBlock).toContain(pkgAPath)
  })

  it("reports \"Missing .hash\" if you delete a .hash and run --compare", async () => {
    await execa("node", [ "monorepo-hash.js", "--generate" ], { cwd: tmpRoot })

    const hashAPath = path.join(tmpRoot, "packages", "pkg-a", ".hash")

    await remove(hashAPath)

    const subprocess = execa("node", [ "monorepo-hash.js", "--compare" ], {
      cwd: tmpRoot,
      all: true,
      reject: false,
    })
    const { exitCode, stdout } = await subprocess

    expect(exitCode).toBe(1)

    const pkgAPath = path.join("packages", "pkg-a")

    expect(stdout).toContain("❓ Missing .hash files (1) :")
    expect(stdout).toContain(`• ${pkgAPath}`)
  })

  it("produces deterministic hashes across consecutive --generate runs", async () => {
    await execa("node", [ "monorepo-hash.js", "--generate" ], { cwd: tmpRoot })

    const hashAPath = path.join(tmpRoot, "packages", "pkg-a", ".hash")
    const hashBPath = path.join(tmpRoot, "packages", "pkg-b", ".hash")

    const firstA = (await readFile(hashAPath, "utf8")).trim()
    const firstB = (await readFile(hashBPath, "utf8")).trim()

    expect(firstA).toMatch(/^[0-9a-f]{64}$/)
    expect(firstB).toMatch(/^[0-9a-f]{64}$/)

    await remove(hashAPath)
    await remove(hashBPath)

    await execa("node", [ "monorepo-hash.js", "--generate" ], { cwd: tmpRoot })

    const secondA = (await readFile(hashAPath, "utf8")).trim()
    const secondB = (await readFile(hashBPath, "utf8")).trim()

    expect(secondA).toBe(firstA)
    expect(secondB).toBe(firstB)
  })
})
