<div align="center">

# monorepo-hash
**A CLI tool to generate hashes for the workspaces of your monorepo**

<img src="./monorepo-hash-logo.png" alt="monorepo-hash logo" width="200" height="200">

![NPM Version](https://img.shields.io/npm/v/monorepo-hash) ![NPM Downloads](https://img.shields.io/npm/dt/monorepo-hash) ![jsDelivr hits (npm)](https://img.shields.io/jsdelivr/npm/hm/monorepo-hash)  
![Dependent repos (via libraries.io)](https://img.shields.io/librariesio/dependent-repos/npm/monorepo-hash) ![Dependents (via libraries.io)](https://img.shields.io/librariesio/dependents/npm/monorepo-hash)  
![Libraries.io dependency status for latest release](https://img.shields.io/librariesio/release/npm/monorepo-hash) ![Libraries.io SourceRank](https://img.shields.io/librariesio/sourcerank/npm/monorepo-hash)

## :memo: Features
:runner: **Fast** : Runs in huge monorepos [in no time](#rocket-benchmarks), processes workspaces in parallel  
:dart: **Accurate** : Generates hashes based every tracked file  
:left_right_arrow: **Complete** : Supports transitive workspace dependencies  
:ok_hand: **No config** : Drop-in and instantly usable  
:computer: **Cross-platform** : Works on Windows, Linux and macOS  
:hash: **Deterministic** : Same input, same output  
:package: **Lightweight** : No bloat, just the essentials

</div>

## :thinking: Why
When you're working in monorepos, there's often a lot of workspaces (packages) that end up being created.  
And as your project grows, so does the number of workspaces (and so does your build times...).  
If you ever worked with stuff like Next.js, you know what I'm talking about. And since every workspace requires another, you need everything to be built to test your changes.

Although there are tools that allows your scripts to run only when files have changed (ex `turbo`), the complete CI step cannot benefit from this. For example with `turbo` again, they allow you to prune just the right workspaces and dependencies when building in a Docker, but this requires to copy the entire monorepo into the container so we can't benefit from Docker's layers caching.  
If only there could be a way to determine if a workspace hasn't changed to not rebuild it for nothing...

Well lucky you, `monorepo-hash` is here to help with that !

> [!NOTE]
> `monorepo-hash` was created when I was doing my internship at Nexelec.  
> I really put a lot of energy in this script so I decided to release `monorepo-hash` as a standalone CLI tool to help anyone struggling with this problem !

## :beginner: Usage
### Installation
You can install `monorepo-hash` globally, but it's best to add it as a dev dependency at the root of your monorepo :
```bash
pnpm add -D monorepo-hash
```
Make sure that the `packages` field in your `pnpm-workspace.yaml` file is set up correctly, as `monorepo-hash` will use it to find your workspaces. Globs are supported.  
`monorepo-hash` will also use the `workspace:` field in your `package.json` files to detect transitive dependencies.  
Finally, it will generate `.hash` files that you would need to keep in your VCS in order for it to be efficient (ex : to be reused in your CI).

### Get help
```bash
pnpm monorepo-hash --help
```
Short versions of all arguments are also available.

### Generate hashes for your entire monorepo
```bash
pnpm monorepo-hash --generate
```

### Generate hashes for specific workspaces
Specify them in quotes, separated by commas, no spaces, and with no leading or trailing slashes.  
The target name is the path to the workspace relative to the root of your monorepo, and uses forward slashes no matter your platform.
```bash
pnpm monorepo-hash --generate --target="packages/example,services/ui"
```

### Compare hashes
```bash
pnpm monorepo-hash --compare
```

### Compare hashes for specific workspaces
Same as above.
```bash
pnpm monorepo-hash --compare --target="packages/example"
```

### Run in silent mode
This will suppress all output except for errors. This can be useful for example in CI where only the exit code matters.
```bash
pnpm monorepo-hash --compare --silent
```

### Run in debug mode
The debug mode will :
- in generate mode, output `.debug-hash` files which will contain the hashes of each individual file in the workspace
- in compare mode, read those `.debug-hash` files and tell you *exactly* which files have changed in each workspace, and what their hashes are  
This can be useful to check why the hashes appear to be different, or to debug issues with the hashes generation.
```bash
pnpm monorepo-hash --generate --debug
# later on...
pnpm monorepo-hash --compare --debug
```
Don't forget to delete these files afterwards !

### Exit codes
- `0` : No changes detected (or you wanted to get help)
- `1` : Changes detected in the hashes
- `2` : Error with the arguments (either `--generate` or `--compare` is missing, or both were provided)
- `3` : Unknown arguments provided
- `4` : No workspaces found, either the `pnpm-workspace.yaml` file is missing or the `packages` field is not set up correctly
- `5` : An unexpected error occurred, please open an issue with the logs

## :test_tube: Examples
### Outputs

### Usage in CI

## :construction: Limitations
- Only works with `PNPM` for now  
  If you really need support for `Yarn` or `NPM`, feel free to open an issue or even submit a pull request !
- Bases the transitive dependency detection on the `workspace:` field in the `package.json` files
- If you use another Version Control System than `git`, we can't ignore your files correctly for the hashes generation
- Your EOL (End of Line) should be consistent accross your files and the different environements it's being used on. Since Docker containers and GitHub Actions runners are based on Linux, it's recommended to use `LF` as EOL.  
  I recommend to set this up in your IDE config and for your formatter.

## :hammer_and_wrench: Contributing
Here's a quick guide for contributing to `monorepo-hash` :
1. Fork the repository (and star it :wink:)
2. Clone your fork
  ```bash
  git clone https://github.com/USERNAME/monorepo-hash.git
  cd monorepo-hash
  pnpm i
  ```
3. Do your changes
4. Test your changes  
  Feel free to add tests to the `tests` directory.
  ```bash
  pnpm run test
  ```
5. Commit your changes
6. Open a pull request

## :money_with_wings: Donate
I'm a young developer from France, and as I write this I'm actively seeking for a job.  
If you want to support me, here's how you can do it :
- Star this repository
- Follow me on [GitHub](https://github.com/EDM115)
- Donate :
  - [PayPal](https://paypal.me/8EDM115)
  - [GitHub Sponsors](https://github.com/sponsors/EDM115)
  - [BuyMeACoffee](https://www.buymeacoffee.com/EDM115)
  - [Donate on Telegram](https://t.me/EDM115bots/698)

## :scroll: License
`monorepo-hash` is licensed under the [MIT License](https://github.com/EDM115/monorepo-hash/blob/master/LICENSE)
