import { describe, expect, it } from 'vitest'
import { previewSku, toSkuNamePart } from './sku'

describe('toSkuNamePart', () => {
  it('bỏ dấu tiếng Việt, viết liền, in hoa', () => {
    expect(toSkuNamePart('Áo thun basic')).toBe('AOTHUNBASIC')
    expect(toSkuNamePart('Quần jean ống đứng')).toBe('QUANJEANONGDUNG')
    expect(toSkuNamePart('Đầm dự tiệc')).toBe('DAMDUTIEC')
  })

  it('bỏ ký tự đặc biệt, giữ số', () => {
    expect(toSkuNamePart('Áo thun Đỏ #1 (size L)')).toBe('AOTHUNDO1SIZEL')
  })

  it('tên không còn chữ/số → "SP"', () => {
    expect(toSkuNamePart('')).toBe('SP')
    expect(toSkuNamePart('★ ★')).toBe('SP')
  })
})

describe('previewSku', () => {
  it('theo mẫu DN-TÊN-STT', () => {
    expect(previewSku('Áo polo')).toBe('DN-AOPOLO-###')
  })
})
