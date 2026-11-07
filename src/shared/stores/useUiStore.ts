import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface UiState {
  /** Drawer sidebar trên mobile (không lưu lại giữa các lần tải trang). */
  mobileNavOpened: boolean
  /** Thu gọn sidebar trên desktop (lưu vào localStorage). */
  desktopNavCollapsed: boolean
  toggleMobileNav: () => void
  closeMobileNav: () => void
  toggleDesktopNav: () => void
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      mobileNavOpened: false,
      desktopNavCollapsed: false,
      toggleMobileNav: () => set((s) => ({ mobileNavOpened: !s.mobileNavOpened })),
      closeMobileNav: () => set({ mobileNavOpened: false }),
      toggleDesktopNav: () => set((s) => ({ desktopNavCollapsed: !s.desktopNavCollapsed })),
    }),
    {
      name: 'sellerops-ui',
      partialize: (s) => ({ desktopNavCollapsed: s.desktopNavCollapsed }),
    },
  ),
)
