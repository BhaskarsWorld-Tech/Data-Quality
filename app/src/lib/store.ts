import fs from 'fs'
import path from 'path'
import { Connection, Rule, Report } from './types'

const dataDir = path.join(process.cwd(), 'data')

function readJSON<T>(filename: string): T[] {
  const filepath = path.join(dataDir, filename)
  if (!fs.existsSync(filepath)) return []
  return JSON.parse(fs.readFileSync(filepath, 'utf-8'))
}

function writeJSON<T>(filename: string, data: T[]): void {
  const filepath = path.join(dataDir, filename)
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2))
}

export const store = {
  connections: {
    getAll: () => readJSON<Connection>('connections.json'),
    getById: (id: string) => readJSON<Connection>('connections.json').find(c => c.id === id),
    create: (conn: Connection) => {
      const all = readJSON<Connection>('connections.json')
      all.push(conn)
      writeJSON('connections.json', all)
      return conn
    },
    update: (id: string, updates: Partial<Connection>) => {
      const all = readJSON<Connection>('connections.json')
      const idx = all.findIndex(c => c.id === id)
      if (idx !== -1) {
        all[idx] = { ...all[idx], ...updates }
        writeJSON('connections.json', all)
        return all[idx]
      }
      return null
    },
    delete: (id: string) => {
      const all = readJSON<Connection>('connections.json')
      const filtered = all.filter(c => c.id !== id)
      writeJSON('connections.json', filtered)
    }
  },
  rules: {
    getAll: () => readJSON<Rule>('rules.json'),
    getById: (id: string) => readJSON<Rule>('rules.json').find(r => r.id === id),
    create: (rule: Rule) => {
      const all = readJSON<Rule>('rules.json')
      all.push(rule)
      writeJSON('rules.json', all)
      return rule
    },
    update: (id: string, updates: Partial<Rule>) => {
      const all = readJSON<Rule>('rules.json')
      const idx = all.findIndex(r => r.id === id)
      if (idx !== -1) {
        all[idx] = { ...all[idx], ...updates }
        writeJSON('rules.json', all)
        return all[idx]
      }
      return null
    },
    delete: (id: string) => {
      const all = readJSON<Rule>('rules.json')
      writeJSON('rules.json', all.filter(r => r.id !== id))
    }
  },
  reports: {
    getAll: () => readJSON<Report>('reports.json'),
    getLatest: () => {
      const all = readJSON<Report>('reports.json')
      return all.sort((a, b) => new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime())[0]
    },
    create: (report: Report) => {
      const all = readJSON<Report>('reports.json')
      all.push(report)
      writeJSON('reports.json', all)
      return report
    }
  }
}
