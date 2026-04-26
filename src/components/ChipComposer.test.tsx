import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ChipComposer } from './ChipComposer'
import { store } from '@/state/store'
import type { Pack } from '@/pack/types'

const pack: Pack = {
  frontmatter: { title: 'T', slug: 't', active_provider: 'seedream', variations_default: 1, budget_project: 10, budget_currency: 'GBP' },
  blocks: [{ name: 'STYLE_GUIDE', body: 'x' }],
  shots: [{ slug: 's1', action: 'walk into frame', refs: [], styleBlocks: ['STYLE_GUIDE'], negBlocks: [], camera: 'ARRI', lens: '50mm', aspect: '16:9' }],
}

describe('ChipComposer', () => {
  it('renders active shot fields', () => {
    store.setPack(pack)
    render(<ChipComposer />)
    expect(screen.getByDisplayValue('walk into frame')).toBeInTheDocument()
    expect(screen.getByDisplayValue('ARRI')).toBeInTheDocument()
  })
})
