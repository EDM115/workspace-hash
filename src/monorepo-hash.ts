#!/usr/bin/env node --experimental-strip-types --no-warnings=ExperimentalWarning

/**
 * hash.ts
 *
 * Usage :
 *   # generate/update all .hash files
 *   monorepo-hash --generate
 *
 *   # compare current vs existing .hash for ALL workspaces
 *   monorepo-hash --compare
 *
 *   # generate only for services/backend-admin
 *   monorepo-hash -g --target="services/backend-admin"
 *
 *   # compare only for services/backend-admin and packages/node
 *   monorepo-hash -c -t="services/backend-admin,packages/node"
 *
 *   # enable debug mode (per-file hashes)
 *   monorepo-hash -g --debug
 *   monorepo-hash -c -d
 */

import type { PathLike } from "node:fs"

import fs from "node:fs/promises"
import path from "node:path"
import crypto from "node:crypto"

import fg from "fast-glob"
import { findUp } from "find-up"
import ignore from "ignore"
import yaml from "js-yaml"

type PnpmWorkspaceConfig = { packages?: string[] }

interface PackageInfo {
  dir: string
  relDir: string
  deps: string[]
  perFileHashes: Record<string, string>
  ownHash?: Buffer
}

// Parse CLI flags
const argv = process.argv.slice(2)

let mode: string | null = null
let targets: string[] | null = null
let silent = false
let debug = false

for (const arg of argv) {
  if (arg === "--generate" || arg === "-g") {
    if (mode === "compare") {
      console.error("❌ Cannot specify both --generate and --compare")
      process.exit(1)
    }

    mode = "generate"
  } else if (arg === "--compare" || arg === "-c") {
    if (mode === "generate") {
      console.error("❌ Cannot specify both --generate and --compare")
      process.exit(1)
    }

    mode = "compare"
  } else if (arg.startsWith("--target=") || arg.startsWith("-t=")) {
    const [ , val ] = arg.split("=")

    targets = val.split(",").map((p) => p.replace(/\/+$/, ""))
  } else if (arg === "--silent" || arg === "-s") {
    silent = true
  } else if (arg === "--debug" || arg === "-d") {
    debug = true
  } else if (arg === "--help" || arg === "-h") {
    console.log(`
A simple script to generate or compare .hash files for pnpm workspaces.
The goal is to help not rebuild Docker containers when nothing changed.

Arguments :
  --generate (-g)          Generate or update .hash files for all workspaces.
  --compare (-c)           Compare current state with existing .hash files. Capture the exit code to check for changes.
  --target="<path>" (-t)   Specify one or more targets to generate/compare (comma-separated).
  --silent (-s)            Suppress output messages.
  --debug (-d)             Enable debug mode (per-file hashes).
  --help (-h)              Show this help message.
`)

    process.exit(0)
  } else {
    console.error(`❌ Unknown option : ${arg}`)

    process.exit(1)
  }
}

function log(message: string, overwrite = false) {
  if (!silent) {
    if (
      overwrite
      && process.stdout.isTTY
      && typeof process.stdout.clearLine === "function"
      && typeof process.stdout.cursorTo === "function"
    ) {
      process.stdout.clearLine(0)
      process.stdout.cursorTo(0)
      process.stdout.write(message)
    } else {
      console.log(message)
    }
  }
}

async function exists(f: PathLike): Promise<boolean> {
  try {
    await fs.stat(f)

    return true
  } catch {
    return false
  }
}

function zeroPad(num: number, places: number) {
  return String(num).padStart(places, "0")
}

/**
 * Given a workspace directory (`dir`) and its repo-relative path (`relDir`), return a sorted array of all file-relative paths (using OS-specific separators), after applying root and package‐level .gitignore filters.
 */
async function getWorkspaceFileList(
  dir: string,
  relDir: string,
  rootIgnore: ignore.Ignore,
): Promise<string[]> {
  // Gather all files under `dir`
  const rawFiles = await fg("**/*", { cwd: dir, onlyFiles: true, dot: true })

  // Convert to POSIX paths for consistent processing
  const posixFiles = rawFiles.map((f) => f.split(path.sep).join("/"))
  const repoPaths = posixFiles.map((f) => path.posix.join(relDir, f))

  // 1) Apply root .gitignore
  const rootFiltered = rootIgnore.filter(repoPaths)

  // 2) Apply package‐level .gitignore if present
  const pkgIgnore = ignore()
  const pkgGit = path.join(dir, ".gitignore")

  if (await exists(pkgGit)) {
    const pkgContents = await fs.readFile(pkgGit, "utf8")

    pkgIgnore.add(pkgContents)
  }
  // Always ignore .hash and .debug-hash
  pkgIgnore.add(".hash")
  pkgIgnore.add(".debug-hash")

  // Convert back to package‐relative POSIX paths
  const pkgRelativePOSIX = rootFiltered.map((rp) => path.posix.relative(relDir, rp))
  const pkgFilteredPOSIX = pkgIgnore.filter(pkgRelativePOSIX)

  // Convert to OS‐specific separators and sort
  return pkgFilteredPOSIX.map((f) => f.split("/").join(path.sep)).sort()
}

