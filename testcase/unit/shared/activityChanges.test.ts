import { describe, expect, it } from 'vitest'
import {
  ACTIVITY_CHANGES_ATTR,
  change,
  diffRecords,
  MAX_ACTIVITY_CHANGES,
  describeChanges,
  parseActivityChanges,
  withChanges,
} from '@/shared/lib/activityChanges'

describe('activityChanges', () => {
  it('change: chuỗi rỗng / undefined → null; số → chuỗi; giá trị quá dài bị cắt', () => {
    expect(change('Ghi chú', '', undefined)).toEqual({ field: 'Ghi chú', from: null, to: null })
    expect(change('SL', 3, 5)).toEqual({ field: 'SL', from: '3', to: '5' })
    expect(change('Mô tả', null, 'a'.repeat(400)).to).toHaveLength(300)
  })

  it('withChanges bỏ dòng không đổi và giới hạn số dòng', () => {
    const attr = withChanges([change('Giá', '1', '2'), change('Tên', 'A', 'A')])
    expect(attr[ACTIVITY_CHANGES_ATTR]).toEqual([{ field: 'Giá', from: '1', to: '2' }])
    const many = Array.from({ length: 50 }, (_, i) => change(`F${i}`, null, String(i)))
    expect(withChanges(many)[ACTIVITY_CHANGES_ATTR]).toHaveLength(MAX_ACTIVITY_CHANGES)
  })

  it('describeChanges: mỗi thay đổi một dòng "trường: cũ → mới", trống ghi rõ', () => {
    expect(
      describeChanges([
        change('Giá bán', '150.000 ₫', '199.000 ₫'),
        change('Ghi chú', null, 'Gấp'),
      ]),
    ).toBe('Giá bán: 150.000 ₫ → 199.000 ₫\nGhi chú: (trống) → Gấp')
  })

  it('diffRecords chỉ trả trường thực sự đổi', () => {
    const fields = [
      { field: 'Tên', value: (r: { name: string; price: number }) => r.name },
      { field: 'Giá', value: (r: { name: string; price: number }) => r.price },
    ]
    expect(diffRecords({ name: 'Áo', price: 1 }, { name: 'Áo', price: 2 }, fields)).toEqual([
      { field: 'Giá', from: '1', to: '2' },
    ])
  })

  it('parseActivityChanges bỏ phần tử sai dạng (dữ liệu từ DB / toast)', () => {
    expect(
      parseActivityChanges([
        { field: 'Giá', from: '1', to: '2' },
        { field: '', from: '1', to: '2' },
        { field: 'X', from: 1, to: '2' },
        'rác',
      ]),
    ).toEqual([{ field: 'Giá', from: '1', to: '2' }])
    expect(parseActivityChanges(null)).toEqual([])
  })
})
