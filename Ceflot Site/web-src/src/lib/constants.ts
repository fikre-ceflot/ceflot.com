
export const TRADE_GROUPS = [
  { code: 'CONC', label: 'Concrete Works', emoji: '🧱' },
  { code: 'MASN', label: 'Masonry', emoji: '🧱' },
  { code: 'CARP', label: 'Carpentry', emoji: '🪚' },
  { code: 'STEE', label: 'Structural Steel', emoji: '⚙️' },
  { code: 'PLMB', label: 'Plumbing', emoji: '🔧' },
  { code: 'ELEC', label: 'Electrical', emoji: '⚡' },
  { code: 'FINR', label: 'Finishes', emoji: '🪄' },
  { code: 'RCFT', label: 'Roof & Cladding', emoji: '🏠' },
  { code: 'EXCV', label: 'Excavation', emoji: '🚜' },
  { code: 'GRDW', label: 'Groundworks', emoji: '⛏️' },
  { code: 'PAIN', label: 'Painting', emoji: '🎨' },
  { code: 'TILE', label: 'Tiling', emoji: '🏁' },
  { code: 'GLAZ', label: 'Glazing', emoji: '🪟' },
  { code: 'ALUM', label: 'Aluminium Works', emoji: '🔩' },
  { code: 'HVAC', label: 'HVAC', emoji: '🌬️' },
  { code: 'LAND', label: 'Landscaping', emoji: '🌿' },
  { code: 'RBAR', label: 'Reinforcement', emoji: '🔗' },
  { code: 'FORM', label: 'Formwork', emoji: '📐' },
  { code: 'WTRP', label: 'Waterproofing', emoji: '💧' },
  { code: 'MOB', label: 'Mobilization', emoji: '🚚' },
  { code: 'PREL', label: 'Preliminaries', emoji: '📋' },
  { code: 'DEMO', label: 'Demolition', emoji: '🔨' },
  { code: 'FUEL', label: 'Fuel & Lubricants', emoji: '⛽' },
  { code: 'EQPT', label: 'Construction Equipment', emoji: '🚜' },
  { code: 'LABR', label: 'Labour', emoji: '👷' },
  { code: 'MISC', label: 'Miscellaneous', emoji: '📋' },
];

export const RESOURCE_CATEGORIES = {
  material: [
    'Concrete Works',
    'Masonry',
    'Carpentry',
    'Structural Steel',
    'Reinforcement',
    'Formwork',
    'Plumbing',
    'Electrical',
    'Finishes',
    'Roof & Cladding',
    'Painting',
    'Tiling',
    'Glazing',
    'Aluminium Works',
    'Waterproofing',
    'Landscaping',
    'Miscellaneous',
    'Staff Accommodation',
    'Medical & Safety',
    'General Tools'
  ],
  labour: ['Skilled', 'Unskilled', 'Supervisory', 'Specialized', 'Management'],
  equipment: ['Earthmoving', 'Concrete', 'Transport', 'Power', 'Support', 'Small Tools', 'Specialty Tools'],
  vehicle: ['Transport', 'Logistics', 'Site Vehicle'],
  fuel: ['Fuel', 'Lubricants'],
  subcontractor: ['Civil', 'Structural', 'MEP', 'Finishes', 'Landscaping']
};