/**
 * For a given `dir` and list of relative file paths (`fileList`), compute per-file SHA-256 on (normalizedPath + rawContent).
 * Always returns a map : { "posix/rel/path": "hex" }
 */
async function computePerFileHashes(
  dir: string,
  fileList: string[],
): Promise<Record<string, string>> {
  const map: Record<string, string> = {}

  for (const rel of fileList) {
    const fullPath = path.join(dir, rel)
    const normalized = rel.split(path.sep).join("/")
    const content = await fs.readFile(fullPath)
    const fileHash = crypto
      .createHash("sha256")
      .update(normalized)
      .update(content)
      .digest("hex")

    map[normalized] = fileHash
  }

  return map
}

/**
 * Given a per-file‐hash map and its sorted keys, produce the "ownHash" Buffer by concatenating each raw hash‐buffer (in sorted key order) and feeding them into a SHA-256.
 */
function computeOwnHashFromPerFile(
  perFileMap: Record<string, string>,
  sortedKeys: string[],
): Buffer {
  const h = crypto.createHash("sha256")

  for (const key of sortedKeys) {
    // Each entry in perFileMap[key] is a hex string, convert to Buffer
    const raw = Buffer.from(perFileMap[key], "hex")

    h.update(raw)
  }

  return h.digest()
}

/**
 * Recursively compute the final (aggregate) hash for `pkgName`, given a map of all PackageInfo, storing ownHash as Buffer.
 */
function computeFinalHash(
  pkgName: string,
  pkgs: Record<string, PackageInfo>,
  cache: Record<string, string>,
): string {
  if (cache[pkgName]) {
    return cache[pkgName]
  }

  const pkg = pkgs[pkgName]

  if (!pkg.ownHash) {
    throw new Error(`ownHash missing for package ${pkgName}`)
  }

  // Start the chain
  let chain = crypto.createHash("sha256").update(pkg.ownHash)

  // Then incorporate each dependency's final hash (as Buffer)
  for (const dep of pkg.deps) {
    const depHex = computeFinalHash(dep, pkgs, cache)
    const depBuf = Buffer.from(depHex, "hex")

    chain = chain.update(depBuf)
  }

  const finalHex = chain.digest("hex")

  cache[pkgName] = finalHex

  return finalHex
}

/**
 * Write a JSON‐serialized debug map to `.debug-hash` in `dir`
 */
async function writeDebugFile(
  dir: string,
  debugMap: Record<string, string>,
): Promise<void> {
  const debugPath = path.join(dir, ".debug-hash")

  await fs.writeFile(debugPath, JSON.stringify(debugMap, null, 2), "utf8")
}

/**
 * Load the existing `.debug-hash` JSON from `dir`, if present.
 * Otherwise returns null.
 */
async function loadDebugFile(dir: string): Promise<Record<string, string> | null> {
  const debugPath = path.join(dir, ".debug-hash")

  if (!(await exists(debugPath))) {
    return null
  }

  const text = await fs.readFile(debugPath, "utf8")

  return JSON.parse(text) as Record<string, string>
}

// Normalize targets from forward-slash to platform-specific separators
if (targets) {
  targets = targets.map((t) => t.replace(/\/+$/, "").split("/").join(path.sep))
}

if (!mode) {
  console.error("❌ Must specify either --generate (-g) or --compare (-c)")

  process.exit(1)
} else {
  if (mode === "generate") {
    if (targets) {
      log(`ℹ️  Generating hashes for specified targets... (${targets.join(", ")})\n`)
    } else {
      log("ℹ️  Generating hashes for all workspaces...\n")
    }
  } else {
    if (targets) {
      log(`ℹ️  Comparing hashes for specified targets... (${targets.join(", ")})\n`)
    } else if (targets === null) {
      log("ℹ️  Comparing hashes for all workspaces...\n")
    }
  }

  if (debug) {
    log("ℹ️  Debug mode enabled\n")
  }
}

// Load pnpm-workspace.yaml
const wsYaml = await findUp("pnpm-workspace.yaml")

if (!wsYaml || !(await exists(wsYaml))) {
  console.error("❌ pnpm-workspace.yaml not found")

  process.exit(1)
}

const repoRoot = path.dirname(wsYaml)

const wsConfig = yaml.load(await fs.readFile(wsYaml, "utf8")) as PnpmWorkspaceConfig
const workspaceGlobs: string[] = Array.isArray(wsConfig.packages)
  ? wsConfig.packages
  : []

