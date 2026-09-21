import { describe, expect, it } from 'vitest'
import { importHealth } from './graph.mjs'

const graph = (modules) => ({ modules })

describe('importHealth', () => {
  it('saaf graph par teeno list khaali hoti hain', () => {
    const health = importHealth(
      graph([
        { source: 'src/a.ts', dependencies: [{ resolved: 'src/b.ts' }] },
        { source: 'src/b.ts', dependencies: [] },
      ]),
    )
    expect(health).toEqual({ circular: [], unresolved: [], orphans: [] })
  })

  it('circular import pakadta hai', () => {
    const health = importHealth(
      graph([{ source: 'src/a.ts', dependencies: [{ resolved: 'src/b.ts', circular: true }] }]),
    )
    expect(health.circular).toEqual([{ from: 'src/a.ts', to: 'src/b.ts' }])
  })

  it('jo import resolve na ho use pakadta hai', () => {
    const health = importHealth(
      graph([
        { source: 'src/a.ts', dependencies: [{ module: './gone', couldNotResolve: true }] },
      ]),
    )
    expect(health.unresolved).toEqual([{ from: 'src/a.ts', to: './gone' }])
  })

  it('orphan modules alag se batata hai', () => {
    const health = importHealth(
      graph([
        { source: 'src/alone.ts', dependencies: [], orphan: true },
        { source: 'src/used.ts', dependencies: [] },
      ]),
    )
    expect(health.orphans).toEqual(['src/alone.ts'])
  })

  it('bina dependencies wale module par crash nahi hota', () => {
    expect(() => importHealth(graph([{ source: 'src/a.ts' }]))).not.toThrow()
  })
})
