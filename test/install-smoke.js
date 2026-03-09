const assert = require('assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFileSync } = require('child_process')

const rootDir = path.resolve(__dirname, '..')
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'node-jdbc-install-'))
const npmCacheDir = path.join(tempDir, '.npm-cache')
const packDir = path.join(tempDir, 'packs')

let tarballPath = null
const dependencyTarballs = {}

function runNpm (args, cwd, options = {}) {
  return execFileSync(npmCommand, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      npm_config_cache: npmCacheDir
    },
    ...options
  })
}

try {
  fs.mkdirSync(packDir)
  runNpm(['run', 'build'], rootDir)

  tarballPath = packPackage(rootDir)

  for (const dependencyName of ['bluebird', 'debug', 'lodash', 'ms']) {
    dependencyTarballs[dependencyName] = packPackage(path.join(rootDir, 'node_modules', dependencyName))
  }

  fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify({
    name: 'node-jdbc-install-smoke',
    private: true,
    version: '1.0.0',
    dependencies: {
      '@naxmefy/jdbc': toFileDependency(tarballPath),
      bluebird: toFileDependency(dependencyTarballs.bluebird),
      debug: toFileDependency(dependencyTarballs.debug),
      lodash: toFileDependency(dependencyTarballs.lodash),
      ms: toFileDependency(dependencyTarballs.ms)
    }
  }, null, 2))

  runNpm(['install', '--offline', '--legacy-peer-deps'], tempDir)

  const installedPackageJson = JSON.parse(fs.readFileSync(
    path.join(tempDir, 'node_modules', '@naxmefy', 'jdbc', 'package.json'),
    'utf8'
  ))

  assert.strictEqual(installedPackageJson.dependencies.deasync, undefined)
  assert.strictEqual(fs.existsSync(path.join(tempDir, 'node_modules', 'deasync')), false)
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true })
}

function packPackage (packagePath) {
  const tarballName = runNpm(['pack', '--silent', packagePath], packDir).trim().split(/\r?\n/).pop()
  return path.join(packDir, tarballName)
}

function toFileDependency (filePath) {
  return `file:${path.relative(tempDir, filePath)}`
}
