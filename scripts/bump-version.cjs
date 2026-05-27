const fs = require('node:fs')
const path = require('node:path')

const rootDir = path.resolve(__dirname, '..')
const packageJsonPath = path.join(rootDir, 'package.json')
const packageLockPath = path.join(rootDir, 'package-lock.json')

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`)
}

function bumpPatchVersion(version) {
  const parts = version.split('.')

  if (parts.length !== 3 || parts.some((part) => !/^\d+$/.test(part))) {
    throw new Error(`Unsupported package version "${version}". Expected x.y.z.`)
  }

  const [major, minor, patch] = parts.map(Number)

  return `${major}.${minor}.${patch + 1}`
}

const packageJson = readJson(packageJsonPath)
const nextVersion = bumpPatchVersion(packageJson.version)

packageJson.version = nextVersion
writeJson(packageJsonPath, packageJson)

if (fs.existsSync(packageLockPath)) {
  const packageLock = readJson(packageLockPath)

  packageLock.version = nextVersion

  if (packageLock.packages && packageLock.packages['']) {
    packageLock.packages[''].version = nextVersion
  }

  writeJson(packageLockPath, packageLock)
}

console.log(`Version bumped to ${nextVersion}`)
