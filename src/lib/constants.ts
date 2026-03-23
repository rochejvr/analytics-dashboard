export const APP_REGISTRY = {
  invoice_eval: {
    name: 'Invoice Eval',
    shortName: 'Invoices',
    color: '#2563eb',
    icon: 'FileText',
    description: 'Invoice evaluation, compliance, claims processing',
  },
  po_register: {
    name: 'PO Register',
    shortName: 'PO',
    color: '#7c3aed',
    icon: 'ClipboardList',
    description: 'Sales order management and tracking',
  },
  bom_analysis: {
    name: 'BOM Analysis',
    shortName: 'BOM',
    color: '#059669',
    icon: 'Layers',
    description: 'Bill of materials analysis and comparison',
  },
  shipping: {
    name: 'Shipping',
    shortName: 'Ship',
    color: '#d97706',
    icon: 'Truck',
    description: 'Shipment management and documentation',
  },
  kpi_board: {
    name: 'KPI Board',
    shortName: 'KPI',
    color: '#dc2626',
    icon: 'Target',
    description: 'KPI tracking, corrective actions, management review',
  },
} as const;

export type AppId = keyof typeof APP_REGISTRY;

export const DATE_RANGES = [
  { label: '24h', value: '24h', hours: 24 },
  { label: '7d', value: '7d', hours: 168 },
  { label: '30d', value: '30d', hours: 720 },
  { label: '90d', value: '90d', hours: 2160 },
] as const;
