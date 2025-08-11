#!/usr/bin/env node
const { execSync } = require('node:child_process')

function getBranch() {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim()
  } catch (e) {
    console.error('Failed to detect current git branch')
    process.exit(2)
  }
}

const branch = getBranch()
if (branch !== 'main') {
  console.error(`Refusing production deploy from branch "${branch}". Switch to "main".`)
  process.exit(1)
}
console.log('Branch check OK: main')


