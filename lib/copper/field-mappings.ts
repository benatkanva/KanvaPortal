// Copper CRM Field Mappings

export interface CopperFieldMapping {
  copperField: string;
  firestoreField: string;
  type: 'text' | 'number' | 'date' | 'boolean' | 'dropdown' | 'custom';
  customFieldId?: number;
}

// Standard Copper company fields
export const companyFieldMappings: CopperFieldMapping[] = [
  { copperField: 'id', firestoreField: 'copperId', type: 'number' },
  { copperField: 'name', firestoreField: 'name', type: 'text' },
  { copperField: 'address', firestoreField: 'address', type: 'text' },
  { copperField: 'city', firestoreField: 'city', type: 'text' },
  { copperField: 'state', firestoreField: 'state', type: 'text' },
  { copperField: 'postal_code', firestoreField: 'zip', type: 'text' },
  { copperField: 'phone_numbers', firestoreField: 'phone', type: 'text' },
  { copperField: 'email_domain', firestoreField: 'emailDomain', type: 'text' },
  { copperField: 'assignee_id', firestoreField: 'assigneeId', type: 'number' },
  { copperField: 'contact_type_id', firestoreField: 'contactTypeId', type: 'number' },
];

// Standard Copper person/contact fields
export const personFieldMappings: CopperFieldMapping[] = [
  { copperField: 'id', firestoreField: 'copperId', type: 'number' },
  { copperField: 'name', firestoreField: 'name', type: 'text' },
  { copperField: 'first_name', firestoreField: 'firstName', type: 'text' },
  { copperField: 'last_name', firestoreField: 'lastName', type: 'text' },
  { copperField: 'emails', firestoreField: 'email', type: 'text' },
  { copperField: 'phone_numbers', firestoreField: 'phone', type: 'text' },
  { copperField: 'company_id', firestoreField: 'companyId', type: 'number' },
  { copperField: 'company_name', firestoreField: 'companyName', type: 'text' },
];

// Pipeline stage mappings
export const pipelineStages = {
  leads: [
    { id: 1, name: 'New Lead', order: 1 },
    { id: 2, name: 'Contacted', order: 2 },
    { id: 3, name: 'Qualified', order: 3 },
    { id: 4, name: 'Proposal Sent', order: 4 },
    { id: 5, name: 'Won', order: 5 },
    { id: 6, name: 'Lost', order: 6 },
  ],
  opportunities: [
    { id: 1, name: 'Discovery', order: 1 },
    { id: 2, name: 'Proposal', order: 2 },
    { id: 3, name: 'Negotiation', order: 3 },
    { id: 4, name: 'Closed Won', order: 4 },
    { id: 5, name: 'Closed Lost', order: 5 },
  ],
};

// Validate pipeline stage exists
export function validatePipelineStage(pipelineType: 'leads' | 'opportunities', stageId: number): boolean {
  const stages = pipelineStages[pipelineType];
  return stages.some(stage => stage.id === stageId);
}

// Get stage name by ID
export function getStageName(pipelineType: 'leads' | 'opportunities', stageId: number): string | null {
  const stages = pipelineStages[pipelineType];
  const stage = stages.find(s => s.id === stageId);
  return stage?.name || null;
}

// Custom field helpers
export function extractCustomFieldValue(customFields: any[], fieldId: number): any {
  if (!customFields || !Array.isArray(customFields)) return null;
  const field = customFields.find(cf => cf.custom_field_definition_id === fieldId);
  return field?.value || null;
}

// Get opportunity stage ID by name
export function getOpportunityStageId(stageName: string): number | null {
  const stage = pipelineStages.opportunities.find(
    s => s.name.toLowerCase() === stageName.toLowerCase()
  );
  return stage?.id || null;
}

// Get lead stage ID by name
export function getLeadStageId(stageName: string): number | null {
  const stage = pipelineStages.leads.find(
    s => s.name.toLowerCase() === stageName.toLowerCase()
  );
  return stage?.id || null;
}
