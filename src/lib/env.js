import { readFileSync, existsSync } from 'fs'

export function loadEnv(filePath = '.env') {
  if (!existsSync(filePath)) return

  readFileSync(filePath, 'utf8').split('\n').forEach(line => {
    const [key, ...rest] = line.split('=')
    if (key && rest.length) process.env[key.trim()] = rest.join('=').trim()
  })
}

loadEnv()