export const OPERATIONAL_BUNDLES = [
  {
    id: 'staff-acc',
    name: 'Advanced Staff Welfare Bundle',
    description: 'Comprehensive solution for site accommodation, including temperature control and hygiene facilities.',
    category: 'Staff Accommodation',
    items: [
      { name: 'Insulated Accommodation Container', unit: 'pcs', qty: 2, type: 'material', category: 'Staff Accommodation' },
      { name: 'Split AC Unit (18,000 BTU)', unit: 'pcs', qty: 2, type: 'equipment', category: 'Staff Accommodation' },
      { name: 'Steel Bunk Bed System', unit: 'set', qty: 4, type: 'material', category: 'Staff Accommodation' },
      { name: 'High-Density Foam Mattresses', unit: 'pcs', qty: 8, type: 'material', category: 'Staff Accommodation' },
      { name: 'Durable Lockers (4-Door)', unit: 'pcs', qty: 2, type: 'material', category: 'Staff Accommodation' }
    ]
  },
  {
    id: 'site-office',
    name: 'Executive Site Office Bundle',
    description: 'Fully equipped command center for project management and coordination.',
    category: 'Preliminaries',
    items: [
      { name: 'Site Office Porta-Cabin (20ft)', unit: 'pcs', qty: 1, type: 'material', category: 'Preliminaries' },
      { name: 'Meeting Table (8-Seater)', unit: 'pcs', qty: 1, type: 'material', category: 'Preliminaries' },
      { name: 'Office Workstations', unit: 'set', qty: 4, type: 'material', category: 'Preliminaries' },
      { name: 'Drawing Storage Rack', unit: 'pcs', qty: 1, type: 'material', category: 'Preliminaries' },
      { name: 'Whiteboard & Coordination Kit', unit: 'set', qty: 1, type: 'material', category: 'Preliminaries' }
    ]
  },
  {
    id: 'med-safety',
    name: 'HSE Compliance Bundle',
    description: 'Critical health, safety, and environmental protection equipment.',
    category: 'Medical & Safety',
    items: [
      { name: 'Industrial First Aid Station', unit: 'kit', qty: 2, type: 'material', category: 'Medical & Safety' },
      { name: 'Fire Extinguisher Station (CO2/Dry)', unit: 'set', qty: 4, type: 'material', category: 'Medical & Safety' },
      { name: 'Spill Containment Kit', unit: 'set', qty: 1, type: 'material', category: 'Medical & Safety' },
      { name: 'Emergency Evacuation Siren', unit: 'pcs', qty: 1, type: 'material', category: 'Medical & Safety' }
    ]
  },
  {
    id: 'startup-tools',
    name: 'General Startup Tools',
    description: 'Basic hand tools required for site mobilization.',
    category: 'General Tools',
    items: [
      { name: 'Tape Measure (8m)', unit: 'pcs', qty: 5, type: 'tool', category: 'General Tools' },
      { name: 'Spirit Level (600mm)', unit: 'pcs', qty: 3, type: 'tool', category: 'General Tools' },
      { name: 'Claw Hammer', unit: 'pcs', qty: 5, type: 'tool', category: 'General Tools' },
      { name: 'Screwdriver Set', unit: 'set', qty: 3, type: 'tool', category: 'General Tools' },
      { name: 'Heavy Duty Tool Box', unit: 'pcs', qty: 2, type: 'tool', category: 'General Tools' }
    ]
  },
  {
    id: 'ppe-bundle',
    name: 'Standard PPE Bundle',
    description: 'Personal Protective Equipment for core team.',
    category: 'PPE',
    items: [
      { name: 'Safety Helmet (White)', unit: 'pcs', qty: 20, type: 'material', category: 'Medical & Safety' },
      { name: 'High-Vis Reflective Vest', unit: 'pcs', qty: 20, type: 'material', category: 'Medical & Safety' },
      { name: 'Safety Goggles', unit: 'pcs', qty: 15, type: 'material', category: 'Medical & Safety' },
      { name: 'Leather Work Gloves', unit: 'pair', qty: 50, type: 'material', category: 'Medical & Safety' },
      { name: 'Ear Defenders', unit: 'pair', qty: 10, type: 'material', category: 'Medical & Safety' }
    ]
  },
  {
    id: 'specialty-tools',
    name: 'Specialty Measurement Tools',
    description: 'Advanced measurement and scanning equipment.',
    category: 'Specialty Tools',
    items: [
      { name: 'Laser Disto (100m)', unit: 'pcs', qty: 2, type: 'equipment', category: 'Specialty Tools' },
      { name: 'Digital Theodolite', unit: 'pcs', qty: 1, type: 'equipment', category: 'Specialty Tools' },
      { name: 'Concrete Cover Meter', unit: 'pcs', qty: 1, type: 'equipment', category: 'Specialty Tools' }
    ]
  }
];

export const getGroupLabel = (g: string) => {
  if (!g) return 'General';
  const found = TRADE_GROUPS.find(m => m.code === g || m.label.toLowerCase() === g.toLowerCase());
  return found ? found.label : g;
};

export const getGroupEmoji = (g: string) => {
  if (!g) return '📦';
  const found = TRADE_GROUPS.find(m => m.code === g || m.label.toLowerCase() === g.toLowerCase());
  return found ? found.emoji : '📦';
};
