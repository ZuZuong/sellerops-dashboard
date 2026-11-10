import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { WidgetCard } from './WidgetCard'

let shouldThrow = true
function Flaky() {
  if (shouldThrow) throw new Error('render failed')
  return <p>Nội dung OK</p>
}

function Sibling() {
  const [count] = useState(1)
  return <p>Widget khác {count}</p>
}

describe('WidgetCard', () => {
  it('cô lập lỗi render trong widget và cho phép thử lại', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    shouldThrow = true

    renderWithProviders(
      <>
        <WidgetCard title="Widget lỗi">
          <Flaky />
        </WidgetCard>
        <WidgetCard title="Widget bình thường">
          <Sibling />
        </WidgetCard>
      </>,
    )

    expect(screen.getByRole('alert')).toHaveTextContent('Không hiển thị được nội dung này.')
    expect(screen.getByText('Widget khác 1')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Widget lỗi' })).toBeInTheDocument()

    shouldThrow = false
    await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
    expect(screen.getByText('Nội dung OK')).toBeInTheDocument()
  })
})
