#!/usr/bin/env node

const chalk = require('chalk')
const inquirer = require('inquirer')
const git = require('simple-git/promise')

function startSpinner(text) {
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
    process.stderr.write(`${frames[frame]} ${text}`)
    if (++frame === frames.length) frame = 0
  }, interval)

  return () => {
    clearInterval(spinnerId)
    clearSpinner()
    showCursor()
  }
}

;(async () => {
  const repo = git().silent(true)

  const stopSpinner = startSpinner('fetching...')
  await repo.fetch({ '--all': null, '-p': null })
  const { branches } = await repo.branch()
  stopSpinner()

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

  for (let branch of willDeleteBranches) {
    const stopSpinner = startSpinner('deleting...')
    try {
      const matches = /^remotes\/([^/]+)\/(.*)/.exec(branch)
      if (!matches) {
        await repo.branch(['-D', branch])
      } else {
        const [, remoteName, localName] = matches
        await repo.push(remoteName, localName, { '--delete': null })
      }
      stopSpinner()
      console.log(`${branch} ${chalk.green.bold('Success')}`)
    } catch (error) {
      stopSpinner()
      console.log(`${branch} ${chalk.red.bold(`${error}`)}`)
    }
  }
  console.log(chalk.cyan('Done!'))
})()
