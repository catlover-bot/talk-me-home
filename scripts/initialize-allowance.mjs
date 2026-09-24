import { initializeAllowance } from '../dist/server/server/admission.js'

const sessions = Number(process.argv[2])
const path = process.env.GAME_LIVE_ALLOWANCE_FILE
try {
  if (!path) throw new Error('Missing allowance path')
  initializeAllowance(path, sessions)
  console.log(`Created an allowance for ${sessions} full 600-second Live sessions. Restart the service after enabling Live.`)
} catch {
  console.error('Allowance was not created. Set GAME_LIVE_ALLOWANCE_FILE to a new durable file, choose 1 to 1000 sessions, and check write permissions. Existing files are never replaced.')
  process.exitCode = 1
}
