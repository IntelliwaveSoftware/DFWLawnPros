import { useEffect } from 'react'
import { useSearchParams } from 'react-router'
import { ConsultationForm } from '@/components/ConsultationForm'
import { img } from '@/content/images'
import { getService } from '@/lib/catalog'
import { setTrackingContext } from '@/lib/track'
import type { ServiceKey } from '@/lib/types'

export function GetQuote() {
  const [params] = useSearchParams()
  const service = getService(params.get('service') ?? '')?.key ?? ''
  // Set by the landscaping version of the ad landing page.
  const city = (params.get('city') ?? '').slice(0, 60)

  useEffect(() => setTrackingContext({ page: 'lead_form', service: service || undefined, city: city || undefined }), [service, city])

  return (
    <div className="pt-18">
      <div className="relative isolate overflow-hidden bg-forest-900 py-16 text-white">
        <img src={img.design} alt="" className="absolute inset-0 -z-10 size-full object-cover opacity-30" />
        <div className="container-x">
          <p className="eyebrow text-gold-soft">Request a consultation</p>
          <h1 className="mt-3 max-w-2xl text-4xl sm:text-5xl">Tell us about your project</h1>
          <p className="mt-4 max-w-2xl text-white/80">
            Two minutes is all it takes. We’ll match you with a trusted local landscaping company that serves your area and
            specializes in your project.
          </p>
        </div>
      </div>
      <div className="container-x py-14">
        <ConsultationForm service={service as ServiceKey | ''} city={city} />
      </div>
    </div>
  )
}
