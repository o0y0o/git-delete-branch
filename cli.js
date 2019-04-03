#!/usr/bin/env node

const chalk = require('chalk')
const inquirer = require('inquirer')
const git = require('simple-git/promise')

function startSpinner() {
  const interval = 80
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
  let frame = 0

  const showCursor = () => process.stderr.write('\u001b[?25h')
  const hideCursor = () => process.stderr.write('\u001b[?25l')
  const clearSpinner = () => {
    process.stderr.clearLine()
    process.stderr.cursorTo(0)
  }

  hideCursor()
  const spinnerId = setInterval(() => {
    clearSpinner()
    process.stderr.write(`${frames[frame]} deleting...`)
    if (++frame === frames.length) frame = 0
  }, interval)

  return () => {
    clearInterval(spinnerId)
    clearSpinner()
    showCursor()
  }
}

;(async () => {
  const repo = git()
  const { branches } = await repo.branch()

  const choices = Object.values(branches)
    .map(b => b.name)
    .map(name => ({ name, value: name }))
  const { willDeleteBranches } = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'willDeleteBranches',
      message: 'Which branches you want to delete?',
      choices
    }
  ])
  if (!willDeleteBranches.length) return

  const { didConfirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'didConfirm',
      message: 'Are you sure?',
      default: false
    }
  ])
  if (!didConfirm) return

  const stopSpinner = startSpinner()
  try {
    const tasks = willDeleteBranches.map(async branch => {
      try {
        const matches = /^remotes\/([^/]+)\/(.*)/.exec(branch)
        if (!matches) {
          await repo.branch(['-D', branch])
        } else {
          const [, remoteName, localName] = matches
          await repo.push(remoteName, ':' + localName)
        }
        return `${branch} ${chalk.green.bold('deleted')}`
      } catch (error) {
        return `${branch} ${chalk.red.bold(`error: ${error}`)}`
      }
    })
    const results = await Promise.all(tasks)
    stopSpinner()
    console.log(`Result:\n ${results.join('\n ')}`)
  } catch {
    stopSpinner()
  }
})()
