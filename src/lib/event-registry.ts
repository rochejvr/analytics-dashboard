/**
 * Central registry of event descriptions.
 * Key format: "app_id:event_name" → short human-readable description.
 *
 * Used by the Adoption page to explain what each tracked event means.
 * Unknown events gracefully fall back to null (no description shown).
 */

const EVENTS: Record<string, string> = {
  // ── Invoice Eval ─────────────────────────────────────────────────
  'invoice_eval:email.received':            'Inbound email received at the intake address',
  'invoice_eval:email.claims_detected':     'Email identified as an employee expense claim',
  'invoice_eval:pdf.password_protected':    'Password-protected PDF detected, supplier notified',
  'invoice_eval:invoice.upload.evaluated':  'Invoice uploaded via dashboard and evaluated by LLM',
  'invoice_eval:invoice.evaluated':         'Invoice evaluated through the email intake pipeline',
  'invoice_eval:invoice.duplicate':         'Duplicate invoice number detected, skipped',
  'invoice_eval:invoice.rejected':          'Invoice failed VAT compliance checks',
  'invoice_eval:invoice.accepted':          'Invoice passed compliance and saved to system',
  'invoice_eval:delivery_note.stored':      'Delivery note linked to invoice from email attachment',
  'invoice_eval:coc.stored':                'Certificate of Compliance linked from email attachment',
  'invoice_eval:claim.form_required':       'Claims email missing supporting documentation',
  'invoice_eval:claim.accepted':            'Expense claim evaluated and accepted',
  'invoice_eval:llm.evaluation':            'Invoice evaluated via image-path LLM call',
  'invoice_eval:llm.evaluation.pdf':        'Invoice evaluated via PDF-path LLM call',
  'invoice_eval:llm.evaluation.failed':     'LLM evaluation call failed',
  'invoice_eval:llm.evaluation.pdf.failed': 'LLM PDF evaluation call failed',

  // ── KPI Board ────────────────────────────────────────────────────
  'kpi_board:kpi.created':                'New KPI definition added to the board',
  'kpi_board:kpi.edited':                 'KPI definition updated (name, target, unit, etc.)',
  'kpi_board:kpi.value_updated':          'Monthly progress value recorded for a KPI',
  'kpi_board:kpi.target_changed':         'KPI target revised from a specific period onwards',
  'kpi_board:kpi.reactivated':            'Hidden KPI re-enabled on the board',
  'kpi_board:entry.deleted':              'KPI progress entry removed for a period',
  'kpi_board:action.created':             'New corrective action added to a KPI',
  'kpi_board:action.edited':              'Corrective action details updated',
  'kpi_board:action.deleted':             'Corrective action removed',
  'kpi_board:comment.edited':             'Activity feed comment modified',
  'kpi_board:view.changed':               'User navigated between dashboard views',
  'kpi_board:filter.department_changed':  'Department filter applied or cleared',
  'kpi_board:user.signed_out':            'User signed out of the app',
  'kpi_board:report.generated':           'Management review report opened',

  // ── BOM Analysis ─────────────────────────────────────────────────
  'bom_analysis:analysis.started':        'Lot verification analysis triggered',
  'bom_analysis:analysis.completed':      'Analysis finished with pass/fail verdict',
  'bom_analysis:analysis.failed':         'Analysis encountered an error',
  'bom_analysis:analysis.rerun':          'User re-ran analysis on the same batch',
  'bom_analysis:analysis.reset':          'Results cleared, returned to upload screen',
  'bom_analysis:bom.uploaded':            'Finance BOM file uploaded for comparison',
  'bom_analysis:files.uploaded':          'Lot assignment files added for verification',
  'bom_analysis:product.selected':        'Product code selected from finance BOM',
  'bom_analysis:issue.overridden':        'Error overridden with justification',
  'bom_analysis:issue.override_undone':   'Override reverted, error reinstated',
  'bom_analysis:report.exported_pdf':     'PDF verification report downloaded',
  'bom_analysis:tab.switched':            'Switched between results dashboard tabs',

  // ── Shipping ─────────────────────────────────────────────────────
  // (not yet instrumented — add events here when shipping analytics are added)

  // ── PO Register ──────────────────────────────────────────────────
  // (not yet instrumented — add events here when PO Register analytics are added)
};

/**
 * Look up a human-readable description for an event.
 * @param appId  The app that logged the event (e.g. "invoice_eval")
 * @param event  The event name (e.g. "invoice.accepted")
 * @returns Description string, or null if not registered
 */
export function getEventDescription(appId: string, event: string): string | null {
  return EVENTS[`${appId}:${event}`] ?? null;
}