if (workspaceGlobs.length === 0) {
  console.error("❌ No \"packages:\" entries in pnpm-workspace.yaml")

  process.exit(1)
}

// Compile root .gitignore
let rootIgnore = ignore()
const rootGit = path.join(repoRoot, ".gitignore")

if (await exists(rootGit)) {
  const rootGitContents = await fs.readFile(rootGit, "utf8")

  rootIgnore = ignore().add(rootGitContents)
  // Ignore hashes
  rootIgnore.add("**/.hash")
  rootIgnore.add("**/.debug-hash")
}

async function hash() {
  // 1) find every workspace's package.json
  const pkgJsonPaths = await fg(
    workspaceGlobs.map((glob) => path.posix.join(glob, "package.json")),
    { onlyFiles: true, dot: true },
  )

  // 2) build PackageInfo objects
  const pkgs: Record<string, PackageInfo> = {}

  const total = pkgJsonPaths.length
  let count = 0

  // 3) compute per-file hashes and ownHash buffers
  for (const pkgJson of pkgJsonPaths) {
    count++
    log(
      `\r🔄 Computing hashes (${zeroPad(count, 2)}/${total}) • ${
        pkgJson.split("/package.json")[0]
      }`,
      true,
    )

    const absJson = path.resolve(repoRoot, pkgJson)
    const dir = path.dirname(absJson)
    const relDir = path.relative(repoRoot, dir)

    const pkgData = JSON.parse(await fs.readFile(absJson, "utf8"))
    const pkgName: string = pkgData.name

    // Get file list after ignores
    const fileList = await getWorkspaceFileList(dir, relDir, rootIgnore)

    // Compute per-file hashes
    const perFileMap = await computePerFileHashes(dir, fileList)

    // Compute ownHash from per-file hashes
    const sortedPOSIXKeys = Object.keys(perFileMap).sort()
    const ownBuffer = computeOwnHashFromPerFile(perFileMap, sortedPOSIXKeys)

    if (debug) {
      await writeDebugFile(dir, perFileMap)
    }

    // Store PackageInfo (without deps yet)
    pkgs[pkgName] = {
      dir,
      relDir,
      deps: [],
      perFileHashes: perFileMap,
      ownHash: ownBuffer,
    }
  }

  log(`\r✅ Computed all hashes (${total})`, true)
  log("\n")

  // 3) resolve internal deps for all pkgs (even those not in targets, since they might be needed for recursive hashing)
  for (const { dir } of Object.values(pkgs)) {
    const manifest = JSON.parse(await fs.readFile(path.join(dir, "package.json"), "utf8"))
    const allDeps = {
      ...manifest.dependencies,
      ...manifest.devDependencies,
      ...manifest.peerDependencies,
    }

    pkgs[manifest.name].deps = Object.keys(allDeps)
      .filter((d) => pkgs[d])
      .sort()
  }

  // 4) recursively compute final hash (aggregate)
  const finalCache: Record<string, string> = {}

  for (const pkgName of Object.keys(pkgs)) {
    computeFinalHash(pkgName, pkgs, finalCache)
  }

  // 5) perform generate or compare
  if (mode === "generate") {
    for (const [ name, { dir, relDir }] of Object.entries(pkgs)) {
      // If the user passed --target, only write those relDirs
      if (targets && !targets.includes(relDir)) {
        continue
      }

      const current = finalCache[name]
      const hashPath = path.join(dir, ".hash")

      // Write .hash
      await fs.writeFile(hashPath, current)
      log(`✅ ${relDir} (${current}) written to .hash`)
    }
  } else {
    // 1) figure out exactly which workspaces have changed without filtering by targets
    const allChanged: string[] = []
    const allMissing: string[] = []

    for (const [ pkgName, info ] of Object.entries(pkgs)) {
      const currentHex = finalCache[pkgName]
      const hashPath = path.join(info.dir, ".hash")

      if (!(await exists(hashPath))) {
        allMissing.push(pkgName)
      } else {
        const oldHex = (await fs.readFile(hashPath, "utf8")).trim()

        if (oldHex !== currentHex) {
          allChanged.push(pkgName)
        }
      }
    }

    // 2) build a quick adjacency map from packageName to its internal deps
    const adjacency: Record<string, string[]> = {}

    for (const [ name, info ] of Object.entries(pkgs)) {
      // deps only includes other workspaces
      adjacency[name] = info.deps.slice()
    }

    // 3) given a pkgName, returns the set of all workspace names it (transitively) depends on
    const transitiveDepsCache: Record<string, Set<string>> = {}

    function getTransitiveDeps(pkgName: string): Set<string> {
      if (transitiveDepsCache[pkgName]) {
        return transitiveDepsCache[pkgName]
      }

      const visited = new Set<string>()
      const stack = [ ...adjacency[pkgName] ]

      while (stack.length > 0) {
        const dep = stack.pop()!

        if (!visited.has(dep)) {
          visited.add(dep)
          // push that dep's deps, too
          ;(adjacency[dep] || []).forEach((d) => {
            if (!visited.has(d)) {
              stack.push(d)
            }
          })
        }
      }

      transitiveDepsCache[pkgName] = visited

      return visited
    }

    // 4) prepare three lists (but only for targets) :
    // - unchangedTargets (requested targets whose hash == .hash on disk, AND no changed deps)
    // - changedTargets (requested targets whose own-hash differs OR who have changed deps)
    // - missingTargets (requested targets with no .hash file on disk)
    // and for each changedTarget we'll also gather exactly which of its transitiveDeps appear in allChanged
    const unchangedTargets: string[] = []
    const changedTargets: Array<{
      name: string
      oldHash: string
      newHash: string
      changedDeps: string[]
    }> = []
    const missingTargets: Array<{ name: string; newHash: string }> = []

    // We need a map pkgName to oldHash so we can report old when it changed
    const oldHashMap: Record<string, string> = {}

    for (const [ pkgName, info ] of Object.entries(pkgs)) {
      const hashPath = path.join(info.dir, ".hash")

      if (await exists(hashPath)) {
        oldHashMap[pkgName] = (await fs.readFile(hashPath, "utf8")).trim()
      }
    }

    // 5) finally, iterate only over the workspaces the user asked for
    const toCheck = targets
      ? Object.entries(pkgs).filter(([ , info ]) => targets.includes(info.relDir))
      : Object.entries(pkgs)

    for (const [ pkgName, info ] of toCheck) {
      const newHash = finalCache[pkgName]
      const hashPath = path.join(info.dir, ".hash")

      if (!(await exists(hashPath))) {
        missingTargets.push({ name: info.relDir, newHash })
        continue
      }

      const oldHash = oldHashMap[pkgName]!

      if (oldHash !== newHash) {
        const transDeps = getTransitiveDeps(pkgName)
        const depsChanged = Array.from(transDeps).filter((d) => allChanged.includes(d))

        changedTargets.push({
          name: info.relDir,
          oldHash,
          newHash,
          changedDeps: depsChanged.map((d) => pkgs[d].relDir),
        })
      } else {
        const transDeps = getTransitiveDeps(pkgName)
        const depsChanged = Array.from(transDeps).filter((d) => allChanged.includes(d))

        if (depsChanged.length > 0) {
          changedTargets.push({
            name: info.relDir,
            oldHash,
            newHash,
            changedDeps: depsChanged.map((d) => pkgs[d].relDir),
          })
        } else {
          unchangedTargets.push(info.relDir)
        }
      }

      // If debug AND there's an existing .debug-hash, compare per-file maps
      if (debug) {
        const oldDebug = await loadDebugFile(info.dir)

        if (oldDebug) {
          // We already have info.perFileHashes from the generate pass
          const newDebug = info.perFileHashes!
          const diverged: string[] = []

          // Collect all keys from old and new
          for (const key of new Set([
            ...Object.keys(oldDebug),
            ...Object.keys(newDebug),
          ])) {
            if (oldDebug[key] !== newDebug[key]) {
              diverged.push(key)
            }
          }

          if (diverged.length > 0) {
            log(`⚠️ <debug> ${info.relDir} diverging files :`)
            diverged.forEach((f) => log(`  • ${f}`))
            log("")
          }
        } else {
          log(`❓ <debug> ${info.relDir} has no .debug-hash to compare`)
          log("")
        }
      }
    }

    // Display results grouped by category
    if (unchangedTargets.length > 0) {
      log(`✅ Unchanged (${unchangedTargets.length}) :`)
      unchangedTargets.forEach((r) => log(`• ${r}`))
      log("")
    }

    if (changedTargets.length > 0) {
      log(`⚠️  Changed (${changedTargets.length}) :`)

      for (const { name, oldHash, newHash, changedDeps } of changedTargets) {
        log(`• ${name}`)
        log(`\told : ${oldHash}`)
        log(`\tnew : ${newHash}`)

        if (changedDeps.length > 0) {
          log("\t🚧 changed dependency(s) :")
          changedDeps.forEach((d) => log(`\t\t• ${d}`))
        }
      }

      log("")
    }

    if (missingTargets.length > 0) {
      log(`❓ Missing .hash files (${missingTargets.length}) :`)
      missingTargets.forEach(({ name, newHash }) => log(`• ${name} (would be ${newHash})`))
      log("")
    }

    if (
      mode === "compare"
      && (changedTargets.length > 0 || missingTargets.length > 0)
    ) {
      process.exit(1)
    }
  }
}

try {
  await hash()
} catch (err) {
  console.error("❌ Unexpected error :")
  console.error(err instanceof Error ? err.message : String(err))
  process.exit(1)
}
