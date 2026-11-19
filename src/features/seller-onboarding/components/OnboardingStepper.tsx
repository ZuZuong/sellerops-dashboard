import { Stepper } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { useState } from 'react'
import type { Seller } from '@/features/sellers'
import type { ApplicationStep } from '../api/onboarding.api'
import { useSaveApplication, useSubmitApplication } from '../api/onboarding.queries'
import { stepIndexFromCurrentStep } from '../domain/sellerGate'
import type { BusinessInfoValues } from '../schemas/application.schema'
import { BusinessInfoStep } from './BusinessInfoStep'
import { CategoriesStep } from './CategoriesStep'
import { DocumentsStep } from './DocumentsStep'
import { TermsStep } from './TermsStep'

interface OnboardingStepperProps {
  seller: Seller
  accountEmail: string
}

const STEPS = [
  { label: 'Doanh nghiệp', description: 'Thông tin kinh doanh' },
  { label: 'Giấy tờ', description: 'Giấy phép, CCCD' },
  { label: 'Danh mục', description: 'Danh mục sản phẩm' },
  { label: 'Cam kết', description: 'Nội quy người bán' },
] as const

const toStep = (index: number) => (index + 1) as ApplicationStep

/**
 * Hồ sơ đăng ký kinh doanh 4 bước. Mỗi lần chuyển bước đều lưu nháp + ghi nhớ bước
 * (`sellers.current_step`) → tải lại trang vẫn giữ dữ liệu và quay về đúng bước đang làm.
 */
export function OnboardingStepper({ seller, accountEmail }: OnboardingStepperProps) {
  const isMobile = useMediaQuery('(max-width: 36em)')
  const [active, setActive] = useState(() => stepIndexFromCurrentStep(seller.current_step))
  const save = useSaveApplication()
  const submit = useSubmitApplication()

  /** Chuyển sang bước `index`; tiến lên thì báo "đã lưu nháp", lùi lại thì lưu im lặng. */
  const goTo = (index: number, data?: Partial<BusinessInfoValues>) => {
    save.mutate(
      { data, step: toStep(index), silent: index <= active },
      { onSuccess: () => setActive(index) },
    )
  }

  const back = () => goTo(active - 1)
  const next = () => goTo(active + 1)

  return (
    <Stepper
      active={active}
      onStepClick={(index) => {
        if (index < active) goTo(index)
      }}
      allowNextStepsSelect={false}
      size="sm"
      iconSize={32}
      aria-label="Các bước hoàn tất hồ sơ"
    >
      {STEPS.map((step, index) => (
        <Stepper.Step
          key={step.label}
          label={step.label}
          description={isMobile ? undefined : step.description}
          loading={save.isPending && index === active}
        >
          {index === 0 && (
            <BusinessInfoStep
              seller={seller}
              accountEmail={accountEmail}
              saving={save.isPending}
              onSaveDraft={(data) => save.mutate({ data, step: toStep(active) })}
              onNext={(data) => goTo(1, data)}
            />
          )}
          {index === 1 && (
            <DocumentsStep
              sellerId={seller.id}
              ownerId={seller.owner_id}
              saving={save.isPending}
              onBack={back}
              onNext={next}
            />
          )}
          {index === 2 && <CategoriesStep saving={save.isPending} onBack={back} onNext={next} />}
          {index === 3 && (
            <TermsStep
              submitting={submit.isPending}
              onBack={back}
              onSubmit={() => submit.mutate()}
            />
          )}
        </Stepper.Step>
      ))}
    </Stepper>
  )
}
