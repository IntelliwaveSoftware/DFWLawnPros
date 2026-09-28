import { EXCLUSIVE_LEADS } from './config.js'
import { addEvent, db } from './db.js'

/** Runs once a purchase is paid (immediately when payments are off, or from the Stripe webhook). */
export async function finalizePurchase(leadId: string, contractorId: string, price: number): Promise<void> {
  if (EXCLUSIVE_LEADS) await db().lead.update({ where: { id: leadId }, data: { status: 'purchased' } })
  await db().leadOutcome.upsert({
    where: { lead_id_contractor_id: { lead_id: leadId, contractor_id: contractorId } },
    create: { lead_id: leadId, contractor_id: contractorId },
    update: {},
  })
  await addEvent(leadId, 'purchased', contractorId, { price })
}
