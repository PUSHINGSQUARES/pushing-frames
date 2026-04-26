import { describe, it, expect, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { RefsUsedZone } from './RefsUsedZone'
import { store } from '@/state/store'
import type { Pack } from '@/pack/types'

const basePack: Pack = {
  frontmatter: {
    title: 'Test',
    slug: 'test',
    active_provider: 'seedream',
    variations_default: 1,
    budget_project: 10,
    budget_currency: 'GBP',
  },
  blocks: [],
  shots: [
    { slug: 'shot_01', action: 'a', refs: ['m3.jpg', 'pit.jpg'], styleBlocks: [], negBlocks: [] },
  ],
}

beforeEach(() => {
  store.setPack(basePack)
  store.setActiveShot('shot_01')
})

describe('RefsUsedZone', () => {
  it('renders one badge per bound ref', () => {
    const { container } = render(<RefsUsedZone />)
    // each ref renders as a span with title=name, and a remove button.
    expect(container.querySelectorAll('span[title="m3.jpg"]').length).toBe(1)
    expect(container.querySelectorAll('span[title="pit.jpg"]').length).toBe(1)
  })

  it('× removes a ref from the active shot', () => {
    const { getAllByText } = render(<RefsUsedZone />)
    const removeButtons = getAllByText('×')
    fireEvent.click(removeButtons[0])
    const shot = store.getState().pack?.shots.find(s => s.slug === 'shot_01')
    expect(shot?.refs).not.toContain('m3.jpg')
  })

  it('drop adds a ref to the active shot', () => {
    const { container } = render(<RefsUsedZone />)
    const zone = container.firstChild as HTMLElement
    const dt = { getData: () => 'new_ref.jpg', setData: () => {} }
    fireEvent.drop(zone, { dataTransfer: dt })
    const shot = store.getState().pack?.shots.find(s => s.slug === 'shot_01')
    expect(shot?.refs).toContain('new_ref.jpg')
  })

  it('drop does not add duplicate refs', () => {
    const { container } = render(<RefsUsedZone />)
    const zone = container.firstChild as HTMLElement
    const dt = { getData: () => 'm3.jpg', setData: () => {} }
    fireEvent.drop(zone, { dataTransfer: dt })
    const shot = store.getState().pack?.shots.find(s => s.slug === 'shot_01')
    expect(shot?.refs.filter(r => r === 'm3.jpg')).toHaveLength(1)
  })
})
