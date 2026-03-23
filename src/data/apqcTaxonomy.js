/**
 * APQC Process Classification Framework (PCF) — Cross-Industry v7.x
 * Levels 1–3, with keywords for auto-mapping BPMN elements.
 *
 * Structure: flat array — use buildApqcTree() for hierarchical rendering.
 * id matches PCF code (e.g. '1.0', '1.1', '1.1.1').
 */

export const APQC_NODES = [
  // ─────────────────────────────────────────────
  // 1. Develop Vision and Strategy
  // ─────────────────────────────────────────────
  { id: '1.0', name: 'Develop Vision and Strategy', level: 1, parentId: null, keywords: [] },
  { id: '1.1', name: 'Define the business concept and long-term vision', level: 2, parentId: '1.0', keywords: ['vision', 'concept', 'mission', 'long-term', 'strategic direction'] },
  { id: '1.1.1', name: 'Assess the external environment', level: 3, parentId: '1.1', keywords: ['external', 'environment', 'macro', 'pestle', 'pest'] },
  { id: '1.1.2', name: 'Survey the competitive landscape', level: 3, parentId: '1.1', keywords: ['competitive', 'landscape', 'competitor', 'competition', 'market position'] },
  { id: '1.1.3', name: 'Identify economic trends', level: 3, parentId: '1.1', keywords: ['economic', 'trends', 'economy', 'gdp', 'inflation'] },
  { id: '1.1.4', name: 'Identify political and regulatory issues', level: 3, parentId: '1.1', keywords: ['political', 'regulatory', 'regulation', 'policy', 'government'] },
  { id: '1.1.5', name: 'Assess new technology innovations', level: 3, parentId: '1.1', keywords: ['technology', 'innovation', 'tech', 'digital', 'emerging'] },
  { id: '1.1.6', name: 'Evaluate political and country risk', level: 3, parentId: '1.1', keywords: ['country risk', 'political risk', 'geopolitical'] },
  { id: '1.1.7', name: 'Assess industry and competitive forces', level: 3, parentId: '1.1', keywords: ['industry forces', 'porter', 'competitive forces', 'five forces'] },
  { id: '1.1.8', name: 'Identify environmental sustainability issues', level: 3, parentId: '1.1', keywords: ['sustainability', 'environmental', 'climate', 'esg', 'green'] },
  { id: '1.2', name: 'Develop business strategy', level: 2, parentId: '1.0', keywords: ['strategy', 'strategic plan', 'business strategy', 'objectives'] },
  { id: '1.2.1', name: 'Develop overall mission statement', level: 3, parentId: '1.2', keywords: ['mission', 'mission statement', 'purpose'] },
  { id: '1.2.2', name: 'Evaluate strategic options', level: 3, parentId: '1.2', keywords: ['strategic options', 'alternatives', 'evaluate strategy'] },
  { id: '1.2.3', name: 'Select long-term business strategy', level: 3, parentId: '1.2', keywords: ['select strategy', 'choose strategy', 'long-term strategy'] },
  { id: '1.2.4', name: 'Coordinate and align functional strategies', level: 3, parentId: '1.2', keywords: ['align strategy', 'functional strategy', 'coordinate'] },
  { id: '1.2.5', name: 'Create organizational design', level: 3, parentId: '1.2', keywords: ['org design', 'organizational structure', 'org chart'] },
  { id: '1.2.6', name: 'Develop and set organizational goals', level: 3, parentId: '1.2', keywords: ['goals', 'objectives', 'targets', 'okr'] },
  { id: '1.2.7', name: 'Formulate business unit strategies', level: 3, parentId: '1.2', keywords: ['business unit', 'division strategy', 'unit plan'] },
  { id: '1.3', name: 'Execute and measure strategic initiatives', level: 2, parentId: '1.0', keywords: ['strategic initiatives', 'execution', 'scorecard', 'kpi'] },
  { id: '1.3.1', name: 'Develop strategic initiatives', level: 3, parentId: '1.3', keywords: ['initiatives', 'strategic projects', 'programs'] },
  { id: '1.3.2', name: 'Develop the overall business plan', level: 3, parentId: '1.3', keywords: ['business plan', 'annual plan', 'operational plan'] },
  { id: '1.3.3', name: 'Plan strategic initiatives', level: 3, parentId: '1.3', keywords: ['plan initiatives', 'roadmap', 'initiative planning'] },
  { id: '1.3.4', name: 'Establish high-level organizational goals', level: 3, parentId: '1.3', keywords: ['organizational goals', 'high-level goals', 'corporate goals'] },
  { id: '1.3.5', name: 'Communicate plans', level: 3, parentId: '1.3', keywords: ['communicate plan', 'cascade', 'announce', 'share strategy'] },
  { id: '1.3.6', name: 'Develop and cascade scorecard/KPI measures', level: 3, parentId: '1.3', keywords: ['scorecard', 'kpi', 'metrics', 'balanced scorecard', 'performance measures'] },

  // ─────────────────────────────────────────────
  // 2. Develop and Manage Products and Services
  // ─────────────────────────────────────────────
  { id: '2.0', name: 'Develop and Manage Products and Services', level: 1, parentId: null, keywords: [] },
  { id: '2.1', name: 'Manage product and service portfolio', level: 2, parentId: '2.0', keywords: ['portfolio', 'product portfolio', 'service portfolio', 'product lifecycle'] },
  { id: '2.1.1', name: 'Evaluate performance of existing products/services', level: 3, parentId: '2.1', keywords: ['product performance', 'service performance', 'evaluate products'] },
  { id: '2.1.2', name: 'Define product/service development requirements', level: 3, parentId: '2.1', keywords: ['product requirements', 'service requirements', 'prd'] },
  { id: '2.1.3', name: 'Identify new product/service opportunities', level: 3, parentId: '2.1', keywords: ['new product', 'new service', 'innovation', 'opportunity'] },
  { id: '2.1.4', name: 'Establish product/service life cycle', level: 3, parentId: '2.1', keywords: ['lifecycle', 'product lifecycle', 'eol', 'end of life'] },
  { id: '2.2', name: 'Develop products and services', level: 2, parentId: '2.0', keywords: ['product development', 'service development', 'design', 'r&d', 'research development'] },
  { id: '2.2.1', name: 'Design, build, and evaluate products and services', level: 3, parentId: '2.2', keywords: ['design product', 'build product', 'prototype', 'mvp'] },
  { id: '2.2.2', name: 'Test market for new or revised products and services', level: 3, parentId: '2.2', keywords: ['market test', 'pilot', 'beta test', 'user testing'] },
  { id: '2.2.3', name: 'Prepare for production', level: 3, parentId: '2.2', keywords: ['production readiness', 'launch prep', 'go live prep', 'pre-production'] },
  { id: '2.2.4', name: 'Manage product and service master data', level: 3, parentId: '2.2', keywords: ['product master data', 'master data', 'product catalog'] },
  { id: '2.3', name: 'Deliver products and services', level: 2, parentId: '2.0', keywords: ['deliver', 'launch', 'release', 'deploy product'] },
  { id: '2.3.1', name: 'Confirm service capability', level: 3, parentId: '2.3', keywords: ['service capability', 'capacity check', 'feasibility'] },
  { id: '2.3.2', name: 'Deploy products and services', level: 3, parentId: '2.3', keywords: ['deploy', 'launch', 'release', 'rollout'] },
  { id: '2.3.3', name: 'Monitor and evaluate delivery', level: 3, parentId: '2.3', keywords: ['monitor delivery', 'evaluate delivery', 'post-launch review'] },

  // ─────────────────────────────────────────────
  // 3. Market and Sell Products and Services
  // ─────────────────────────────────────────────
  { id: '3.0', name: 'Market and Sell Products and Services', level: 1, parentId: null, keywords: [] },
  { id: '3.1', name: 'Understand markets, customers, and capabilities', level: 2, parentId: '3.0', keywords: ['market research', 'customer research', 'market intelligence', 'customer insight'] },
  { id: '3.1.1', name: 'Perform customer and market intelligence analysis', level: 3, parentId: '3.1', keywords: ['market analysis', 'customer analysis', 'intelligence', 'research'] },
  { id: '3.1.2', name: 'Evaluate and prioritize market opportunities', level: 3, parentId: '3.1', keywords: ['market opportunity', 'prioritize markets', 'tam', 'target market'] },
  { id: '3.1.3', name: 'Research customer needs', level: 3, parentId: '3.1', keywords: ['customer needs', 'voice of customer', 'voc', 'user needs', 'requirements'] },
  { id: '3.2', name: 'Develop marketing strategy', level: 2, parentId: '3.0', keywords: ['marketing strategy', 'branding', 'pricing strategy', 'channel strategy'] },
  { id: '3.2.1', name: 'Define marketing strategy', level: 3, parentId: '3.2', keywords: ['marketing strategy', 'go-to-market', 'gtm'] },
  { id: '3.2.2', name: 'Define pricing strategy', level: 3, parentId: '3.2', keywords: ['pricing', 'price strategy', 'price model', 'monetization'] },
  { id: '3.2.3', name: 'Develop branding strategy', level: 3, parentId: '3.2', keywords: ['branding', 'brand strategy', 'brand identity'] },
  { id: '3.2.4', name: 'Develop channel strategy', level: 3, parentId: '3.2', keywords: ['channel', 'distribution channel', 'go-to-market channel'] },
  { id: '3.3', name: 'Develop sales strategy', level: 2, parentId: '3.0', keywords: ['sales strategy', 'sales plan', 'sales forecast', 'revenue target'] },
  { id: '3.3.1', name: 'Develop sales forecast', level: 3, parentId: '3.3', keywords: ['forecast', 'sales forecast', 'revenue forecast', 'pipeline'] },
  { id: '3.3.2', name: 'Develop sales partner strategy', level: 3, parentId: '3.3', keywords: ['partner', 'channel partner', 'reseller', 'distributor'] },
  { id: '3.3.3', name: 'Develop sales plan', level: 3, parentId: '3.3', keywords: ['sales plan', 'quota', 'territory', 'account plan'] },
  { id: '3.3.4', name: 'Manage customer master data', level: 3, parentId: '3.3', keywords: ['customer master data', 'customer data', 'crm data'] },
  { id: '3.4', name: 'Develop and manage marketing plans', level: 2, parentId: '3.0', keywords: ['marketing plan', 'campaign', 'promotion', 'content marketing'] },
  { id: '3.4.1', name: 'Establish marketing budgets', level: 3, parentId: '3.4', keywords: ['marketing budget', 'spend', 'marketing investment'] },
  { id: '3.4.2', name: 'Develop promotional programs', level: 3, parentId: '3.4', keywords: ['promotion', 'campaign', 'advertising', 'demand gen'] },
  { id: '3.4.3', name: 'Manage marketing content', level: 3, parentId: '3.4', keywords: ['content', 'content management', 'collateral', 'copy'] },
  { id: '3.4.4', name: 'Track customer management information', level: 3, parentId: '3.4', keywords: ['customer tracking', 'crm', 'lead tracking', 'customer information'] },
  { id: '3.5', name: 'Develop and manage sales plans', level: 2, parentId: '3.0', keywords: ['sales', 'leads', 'opportunities', 'accounts', 'orders', 'proposals', 'quotes'] },
  { id: '3.5.1', name: 'Manage leads and opportunities', level: 3, parentId: '3.5', keywords: ['leads', 'lead management', 'opportunity', 'pipeline', 'prospect', 'qualify lead'] },
  { id: '3.5.2', name: 'Manage customers and accounts', level: 3, parentId: '3.5', keywords: ['account management', 'customer management', 'key accounts'] },
  { id: '3.5.3', name: 'Develop and manage sales proposals', level: 3, parentId: '3.5', keywords: ['proposal', 'rfp', 'rfq', 'quotation', 'bid', 'tender'] },
  { id: '3.5.4', name: 'Manage sales orders', level: 3, parentId: '3.5', keywords: ['sales order', 'order management', 'order processing', 'booking'] },

  // ─────────────────────────────────────────────
  // 4. Deliver Products and Services
  // ─────────────────────────────────────────────
  { id: '4.0', name: 'Deliver Products and Services', level: 1, parentId: null, keywords: [] },
  { id: '4.1', name: 'Plan for and align supply chain resources', level: 2, parentId: '4.0', keywords: ['supply chain', 'demand planning', 'production planning', 'mrp', 'material plan'] },
  { id: '4.1.1', name: 'Develop production and materials strategies', level: 3, parentId: '4.1', keywords: ['production strategy', 'materials strategy', 'make vs buy'] },
  { id: '4.1.2', name: 'Manage demand for products and services', level: 3, parentId: '4.1', keywords: ['demand management', 'demand forecast', 'demand planning', 'sales and operations'] },
  { id: '4.1.3', name: 'Create materials plan', level: 3, parentId: '4.1', keywords: ['material plan', 'materials requirement', 'bill of materials', 'bom'] },
  { id: '4.1.4', name: 'Create and manage master production schedule', level: 3, parentId: '4.1', keywords: ['production schedule', 'master schedule', 'capacity planning', 'scheduling'] },
  { id: '4.2', name: 'Procure materials and services', level: 2, parentId: '4.0', keywords: ['procurement', 'purchasing', 'sourcing', 'vendor', 'supplier', 'purchase order'] },
  { id: '4.2.1', name: 'Develop sourcing strategies', level: 3, parentId: '4.2', keywords: ['sourcing strategy', 'strategic sourcing', 'make or buy'] },
  { id: '4.2.2', name: 'Select suppliers and develop contracts', level: 3, parentId: '4.2', keywords: ['supplier selection', 'vendor selection', 'contract', 'rfp', 'tender', 'bid evaluation'] },
  { id: '4.2.3', name: 'Order materials and services', level: 3, parentId: '4.2', keywords: ['purchase order', 'po', 'order materials', 'requisition', 'raise po', 'raise purchase order'] },
  { id: '4.2.4', name: 'Manage suppliers', level: 3, parentId: '4.2', keywords: ['supplier management', 'vendor management', 'supplier performance', 'supplier relationship'] },
  { id: '4.3', name: 'Produce/Manufacture/Deliver product', level: 2, parentId: '4.0', keywords: ['production', 'manufacturing', 'assembly', 'fabrication', 'make', 'produce'] },
  { id: '4.3.1', name: 'Schedule production', level: 3, parentId: '4.3', keywords: ['schedule production', 'production schedule', 'work order', 'job scheduling'] },
  { id: '4.3.2', name: 'Produce product', level: 3, parentId: '4.3', keywords: ['produce', 'manufacture', 'assemble', 'fabricate', 'build product'] },
  { id: '4.3.3', name: 'Perform quality testing', level: 3, parentId: '4.3', keywords: ['quality test', 'inspection', 'qc', 'quality control', 'testing', 'check quality'] },
  { id: '4.3.4', name: 'Maintain production records and lot traceability', level: 3, parentId: '4.3', keywords: ['production records', 'lot traceability', 'batch', 'serial number'] },
  { id: '4.4', name: 'Deliver service to customer', level: 2, parentId: '4.0', keywords: ['service delivery', 'deliver service', 'service execution', 'field service'] },
  { id: '4.4.1', name: 'Confirm specific service requirements for customer', level: 3, parentId: '4.4', keywords: ['service requirements', 'customer requirements', 'scope of service'] },
  { id: '4.4.2', name: 'Identify and schedule resources for service', level: 3, parentId: '4.4', keywords: ['resource scheduling', 'service scheduling', 'dispatch', 'resource allocation'] },
  { id: '4.4.3', name: 'Provide service to specific customers', level: 3, parentId: '4.4', keywords: ['provide service', 'deliver service', 'service customer', 'perform service'] },
  { id: '4.4.4', name: 'Ensure quality of service', level: 3, parentId: '4.4', keywords: ['service quality', 'quality assurance', 'sla', 'service level'] },
  { id: '4.5', name: 'Manage logistics and warehousing', level: 2, parentId: '4.0', keywords: ['logistics', 'warehouse', 'inventory', 'shipping', 'transportation', 'distribution', 'freight'] },
  { id: '4.5.1', name: 'Define logistics strategy', level: 3, parentId: '4.5', keywords: ['logistics strategy', 'distribution strategy', 'network design'] },
  { id: '4.5.2', name: 'Manage inbound material flow', level: 3, parentId: '4.5', keywords: ['inbound', 'receiving', 'goods receipt', 'inbound logistics'] },
  { id: '4.5.3', name: 'Operate warehousing', level: 3, parentId: '4.5', keywords: ['warehouse', 'warehousing', 'storage', 'picking', 'packing', 'put away', 'wms'] },
  { id: '4.5.4', name: 'Operate outbound transportation', level: 3, parentId: '4.5', keywords: ['outbound', 'shipping', 'dispatch', 'delivery', 'transport', 'freight', 'carrier'] },
  { id: '4.5.5', name: 'Manage returns', level: 3, parentId: '4.5', keywords: ['returns', 'return', 'reverse logistics', 'rma', 'recall', 'refund'] },

  // ─────────────────────────────────────────────
  // 5. Manage Customer Service
  // ─────────────────────────────────────────────
  { id: '5.0', name: 'Manage Customer Service', level: 1, parentId: null, keywords: [] },
  { id: '5.1', name: 'Develop customer service strategy', level: 2, parentId: '5.0', keywords: ['customer service strategy', 'service policy', 'service level', 'customer experience'] },
  { id: '5.1.1', name: 'Develop customer service policies', level: 3, parentId: '5.1', keywords: ['service policy', 'customer policy', 'terms of service'] },
  { id: '5.1.2', name: 'Define service levels and metrics', level: 3, parentId: '5.1', keywords: ['service level', 'sla', 'kpi', 'nps', 'csat', 'metrics'] },
  { id: '5.1.3', name: 'Plan and manage customer service workforce', level: 3, parentId: '5.1', keywords: ['service staff', 'workforce planning', 'customer service team'] },
  { id: '5.2', name: 'Plan and manage customer service operations', level: 2, parentId: '5.0', keywords: ['service requests', 'complaints', 'returns', 'warranty', 'support', 'helpdesk', 'customer inquiry'] },
  { id: '5.2.1', name: 'Manage customer service requests and inquiries', level: 3, parentId: '5.2', keywords: ['service request', 'inquiry', 'ticket', 'case', 'customer inquiry', 'support request'] },
  { id: '5.2.2', name: 'Manage customer complaints', level: 3, parentId: '5.2', keywords: ['complaint', 'grievance', 'escalation', 'dispute', 'complain', 'dissatisfied'] },
  { id: '5.2.3', name: 'Manage product returns', level: 3, parentId: '5.2', keywords: ['return', 'product return', 'rma', 'refund', 'exchange'] },
  { id: '5.2.4', name: 'Manage warranties and service agreements', level: 3, parentId: '5.2', keywords: ['warranty', 'service agreement', 'sla', 'maintenance contract'] },
  { id: '5.3', name: 'Measure and evaluate customer service operations', level: 2, parentId: '5.0', keywords: ['customer satisfaction', 'service performance', 'feedback', 'nps', 'csat', 'service reporting'] },
  { id: '5.3.1', name: 'Measure customer service satisfaction', level: 3, parentId: '5.3', keywords: ['customer satisfaction', 'nps', 'csat', 'survey', 'feedback', 'satisfaction score'] },
  { id: '5.3.2', name: 'Evaluate customer service operations performance', level: 3, parentId: '5.3', keywords: ['service performance', 'evaluate service', 'operations review'] },
  { id: '5.3.3', name: 'Report customer service performance results', level: 3, parentId: '5.3', keywords: ['service report', 'performance report', 'dashboard', 'reporting'] },

  // ─────────────────────────────────────────────
  // 6. Develop and Manage Human Capital
  // ─────────────────────────────────────────────
  { id: '6.0', name: 'Develop and Manage Human Capital', level: 1, parentId: null, keywords: [] },
  { id: '6.1', name: 'Develop and manage HR planning, policies, and strategies', level: 2, parentId: '6.0', keywords: ['hr strategy', 'hr planning', 'workforce strategy', 'hr policy'] },
  { id: '6.1.1', name: 'Manage HR planning', level: 3, parentId: '6.1', keywords: ['hr planning', 'headcount planning', 'workforce planning', 'resource planning'] },
  { id: '6.1.2', name: 'Develop and implement HR strategies', level: 3, parentId: '6.1', keywords: ['hr strategy', 'people strategy', 'talent strategy'] },
  { id: '6.1.3', name: 'Monitor and update HR strategies', level: 3, parentId: '6.1', keywords: ['monitor hr', 'update hr strategy', 'hr review'] },
  { id: '6.2', name: 'Recruit, source, and select employees', level: 2, parentId: '6.0', keywords: ['recruitment', 'hiring', 'candidate', 'onboarding', 'hire', 'interview', 'job posting'] },
  { id: '6.2.1', name: 'Create and develop job requisitions', level: 3, parentId: '6.2', keywords: ['job requisition', 'job posting', 'open position', 'headcount request'] },
  { id: '6.2.2', name: 'Recruit candidates', level: 3, parentId: '6.2', keywords: ['recruit', 'sourcing', 'talent acquisition', 'headhunting', 'screen resume'] },
  { id: '6.2.3', name: 'Screen and select candidates', level: 3, parentId: '6.2', keywords: ['screen', 'interview', 'candidate selection', 'assessment', 'background check'] },
  { id: '6.2.4', name: 'Manage new hire onboarding', level: 3, parentId: '6.2', keywords: ['onboarding', 'induction', 'new hire', 'orientation', 'new employee'] },
  { id: '6.3', name: 'Develop and counsel employees', level: 2, parentId: '6.0', keywords: ['employee development', 'training', 'performance management', 'coaching', 'mentoring'] },
  { id: '6.3.1', name: 'Manage employee orientation and deployment', level: 3, parentId: '6.3', keywords: ['orientation', 'deployment', 'assignment', 'induction'] },
  { id: '6.3.2', name: 'Manage employee performance', level: 3, parentId: '6.3', keywords: ['performance review', 'appraisal', 'performance management', 'evaluation'] },
  { id: '6.3.3', name: 'Manage employee development', level: 3, parentId: '6.3', keywords: ['employee development', 'career development', 'development plan', 'idp'] },
  { id: '6.3.4', name: 'Develop and train employees', level: 3, parentId: '6.3', keywords: ['training', 'learning', 'l&d', 'skills development', 'course', 'upskill'] },
  { id: '6.3.5', name: 'Manage employee relations', level: 3, parentId: '6.3', keywords: ['employee relations', 'er', 'grievance', 'disciplinary', 'ir', 'industrial relations'] },
  { id: '6.4', name: 'Reward and retain employees', level: 2, parentId: '6.0', keywords: ['compensation', 'benefits', 'rewards', 'retention', 'salary', 'bonus', 'payroll'] },
  { id: '6.4.1', name: 'Develop and manage reward programs', level: 3, parentId: '6.4', keywords: ['reward', 'compensation', 'bonus', 'incentive', 'total rewards'] },
  { id: '6.4.2', name: 'Manage and administer benefits', level: 3, parentId: '6.4', keywords: ['benefits', 'health insurance', 'pension', 'leave', 'perks'] },
  { id: '6.4.3', name: 'Manage employee assistance and retention', level: 3, parentId: '6.4', keywords: ['retention', 'employee assistance', 'eap', 'engagement', 'turnover'] },
  { id: '6.5', name: 'Redeploy and retire employees', level: 2, parentId: '6.0', keywords: ['redundancy', 'separation', 'termination', 'retirement', 'offboarding', 'exit'] },
  { id: '6.5.1', name: 'Manage promotion and demotion process', level: 3, parentId: '6.5', keywords: ['promotion', 'demotion', 'transfer', 'role change'] },
  { id: '6.5.2', name: 'Manage separation', level: 3, parentId: '6.5', keywords: ['separation', 'resignation', 'termination', 'dismissal', 'offboarding', 'exit interview'] },
  { id: '6.5.3', name: 'Manage retirement', level: 3, parentId: '6.5', keywords: ['retirement', 'pension', 'retire'] },
  { id: '6.5.4', name: 'Manage leave of absence', level: 3, parentId: '6.5', keywords: ['leave', 'absence', 'maternity', 'paternity', 'sick leave', 'secondment'] },
  { id: '6.6', name: 'Manage employee information and analytics', level: 2, parentId: '6.0', keywords: ['hris', 'hr data', 'employee data', 'payroll data', 'people analytics'] },
  { id: '6.6.1', name: 'Manage reporting processes', level: 3, parentId: '6.6', keywords: ['hr reporting', 'headcount report', 'people data'] },
  { id: '6.6.2', name: 'Manage employee inquiry process', level: 3, parentId: '6.6', keywords: ['hr inquiry', 'employee inquiry', 'self service', 'employee portal'] },
  { id: '6.6.3', name: 'Manage and maintain employee data', level: 3, parentId: '6.6', keywords: ['employee data', 'hris', 'people data', 'employee records'] },

  // ─────────────────────────────────────────────
  // 7. Manage Information Technology
  // ─────────────────────────────────────────────
  { id: '7.0', name: 'Manage Information Technology', level: 1, parentId: null, keywords: [] },
  { id: '7.1', name: 'Manage the business of IT', level: 2, parentId: '7.0', keywords: ['it governance', 'it strategy', 'enterprise architecture', 'it budget', 'it portfolio'] },
  { id: '7.1.1', name: 'Develop IT strategy', level: 3, parentId: '7.1', keywords: ['it strategy', 'digital strategy', 'technology roadmap'] },
  { id: '7.1.2', name: 'Define the enterprise architecture', level: 3, parentId: '7.1', keywords: ['enterprise architecture', 'ea', 'architecture design', 'solution architecture'] },
  { id: '7.1.3', name: 'Manage IT portfolio and assets', level: 3, parentId: '7.1', keywords: ['it assets', 'software assets', 'hardware assets', 'it portfolio', 'licence'] },
  { id: '7.1.4', name: 'Perform IT financial management', level: 3, parentId: '7.1', keywords: ['it budget', 'it cost', 'technology spend', 'it financial'] },
  { id: '7.1.5', name: 'Manage IT vendors and contracts', level: 3, parentId: '7.1', keywords: ['it vendor', 'technology vendor', 'software contract', 'it contract'] },
  { id: '7.2', name: 'Develop and manage IT customer relationships', level: 2, parentId: '7.0', keywords: ['it service management', 'service desk', 'itsm', 'helpdesk', 'it support'] },
  { id: '7.2.1', name: 'Manage IT service levels', level: 3, parentId: '7.2', keywords: ['it sla', 'service levels', 'uptime', 'availability'] },
  { id: '7.2.2', name: 'Develop IT services communication plan', level: 3, parentId: '7.2', keywords: ['it communication', 'it announcement', 'change notification'] },
  { id: '7.2.3', name: 'Manage IT service desk', level: 3, parentId: '7.2', keywords: ['service desk', 'helpdesk', 'it support', 'incident', 'ticket', 'user support'] },
  { id: '7.3', name: 'Develop and implement security, privacy, and data protection controls', level: 2, parentId: '7.0', keywords: ['security', 'cybersecurity', 'privacy', 'data protection', 'gdpr', 'access control', 'infosec'] },
  { id: '7.3.1', name: 'Establish information security policies', level: 3, parentId: '7.3', keywords: ['security policy', 'information security', 'infosec policy', 'gdpr', 'privacy policy'] },
  { id: '7.3.2', name: 'Test and evaluate security controls', level: 3, parentId: '7.3', keywords: ['security testing', 'penetration test', 'security audit', 'vulnerability assessment'] },
  { id: '7.3.3', name: 'Manage access and authorization', level: 3, parentId: '7.3', keywords: ['access control', 'access management', 'iam', 'user access', 'provisioning', 'authorization'] },
  { id: '7.3.4', name: 'Manage security incidents', level: 3, parentId: '7.3', keywords: ['security incident', 'breach', 'cyber incident', 'incident response', 'data breach'] },
  { id: '7.4', name: 'Manage enterprise information', level: 2, parentId: '7.0', keywords: ['data management', 'data governance', 'master data', 'analytics', 'business intelligence', 'bi'] },
  { id: '7.4.1', name: 'Define the information architecture', level: 3, parentId: '7.4', keywords: ['information architecture', 'data architecture', 'data model', 'data dictionary'] },
  { id: '7.4.2', name: 'Manage information resources', level: 3, parentId: '7.4', keywords: ['information management', 'records management', 'document management'] },
  { id: '7.4.3', name: 'Perform enterprise data management', level: 3, parentId: '7.4', keywords: ['data management', 'data quality', 'master data', 'data governance'] },
  { id: '7.4.4', name: 'Manage business intelligence and analytics', level: 3, parentId: '7.4', keywords: ['business intelligence', 'bi', 'analytics', 'reporting', 'dashboard', 'data analysis'] },
  { id: '7.5', name: 'Develop and maintain IT solutions', level: 2, parentId: '7.0', keywords: ['software development', 'application development', 'system development', 'coding', 'sdlc'] },
  { id: '7.5.1', name: 'Develop the IT solution strategy', level: 3, parentId: '7.5', keywords: ['solution strategy', 'build vs buy', 'it solution'] },
  { id: '7.5.2', name: 'Perform IT research and development', level: 3, parentId: '7.5', keywords: ['it r&d', 'proof of concept', 'poc', 'prototype', 'technology research'] },
  { id: '7.5.3', name: 'Develop and maintain IT applications', level: 3, parentId: '7.5', keywords: ['application development', 'software development', 'coding', 'programming', 'bug fix', 'development'] },
  { id: '7.5.4', name: 'Manage IT testing', level: 3, parentId: '7.5', keywords: ['testing', 'qa', 'quality assurance', 'uat', 'test case', 'test plan'] },
  { id: '7.6', name: 'Deploy IT solutions', level: 2, parentId: '7.0', keywords: ['deployment', 'release', 'go live', 'implementation', 'rollout', 'migration'] },
  { id: '7.6.1', name: 'Plan IT deployment', level: 3, parentId: '7.6', keywords: ['deployment plan', 'release plan', 'go-live plan', 'cutover'] },
  { id: '7.6.2', name: 'Deploy IT solutions', level: 3, parentId: '7.6', keywords: ['deploy', 'release', 'go live', 'install', 'rollout', 'cutover'] },
  { id: '7.6.3', name: 'Validate IT solutions', level: 3, parentId: '7.6', keywords: ['validate', 'sign off', 'acceptance', 'uat', 'post-implementation review'] },
  { id: '7.7', name: 'Deliver and support IT services', level: 2, parentId: '7.0', keywords: ['it operations', 'infrastructure', 'cloud', 'monitoring', 'it service', 'support'] },
  { id: '7.7.1', name: 'Manage IT infrastructure', level: 3, parentId: '7.7', keywords: ['infrastructure', 'servers', 'network', 'cloud', 'hosting', 'datacenter'] },
  { id: '7.7.2', name: 'Manage IT continuity', level: 3, parentId: '7.7', keywords: ['business continuity', 'disaster recovery', 'dr', 'backup', 'recovery'] },
  { id: '7.7.3', name: 'Support IT solutions', level: 3, parentId: '7.7', keywords: ['it support', 'technical support', 'helpdesk', 'incident management', 'problem management'] },
  { id: '7.7.4', name: 'Manage IT performance', level: 3, parentId: '7.7', keywords: ['it performance', 'monitoring', 'capacity', 'uptime', 'it metrics'] },
  { id: '7.8', name: 'Manage IT knowledge', level: 2, parentId: '7.0', keywords: ['it documentation', 'it training', 'knowledge base', 'runbook'] },
  { id: '7.8.1', name: 'Develop and manage IT training', level: 3, parentId: '7.8', keywords: ['it training', 'user training', 'system training', 'onboarding'] },
  { id: '7.8.2', name: 'Manage IT documentation', level: 3, parentId: '7.8', keywords: ['documentation', 'runbook', 'knowledge base', 'wiki', 'user manual'] },

  // ─────────────────────────────────────────────
  // 8. Manage Financial Resources
  // ─────────────────────────────────────────────
  { id: '8.0', name: 'Manage Financial Resources', level: 1, parentId: null, keywords: [] },
  { id: '8.1', name: 'Plan and manage accounting and finance', level: 2, parentId: '8.0', keywords: ['finance', 'accounting', 'financial planning', 'budgeting', 'financial control'] },
  { id: '8.1.1', name: 'Develop financial strategy', level: 3, parentId: '8.1', keywords: ['financial strategy', 'finance strategy', 'capital structure'] },
  { id: '8.1.2', name: 'Manage financial planning', level: 3, parentId: '8.1', keywords: ['financial planning', 'fp&a', 'forecasting', 'financial forecast'] },
  { id: '8.1.3', name: 'Manage budgeting', level: 3, parentId: '8.1', keywords: ['budget', 'budgeting', 'budget approval', 'capex', 'opex'] },
  { id: '8.1.4', name: 'Manage financial control and reporting', level: 3, parentId: '8.1', keywords: ['financial control', 'financial reporting', 'management accounts', 'close', 'month end'] },
  { id: '8.2', name: 'Perform revenue accounting', level: 2, parentId: '8.0', keywords: ['accounts receivable', 'invoicing', 'billing', 'collections', 'credit', 'ar'] },
  { id: '8.2.1', name: 'Process customer credit', level: 3, parentId: '8.2', keywords: ['credit', 'credit check', 'credit limit', 'credit approval'] },
  { id: '8.2.2', name: 'Invoice customers', level: 3, parentId: '8.2', keywords: ['invoice', 'invoicing', 'billing', 'customer invoice', 'raise invoice'] },
  { id: '8.2.3', name: 'Process accounts receivable', level: 3, parentId: '8.2', keywords: ['accounts receivable', 'ar', 'payment received', 'cash allocation', 'remittance'] },
  { id: '8.2.4', name: 'Manage and process collections', level: 3, parentId: '8.2', keywords: ['collections', 'debt collection', 'overdue', 'chase payment', 'dunning'] },
  { id: '8.3', name: 'Perform general accounting and reporting', level: 2, parentId: '8.0', keywords: ['general ledger', 'journal', 'consolidation', 'trial balance', 'financial statements', 'gl'] },
  { id: '8.3.1', name: 'Maintain chart of accounts', level: 3, parentId: '8.3', keywords: ['chart of accounts', 'coa', 'gl codes', 'account codes'] },
  { id: '8.3.2', name: 'Process journal entries', level: 3, parentId: '8.3', keywords: ['journal entry', 'journal', 'posting', 'accrual', 'gl posting'] },
  { id: '8.3.3', name: 'Process allocations', level: 3, parentId: '8.3', keywords: ['allocation', 'cost allocation', 'recharge', 'intercompany'] },
  { id: '8.3.4', name: 'Perform consolidation and elimination', level: 3, parentId: '8.3', keywords: ['consolidation', 'elimination', 'group accounts', 'intercompany elimination'] },
  { id: '8.3.5', name: 'Prepare trial balance', level: 3, parentId: '8.3', keywords: ['trial balance', 'pre-close', 'close checklist'] },
  { id: '8.3.6', name: 'Prepare and publish financial statements', level: 3, parentId: '8.3', keywords: ['financial statements', 'balance sheet', 'income statement', 'p&l', 'cash flow statement'] },
  { id: '8.4', name: 'Manage fixed-asset accounting', level: 2, parentId: '8.0', keywords: ['fixed assets', 'asset register', 'depreciation', 'capex', 'tangible assets'] },
  { id: '8.4.1', name: 'Maintain fixed-asset master data', level: 3, parentId: '8.4', keywords: ['asset master data', 'asset register', 'fixed asset record'] },
  { id: '8.4.2', name: 'Process fixed-asset additions and disposals', level: 3, parentId: '8.4', keywords: ['asset addition', 'asset disposal', 'capex', 'asset write-off'] },
  { id: '8.4.3', name: 'Process fixed-asset adjustments and revaluations', level: 3, parentId: '8.4', keywords: ['asset revaluation', 'asset adjustment', 'impairment'] },
  { id: '8.4.4', name: 'Calculate and record depreciation', level: 3, parentId: '8.4', keywords: ['depreciation', 'amortization', 'depreciation run'] },
  { id: '8.5', name: 'Process payroll', level: 2, parentId: '8.0', keywords: ['payroll', 'salary', 'wages', 'pay run', 'payslip', 'paye', 'tax withholding'] },
  { id: '8.5.1', name: 'Report time worked', level: 3, parentId: '8.5', keywords: ['timesheet', 'time reporting', 'time tracking', 'hours worked'] },
  { id: '8.5.2', name: 'Maintain and administer employee pay', level: 3, parentId: '8.5', keywords: ['pay administration', 'salary administration', 'pay change'] },
  { id: '8.5.3', name: 'Process and distribute payroll', level: 3, parentId: '8.5', keywords: ['payroll run', 'pay run', 'payslip', 'salary payment', 'process payroll'] },
  { id: '8.5.4', name: 'Process payroll taxes', level: 3, parentId: '8.5', keywords: ['payroll tax', 'paye', 'national insurance', 'tax withholding', 'payroll deduction'] },
  { id: '8.6', name: 'Process accounts payable and expense reimbursements', level: 2, parentId: '8.0', keywords: ['accounts payable', 'ap', 'vendor invoice', 'supplier payment', 'expense', 'reimbursement', 'invoice approval', 'purchase invoice'] },
  { id: '8.6.1', name: 'Process/maintain vendor master data', level: 3, parentId: '8.6', keywords: ['vendor master', 'supplier master', 'vendor data', 'supplier data', 'vendor setup'] },
  { id: '8.6.2', name: 'Process vendor invoices', level: 3, parentId: '8.6', keywords: ['vendor invoice', 'supplier invoice', 'invoice processing', 'invoice matching', 'three-way match', 'purchase order match', 'po match', 'check po'] },
  { id: '8.6.3', name: 'Process accounts payable', level: 3, parentId: '8.6', keywords: ['accounts payable', 'ap', 'payment run', 'pay supplier', 'process payment', 'supplier payment', 'vendor payment', 'payment processing'] },
  { id: '8.6.4', name: 'Process expense reimbursements', level: 3, parentId: '8.6', keywords: ['expense claim', 'expense report', 'reimbursement', 'travel expense', 'out of pocket'] },
  { id: '8.7', name: 'Manage treasury operations', level: 2, parentId: '8.0', keywords: ['treasury', 'cash management', 'liquidity', 'foreign exchange', 'fx', 'hedging'] },
  { id: '8.7.1', name: 'Manage cash', level: 3, parentId: '8.7', keywords: ['cash management', 'cash flow', 'liquidity', 'cash forecasting', 'bank reconciliation'] },
  { id: '8.7.2', name: 'Manage financial risks', level: 3, parentId: '8.7', keywords: ['financial risk', 'fx risk', 'interest rate risk', 'hedging', 'derivatives'] },
  { id: '8.7.3', name: 'Manage corporate finance', level: 3, parentId: '8.7', keywords: ['corporate finance', 'capital raising', 'debt', 'equity', 'ipo', 'financing'] },
  { id: '8.7.4', name: 'Process and oversee electronic fund transfers', level: 3, parentId: '8.7', keywords: ['eft', 'wire transfer', 'bank transfer', 'payment', 'bacs', 'swift'] },
  { id: '8.8', name: 'Manage internal controls', level: 2, parentId: '8.0', keywords: ['internal controls', 'sox', 'audit', 'control framework', 'icfr'] },
  { id: '8.8.1', name: 'Establish internal controls policies and procedures', level: 3, parentId: '8.8', keywords: ['internal control policy', 'control framework', 'sox', 'icfr'] },
  { id: '8.8.2', name: 'Operate and monitor internal controls', level: 3, parentId: '8.8', keywords: ['control testing', 'control monitoring', 'control operation'] },
  { id: '8.8.3', name: 'Report on internal controls', level: 3, parentId: '8.8', keywords: ['control report', 'sox report', 'audit report', 'control deficiency'] },
  { id: '8.9', name: 'Manage taxes', level: 2, parentId: '8.0', keywords: ['tax', 'taxation', 'vat', 'gst', 'corporate tax', 'tax return', 'tax compliance'] },
  { id: '8.9.1', name: 'Develop tax strategy and plan', level: 3, parentId: '8.9', keywords: ['tax strategy', 'tax planning', 'tax optimization'] },
  { id: '8.9.2', name: 'Process tax transactions', level: 3, parentId: '8.9', keywords: ['tax transaction', 'vat transaction', 'tax posting', 'gst'] },
  { id: '8.9.3', name: 'Prepare tax returns and reports', level: 3, parentId: '8.9', keywords: ['tax return', 'tax filing', 'tax report', 'vat return'] },
  { id: '8.9.4', name: 'Manage tax audits', level: 3, parentId: '8.9', keywords: ['tax audit', 'tax investigation', 'hmrc', 'irs'] },

  // ─────────────────────────────────────────────
  // 9. Acquire, Construct, and Manage Assets
  // ─────────────────────────────────────────────
  { id: '9.0', name: 'Acquire, Construct, and Manage Assets', level: 1, parentId: null, keywords: [] },
  { id: '9.1', name: 'Design and construct productive assets', level: 2, parentId: '9.0', keywords: ['capital project', 'construction', 'asset design', 'facility design', 'capex project'] },
  { id: '9.1.1', name: 'Define asset requirements', level: 3, parentId: '9.1', keywords: ['asset requirements', 'capital requirements', 'business case'] },
  { id: '9.1.2', name: 'Design and engineer assets', level: 3, parentId: '9.1', keywords: ['asset design', 'engineering', 'technical design', 'specification'] },
  { id: '9.1.3', name: 'Construct and commission assets', level: 3, parentId: '9.1', keywords: ['construction', 'commissioning', 'build', 'fit out', 'handover'] },
  { id: '9.2', name: 'Acquire and manage assets', level: 2, parentId: '9.0', keywords: ['asset acquisition', 'facilities', 'property', 'fleet', 'lease', 'real estate'] },
  { id: '9.2.1', name: 'Manage facilities', level: 3, parentId: '9.2', keywords: ['facilities', 'facility management', 'office', 'building management', 'fm'] },
  { id: '9.2.2', name: 'Manage fleet/vehicles', level: 3, parentId: '9.2', keywords: ['fleet', 'vehicles', 'cars', 'fleet management', 'vehicle maintenance'] },
  { id: '9.2.3', name: 'Manage real property portfolio', level: 3, parentId: '9.2', keywords: ['real estate', 'property', 'lease', 'property management', 'real property'] },
  { id: '9.2.4', name: 'Manage lease and owned assets', level: 3, parentId: '9.2', keywords: ['lease', 'operating lease', 'owned assets', 'asset management'] },
  { id: '9.3', name: 'Manage asset maintenance', level: 2, parentId: '9.0', keywords: ['maintenance', 'asset maintenance', 'preventive maintenance', 'corrective maintenance', 'repair'] },
  { id: '9.3.1', name: 'Develop asset maintenance plan', level: 3, parentId: '9.3', keywords: ['maintenance plan', 'preventive maintenance plan', 'maintenance schedule'] },
  { id: '9.3.2', name: 'Perform preventive maintenance', level: 3, parentId: '9.3', keywords: ['preventive maintenance', 'scheduled maintenance', 'ppm', 'planned maintenance'] },
  { id: '9.3.3', name: 'Perform corrective maintenance', level: 3, parentId: '9.3', keywords: ['corrective maintenance', 'repair', 'breakdown', 'fault', 'remedial'] },
  { id: '9.3.4', name: 'Manage asset maintenance records', level: 3, parentId: '9.3', keywords: ['maintenance records', 'asset history', 'work order records'] },
  { id: '9.4', name: 'Dispose of assets', level: 2, parentId: '9.0', keywords: ['asset disposal', 'decommission', 'write off', 'scrap', 'sell asset'] },
  { id: '9.4.1', name: 'Develop asset disposal strategy', level: 3, parentId: '9.4', keywords: ['disposal strategy', 'end of life strategy', 'decommission plan'] },
  { id: '9.4.2', name: 'Execute asset disposal', level: 3, parentId: '9.4', keywords: ['dispose asset', 'sell asset', 'scrap', 'auction', 'decommission'] },
  { id: '9.4.3', name: 'Record and report asset disposal', level: 3, parentId: '9.4', keywords: ['record disposal', 'disposal report', 'asset write-off'] },

  // ─────────────────────────────────────────────
  // 10. Manage Enterprise Risk, Compliance, Ethics, and Resiliency
  // ─────────────────────────────────────────────
  { id: '10.0', name: 'Manage Enterprise Risk, Compliance, Ethics, and Resiliency', level: 1, parentId: null, keywords: [] },
  { id: '10.1', name: 'Manage enterprise risk', level: 2, parentId: '10.0', keywords: ['risk management', 'enterprise risk', 'erm', 'risk register', 'risk assessment'] },
  { id: '10.1.1', name: 'Establish the enterprise risk framework', level: 3, parentId: '10.1', keywords: ['risk framework', 'erm framework', 'risk policy', 'coso'] },
  { id: '10.1.2', name: 'Identify and assess risks', level: 3, parentId: '10.1', keywords: ['risk identification', 'risk assessment', 'risk register', 'risk analysis'] },
  { id: '10.1.3', name: 'Develop risk treatment strategies', level: 3, parentId: '10.1', keywords: ['risk treatment', 'risk mitigation', 'risk response', 'risk controls'] },
  { id: '10.1.4', name: 'Monitor and report risks', level: 3, parentId: '10.1', keywords: ['risk monitoring', 'risk reporting', 'risk dashboard', 'risk review'] },
  { id: '10.2', name: 'Manage compliance', level: 2, parentId: '10.0', keywords: ['compliance', 'regulatory compliance', 'regulatory reporting', 'audit', 'regulations'] },
  { id: '10.2.1', name: 'Identify regulatory and compliance requirements', level: 3, parentId: '10.2', keywords: ['regulatory requirements', 'compliance requirements', 'regulations', 'legislation'] },
  { id: '10.2.2', name: 'Manage compliance monitoring and reporting', level: 3, parentId: '10.2', keywords: ['compliance monitoring', 'compliance reporting', 'regulatory reporting'] },
  { id: '10.2.3', name: 'Manage regulatory relationships', level: 3, parentId: '10.2', keywords: ['regulator', 'regulatory relationship', 'regulatory body'] },
  { id: '10.3', name: 'Manage ethics program', level: 2, parentId: '10.0', keywords: ['ethics', 'code of conduct', 'whistleblowing', 'integrity', 'anti-bribery', 'anti-corruption'] },
  { id: '10.3.1', name: 'Establish the ethics management framework', level: 3, parentId: '10.3', keywords: ['ethics framework', 'code of conduct', 'ethics policy'] },
  { id: '10.3.2', name: 'Administer ethics and compliance program', level: 3, parentId: '10.3', keywords: ['ethics program', 'compliance program', 'ethics training'] },
  { id: '10.3.3', name: 'Manage ethics investigations', level: 3, parentId: '10.3', keywords: ['ethics investigation', 'whistleblower', 'misconduct', 'investigation'] },
  { id: '10.4', name: 'Manage business resiliency', level: 2, parentId: '10.0', keywords: ['business continuity', 'disaster recovery', 'bcp', 'resilience', 'crisis management'] },
  { id: '10.4.1', name: 'Develop business continuity plan', level: 3, parentId: '10.4', keywords: ['bcp', 'business continuity plan', 'continuity planning'] },
  { id: '10.4.2', name: 'Test business continuity plan', level: 3, parentId: '10.4', keywords: ['bcp test', 'continuity test', 'tabletop exercise', 'disaster recovery test'] },
  { id: '10.4.3', name: 'Execute business continuity plan', level: 3, parentId: '10.4', keywords: ['execute bcp', 'invoke bcp', 'crisis response', 'continuity activation'] },

  // ─────────────────────────────────────────────
  // 11. Manage External Relationships
  // ─────────────────────────────────────────────
  { id: '11.0', name: 'Manage External Relationships', level: 1, parentId: null, keywords: [] },
  { id: '11.1', name: 'Build investor relationships', level: 2, parentId: '11.0', keywords: ['investor relations', 'shareholders', 'investor communication', 'equity', 'analyst'] },
  { id: '11.1.1', name: 'Plan investor relations strategy', level: 3, parentId: '11.1', keywords: ['investor strategy', 'ir strategy', 'investor plan'] },
  { id: '11.1.2', name: 'Manage investor communications', level: 3, parentId: '11.1', keywords: ['investor communication', 'earnings call', 'shareholder communication', 'annual report'] },
  { id: '11.1.3', name: 'Manage shareholder meetings', level: 3, parentId: '11.1', keywords: ['agm', 'shareholder meeting', 'annual general meeting', 'egm'] },
  { id: '11.2', name: 'Manage government and industry relationships', level: 2, parentId: '11.0', keywords: ['government relations', 'lobbying', 'industry association', 'public policy'] },
  { id: '11.2.1', name: 'Manage government relationships', level: 3, parentId: '11.2', keywords: ['government relations', 'lobbying', 'public affairs', 'regulatory engagement'] },
  { id: '11.2.2', name: 'Manage industry association relationships', level: 3, parentId: '11.2', keywords: ['industry association', 'trade body', 'trade association', 'membership'] },
  { id: '11.2.3', name: 'Manage public policy development', level: 3, parentId: '11.2', keywords: ['public policy', 'policy advocacy', 'regulatory consultation'] },
  { id: '11.3', name: 'Manage relations with board of directors', level: 2, parentId: '11.0', keywords: ['board', 'board of directors', 'governance', 'board reporting', 'board meeting'] },
  { id: '11.3.1', name: 'Report financial results to board', level: 3, parentId: '11.3', keywords: ['board financial report', 'board pack', 'financial results'] },
  { id: '11.3.2', name: 'Communicate operational performance to board', level: 3, parentId: '11.3', keywords: ['board report', 'board pack', 'operational performance', 'board update'] },
  { id: '11.3.3', name: 'Manage governance issues', level: 3, parentId: '11.3', keywords: ['governance', 'board governance', 'corporate governance'] },
  { id: '11.4', name: 'Manage legal and ethical issues', level: 2, parentId: '11.0', keywords: ['legal', 'contract', 'litigation', 'intellectual property', 'legal compliance', 'ip'] },
  { id: '11.4.1', name: 'Create and manage legal policies and procedures', level: 3, parentId: '11.4', keywords: ['legal policy', 'legal procedure', 'legal framework'] },
  { id: '11.4.2', name: 'Manage corporate governance', level: 3, parentId: '11.4', keywords: ['corporate governance', 'governance framework', 'board charter'] },
  { id: '11.4.3', name: 'Protect intellectual property', level: 3, parentId: '11.4', keywords: ['intellectual property', 'ip', 'patent', 'trademark', 'copyright'] },
  { id: '11.4.4', name: 'Resolve disputes and litigation', level: 3, parentId: '11.4', keywords: ['litigation', 'dispute', 'legal dispute', 'arbitration', 'mediation', 'legal claim'] },
  { id: '11.5', name: 'Manage public relations program', level: 2, parentId: '11.0', keywords: ['public relations', 'pr', 'media', 'communications', 'press'] },
  { id: '11.5.1', name: 'Manage external communications', level: 3, parentId: '11.5', keywords: ['external communications', 'corporate communications', 'press release', 'announcement'] },
  { id: '11.5.2', name: 'Manage media relations', level: 3, parentId: '11.5', keywords: ['media relations', 'press', 'journalist', 'media enquiry', 'spokesperson'] },
  { id: '11.5.3', name: 'Promote political stability', level: 3, parentId: '11.5', keywords: ['political stability', 'community relations', 'stakeholder engagement'] },

  // ─────────────────────────────────────────────
  // 12. Develop and Manage Business Capabilities
  // ─────────────────────────────────────────────
  { id: '12.0', name: 'Develop and Manage Business Capabilities', level: 1, parentId: null, keywords: [] },
  { id: '12.1', name: 'Manage business processes', level: 2, parentId: '12.0', keywords: ['process management', 'bpm', 'process improvement', 'process documentation', 'process model', 'bpmn'] },
  { id: '12.1.1', name: 'Establish and maintain process management governance', level: 3, parentId: '12.1', keywords: ['process governance', 'bpm governance', 'process owner'] },
  { id: '12.1.2', name: 'Define and manage process framework', level: 3, parentId: '12.1', keywords: ['process framework', 'process architecture', 'process hierarchy'] },
  { id: '12.1.3', name: 'Model and document processes', level: 3, parentId: '12.1', keywords: ['process modelling', 'process documentation', 'bpmn', 'process mapping', 'swimlane'] },
  { id: '12.1.4', name: 'Analyze and improve processes', level: 3, parentId: '12.1', keywords: ['process improvement', 'lean', 'six sigma', 'kaizen', 'process analysis', 'continuous improvement'] },
  { id: '12.2', name: 'Manage portfolio, programs, and projects', level: 2, parentId: '12.0', keywords: ['project management', 'program management', 'pmo', 'project planning', 'project delivery'] },
  { id: '12.2.1', name: 'Manage portfolio', level: 3, parentId: '12.2', keywords: ['portfolio management', 'investment portfolio', 'project portfolio'] },
  { id: '12.2.2', name: 'Manage programs', level: 3, parentId: '12.2', keywords: ['program management', 'programme', 'program delivery'] },
  { id: '12.2.3', name: 'Manage projects', level: 3, parentId: '12.2', keywords: ['project management', 'project plan', 'project delivery', 'milestones', 'project tracking'] },
  { id: '12.2.4', name: 'Manage project resources', level: 3, parentId: '12.2', keywords: ['resource management', 'project resource', 'capacity planning', 'resource allocation'] },
  { id: '12.3', name: 'Manage quality', level: 2, parentId: '12.0', keywords: ['quality management', 'quality assurance', 'qa', 'iso', 'quality control', 'audit'] },
  { id: '12.3.1', name: 'Establish quality management framework', level: 3, parentId: '12.3', keywords: ['quality framework', 'iso 9001', 'quality management system', 'qms'] },
  { id: '12.3.2', name: 'Plan and manage quality', level: 3, parentId: '12.3', keywords: ['quality planning', 'quality management', 'quality objectives'] },
  { id: '12.3.3', name: 'Perform quality audits', level: 3, parentId: '12.3', keywords: ['quality audit', 'audit', 'internal audit', 'quality review'] },
  { id: '12.3.4', name: 'Manage product and service quality', level: 3, parentId: '12.3', keywords: ['product quality', 'service quality', 'defect', 'non-conformance', 'quality control'] },
  { id: '12.4', name: 'Manage change', level: 2, parentId: '12.0', keywords: ['change management', 'organizational change', 'transformation', 'change adoption'] },
  { id: '12.4.1', name: 'Plan for change', level: 3, parentId: '12.4', keywords: ['change plan', 'change readiness', 'impact assessment', 'change strategy'] },
  { id: '12.4.2', name: 'Design the change', level: 3, parentId: '12.4', keywords: ['change design', 'to-be state', 'future state', 'solution design'] },
  { id: '12.4.3', name: 'Implement the change', level: 3, parentId: '12.4', keywords: ['implement change', 'deploy change', 'roll out change', 'change delivery'] },
  { id: '12.4.4', name: 'Sustain the change', level: 3, parentId: '12.4', keywords: ['sustain change', 'embed change', 'reinforcement', 'change adoption'] },
  { id: '12.5', name: 'Develop and manage enterprise knowledge management', level: 2, parentId: '12.0', keywords: ['knowledge management', 'knowledge base', 'knowledge sharing', 'documentation'] },
  { id: '12.5.1', name: 'Establish knowledge management framework', level: 3, parentId: '12.5', keywords: ['knowledge framework', 'km strategy', 'knowledge governance'] },
  { id: '12.5.2', name: 'Manage knowledge', level: 3, parentId: '12.5', keywords: ['manage knowledge', 'knowledge capture', 'knowledge repository', 'lessons learned'] },
  { id: '12.5.3', name: 'Share and distribute knowledge', level: 3, parentId: '12.5', keywords: ['share knowledge', 'knowledge sharing', 'communities of practice', 'collaboration'] },
  { id: '12.6', name: 'Measure and benchmark', level: 2, parentId: '12.0', keywords: ['benchmarking', 'performance measurement', 'metrics', 'kpi', 'scorecard', 'measurement'] },
  { id: '12.6.1', name: 'Establish measurement systems', level: 3, parentId: '12.6', keywords: ['measurement system', 'metrics framework', 'kpi definition'] },
  { id: '12.6.2', name: 'Benchmark performance', level: 3, parentId: '12.6', keywords: ['benchmarking', 'benchmark', 'peer comparison', 'industry benchmark'] },
  { id: '12.6.3', name: 'Evaluate benchmarking information', level: 3, parentId: '12.6', keywords: ['benchmark analysis', 'evaluate benchmark', 'gap analysis'] },
  { id: '12.7', name: 'Manage environmental health and safety (EHS)', level: 2, parentId: '12.0', keywords: ['ehs', 'health safety', 'hse', 'environment', 'safety', 'osha', 'incident reporting'] },
  { id: '12.7.1', name: 'Develop EHS strategy', level: 3, parentId: '12.7', keywords: ['ehs strategy', 'hse strategy', 'safety strategy', 'environmental strategy'] },
  { id: '12.7.2', name: 'Perform environmental management', level: 3, parentId: '12.7', keywords: ['environmental management', 'emissions', 'waste management', 'carbon footprint'] },
  { id: '12.7.3', name: 'Manage health and safety', level: 3, parentId: '12.7', keywords: ['health and safety', 'hse', 'safety management', 'incident', 'near miss', 'risk assessment'] },
  { id: '12.7.4', name: 'Ensure compliance with EHS regulations', level: 3, parentId: '12.7', keywords: ['ehs compliance', 'safety regulations', 'environmental regulations', 'osha', 'hse compliance'] },
  { id: '12.8', name: 'Manage facilities', level: 2, parentId: '12.0', keywords: ['facilities management', 'office management', 'building services', 'reception', 'workspace'] },
  { id: '12.8.1', name: 'Plan and manage facilities strategy', level: 3, parentId: '12.8', keywords: ['facilities strategy', 'workplace strategy', 'office strategy'] },
  { id: '12.8.2', name: 'Provide facility operations', level: 3, parentId: '12.8', keywords: ['facility operations', 'building operations', 'office services', 'cleaning', 'catering'] },
  { id: '12.8.3', name: 'Manage facility security', level: 3, parentId: '12.8', keywords: ['facility security', 'physical security', 'access control', 'cctv', 'security guard'] },
];

/** Build a nested tree structure from the flat APQC_NODES array */
export function buildApqcTree() {
  const map = {};
  APQC_NODES.forEach(n => { map[n.id] = { ...n, children: [] }; });
  const roots = [];
  APQC_NODES.forEach(n => {
    if (n.parentId === null) {
      roots.push(map[n.id]);
    } else if (map[n.parentId]) {
      map[n.parentId].children.push(map[n.id]);
    }
  });
  return roots;
}

/** Get all descendant IDs of a node (inclusive) */
export function getDescendantIds(nodeId) {
  const ids = new Set([nodeId]);
  const queue = [nodeId];
  while (queue.length) {
    const current = queue.shift();
    APQC_NODES.filter(n => n.parentId === current).forEach(n => {
      ids.add(n.id);
      queue.push(n.id);
    });
  }
  return ids;
}
