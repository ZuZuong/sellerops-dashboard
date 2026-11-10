import { describe, expect, it } from 'vitest'
import { DEFAULT_DASHBOARD_RANGE, parseDashboardRange, RANGE_DAYS } from './dashboardRange.schema'

describe('parseDashboardRange', () => {
  it('chấp nhận giá trị hợp lệ', () => {
    expect(parseDashboardRange('7d')).toBe('7d')
    expect(parseDashboardRange('30d')).toBe('30d')
  })

  it.each([null, '', '90d', '7', 'abc'])('giá trị %j rơi về mặc định', (value) => {
    expect(parseDashboardRange(value)).toBe(DEFAULT_DASHBOARD_RANGE)
  })

  it('map sang số ngày', () => {
    expect(RANGE_DAYS['7d']).toBe(7)
    expect(RANGE_DAYS['30d']).toBe(30)
  })
})
