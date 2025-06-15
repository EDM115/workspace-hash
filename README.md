<div align="center">

# monorepo-hash
**A CLI tool to generate hashes for the workspaces of your monorepo**

<img src="https://raw.githubusercontent.com/EDM115/monorepo-hash/refs/heads/master/images/attempt_6.png" alt="monorepo-hash logo" width="200" height="200">

![NPM Version](https://img.shields.io/npm/v/monorepo-hash) ![NPM Downloads](https://img.shields.io/npm/dt/monorepo-hash)  
![Dependent repos (via libraries.io)](https://img.shields.io/librariesio/dependent-repos/npm/monorepo-hash) ![Dependents (via libraries.io)](https://img.shields.io/librariesio/dependents/npm/monorepo-hash)  
![Libraries.io dependency status for latest release](https://img.shields.io/librariesio/release/npm/monorepo-hash) ![Libraries.io SourceRank](https://img.shields.io/librariesio/sourcerank/npm/monorepo-hash)

## :memo: Features
:runner: **Fast** : Runs in huge monorepos [in no time](#rocket-benchmarks), processes workspaces in parallel  
:dart: **Accurate** : Generates hashes based on every tracked file  
:left_right_arrow: **Complete** : Supports transitive workspace dependencies  
:ok_hand: **No config** : Drop-in and instantly usable  
:computer: **Cross-platform** : Works on Windows, Linux and macOS  
:hash: **Deterministic** : Same input, same output  
:package: **Lightweight** : No bloat, just the essentials

</div>

## :thinking: Why
When you're working with monorepos, there's often a lot of workspaces (packages) that end up being created.  
And as your project grows, so does the number of workspaces (and so does your build times...).  
If you ever worked with stuff like Next.js, you know what I'm talking about. And since every workspace requires another, you need everything to be built to test your changes.

Although there are tools that allow your scripts to run only when files have changed (ex `turbo`), the complete CI step cannot benefit from this. For example with `turbo` again, they allow you to prune just the right workspaces and dependencies when building in a Docker, but this requires copying the entire monorepo into the container so we can't benefit from Docker's layers caching.  
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
> [!TIP]  
> Make sure that the `packages` field in your `pnpm-workspace.yaml` file is set up correctly, as `monorepo-hash` will use it to find your workspaces. Globs are supported.  
> `monorepo-hash` will also use the `workspace:` field in your `package.json` files to detect transitive dependencies.  
> Finally, it will generate `.hash` files that you would need to keep in your VCS in order for it to be efficient (ex : to be reused in your CI).

### Get help
```bash
pnpm monorepo-hash --help
```
> [!TIP]  
> Short versions of all arguments are also available.

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
Same rules apply.
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
- in generate mode, output `.debug-hash` files which will contain the hashes of each individual file in the workspace as a JSON object
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
Tested in the [small monorepo](tests/demo/small-monorepo.7z), with the following directory structure :
```
.
├── database
├── packages
│   ├── cli-tools
│   └── linter
├── services
│   ├── backend
│   └── frontend
└── pnpm-workspace.yaml
```

<details><summary><h4>Hash generation</h4></summary>

```bash
$ pnpm monorepo-hash --generate
ℹ️  Generating hashes for all workspaces...

✅ Computed all hashes (5)

✅ services\backend (f4cc294c3165f90990c03a4285796f98555b35bcf845981710a92ce66c7166e3) written to .hash
✅ packages\linter (c3f5ddaafb7382c35fa1b8045955c56a9a8b03754ed2cf3021acc335093d7e0d) written to .hash
✅ packages\cli-tools (b85b9d51a1536c94094fb652e7e577e36ac154072d3de8e42f3b3eb81e669054) written to .hash
✅ services\frontend (d5be1221077403acfd888a60ed5e11c66a1394d6ae044fe026ca199093b81f9b) written to .hash
✅ database (adb587b8758d1a9066a1a479ce4da12765b5cf128f5538312a017af233f85adb) written to .hash
```

</details>

<details><summary><h4>Hash comparison - no changes</h4></summary>

```bash
$ pnpm monorepo-hash --compare
ℹ️  Comparing hashes for all workspaces...

✅ Computed all hashes (5)

✅ Unchanged (5) :
• database
• packages\linter
• packages\cli-tools
• services\backend
• services\frontend
```

</details>

<details><summary><h4>Hash comparison - changes detected</h4></summary>

```bash
$ pnpm monorepo-hash --compare
ℹ️  Comparing hashes for all workspaces...

✅ Computed all hashes (5)

⚠️  Changed (5) :
• database
        old : adb587b8758d1a9066a1a479ce4da12765b5cf128f5538312a017af233f85adb
        new : c1ef17109f6a0b830d2c071934df47454b87389100cf573d918afca3f0958a6e
        🚧 changed dependency(s) :
                • packages\linter
• packages\linter
        old : c3f5ddaafb7382c35fa1b8045955c56a9a8b03754ed2cf3021acc335093d7e0d
        new : b12603b6d38b7bbf1c1ecea354e7e7bf5f7dc4ea42665e4935343d6f7c8b6ec9
• packages\cli-tools
        old : b85b9d51a1536c94094fb652e7e577e36ac154072d3de8e42f3b3eb81e669054
        new : f161ac1745e45054fa6123969f7cf08a818c1096b109d82b553d27551031d987
        🚧 changed dependency(s) :
                • packages\linter
• services\backend
        old : f4cc294c3165f90990c03a4285796f98555b35bcf845981710a92ce66c7166e3
        new : d27dc39124bef0de217d630ad891f79227780beda86893dca9ed5ff82fb06827
        🚧 changed dependency(s) :
                • packages\linter
                • database
                • packages\cli-tools
• services\frontend
        old : d5be1221077403acfd888a60ed5e11c66a1394d6ae044fe026ca199093b81f9b
        new : 36ffd97f62ab83a109f28549d3f23754e5e6d10a357f83ac76f63c6fec093efc
        🚧 changed dependency(s) :
                • packages\linter
```

</details>

<details><summary><h4>Hash comparison - missing hashes</h4></summary>

```bash
$ pnpm monorepo-hash --compare
ℹ️  Comparing hashes for all workspaces...

✅ Computed all hashes (5)

✅ Unchanged (4) :
• packages\linter
• packages\cli-tools
• services\backend
• services\frontend

❓ Missing .hash files (1) :
• database (would be f1d150816fef2890b2a0121f6267863a0f0efab59f5008f266d07a6045f60774)
```

</details>

<details><summary><h4>Hash generation - specific workspaces</h4></summary>

```bash
$ pnpm monorepo-hash --generate --target="packages/cli-tools,services/frontend"
ℹ️  Generating hashes for specified targets... (packages\cli-tools, services\frontend)

✅ Computed all hashes (3)

✅ packages\cli-tools (f161ac1745e45054fa6123969f7cf08a818c1096b109d82b553d27551031d987) written to .hash
✅ services\frontend (36ffd97f62ab83a109f28549d3f23754e5e6d10a357f83ac76f63c6fec093efc) written to .hash
```

</details>

<details><summary><h4>Hash comparison - specific workspaces - no changes</h4></summary>

```bash
$ pnpm monorepo-hash --compare --target="packages/cli-tools,services/frontend"
ℹ️  Comparing hashes for specified targets... (packages\cli-tools, services\frontend)

✅ Computed all hashes (3)

✅ Unchanged (2) :
• packages\cli-tools
• services\frontend
```

</details>

<details><summary><h4>Hash comparison - specific workspaces - changes detected</h4></summary>

```bash
$ pnpm monorepo-hash --compare --target="services/backend"
ℹ️  Comparing hashes for specified targets... (services\backend)

✅ Computed all hashes (4)

⚠️  Changed (1) :
• services\backend
        old : f4cc294c3165f90990c03a4285796f98555b35bcf845981710a92ce66c7166e3
        new : 8d61651bdb6f3219625bf910019ddfec0d32257f025f4c8f7f1018115287ae11
        🚧 changed dependency(s) :
                • packages\cli-tools
```

</details>

### Usage in CI
This was the main reason I created this tool, and whether it's in GitHub Actions or locally through [act](https://github.com/nektos/act), it can help you to reduce drastically CI times.  

<details><summary><h4>Here's an example workflow that uses `monorepo-hash` to only build the workspaces that have changed :</h4></summary>

```yaml
# The boring stuff

jobs:
  build-and-test:
    runs-on: ubuntu-22.04
    defaults:
      run:
        shell: bash
    env:
      IMAGE_TAG: "demo-${{ github.sha }}"
    strategy:
      fail-fast: false
      matrix:
        node-version: [22]

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Setup pnpm
        uses: pnpm/action-setup@v4

      - name: Use Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: "pnpm"

      - name: Install dependencies
        run: pnpm i --frozen-lockfile

      - name: Restore .hash cache
        id: restore-hash-cache
        uses: actions/cache@v4
        with:
          path: |
            **/.hash
          key: hash-files-${{ runner.os }}-pnpm-${{ hashFiles('**/pnpm-lock.yaml') }}
          restore-keys: |
            hash-files-${{ runner.os }}-pnpm-

      - name: Force rebuild if no cache has been found
        if: steps.restore-hash-cache.outputs.cache-hit == ''
        run: rm -fr **/.hash

      - name: Check if workspace-name is unchanged
        id: check-workspace-name
        run: |
          # These 2 lines are useful only if you use act, as a way to ensure the images are built if not present
          # WORKSPACENAME_DOCKER_EXISTS=$(docker images -q username/workspace-name:${{ env.IMAGE_TAG }} | wc -l)
          # echo "WORKSPACENAME_DOCKER_EXISTS=$WORKSPACENAME_DOCKER_EXISTS" >> ${GITHUB_OUTPUT}
          set +e
          pnpm monorepo-hash --compare --target="services/workspace-name"
          EXIT_CODE=$?
          echo "WORKSPACENAME_HASH_EXIT_CODE=$EXIT_CODE" >> ${GITHUB_OUTPUT}

      # Do this as much as needed for your workspaces

      - name: Build the workspace-name Docker image
        if: steps.check-workspace-name.outputs.WORKSPACENAME_HASH_EXIT_CODE != '0'
        # act version :
        # if: (steps.check-workspace-name.outputs.WORKSPACENAME_HASH_EXIT_CODE != '0' || steps.check-workspace-name.outputs.WORKSPACENAME_DOCKER_EXISTS == '0')
        uses: docker/build-push-action@v6
        with:
          context: .
          file: services/workspace-name/Dockerfile
          tags: username/workspace-name:${{ env.IMAGE_TAG }}
          load: true

      # Build things and test them

      - name: Ensure hash files are up to date
        run: |
          pnpm monorepo-hash --generate

      - name: Save .hash cache
        uses: actions/cache@v4
        with:
          path: |
            **/.hash
          key: hash-files-${{ runner.os }}-pnpm-${{ hashFiles('**/pnpm-lock.yaml') }}
          restore-keys: |
            hash-files-${{ runner.os }}-pnpm-
```

</details>

Here we use the actions cache to store the `.hash` files, so that we can reuse them in the next runs.  
This is especially useful because when you generate hashes, the action will pick them up from the latest commit and not the latest run.  
For the very first run, you might need to create a workflow which will only checkout and save the .hash files in a cache for future runs.

## :construction: Limitations
- Only works with `PNPM` for now  
  If you really need support for `Yarn` or `NPM`, feel free to open an issue or even submit a pull request !
- Bases the transitive dependency detection on the `workspace:` field in the `package.json` files
- If you use another Version Control System than `git`, we can't ignore your files correctly for the hashes generation
- Your EOL (End of Line) should be consistent across your monorepo's files and the different environments it's being used in. Since Docker containers and GitHub Actions runners are based on Linux, it's recommended to use `LF` as EOL.  
  I recommend to set this up in your IDE and formatter config.

## :rocket: Benchmarks
These benchmarks have been realised on Standard GitHub-hosted runner that you can get by running any Action.  
The specs as I'm wroting this are an AMD EPYC 7763 64-Core CPU, 15Gi of RAM and 72G of SSD storage.  
They have been reproduced 10 times thanks to [hyperfine](https://github.com/sharkdp/hyperfine).  
> [!NOTE]  
> Here are the details of each demo monorepo used for the benchmarks :
> - **Small monorepo** : 5 workspaces of 100 files each, files composed of 1 line of text
> - **Medium monorepo** : 5 workspaces of 100 folders each, with each folder containing 100 files, files composed of 10 lines of text
> - **Large monorepo** : 5 workspaces of 100 folders each, with each folder containing 10 files and 10 folders, and each of these folders containing 100 files, files composed of 100 lines of text  
>
> In order to not clunk up Git, these [demo repos](./tests/demo/) are compressed.  
> Symbols :
> - :chart_with_upwards_trend: : Faster than the previous version
> - :chart_with_downwards_trend: : Slower than the previous version
> - :balance_scale: : No change in performance compared to the previous version

| Version                               | Small        | Medium      | Large        |
| :------------------------------------ | :----------- | :---------- | :----------- |
| `v1.3.1` :chart_with_downwards_trend: | **152.1 ms** | **4.223 s** | **88.359 s** |
| `v1.3.0` :chart_with_upwards_trend:   | 150.3 ms     | 4.142 s     | 87.462 s     |
| `v1.2.0` :chart_with_downwards_trend: | 152.9 ms     | 4.301 s     | 89.989 s     |
| `v1.1.0` :balance_scale:              | 116.3 ms     | 3.439 s     | 35.914 s     |
| `v1.0.0` :chart_with_upwards_trend:   | 115.1 ms     | 3.422 s     | 35.928 s     |

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

## :eyes: Who uses `monorepo-hash` ?
- [Nexelec](https://nexelec.eu)

If you use `monorepo-hash` in your project(s), whether you're an individual or a company, please let me know by opening an issue or a pull request, and I'll add you to this list !

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
