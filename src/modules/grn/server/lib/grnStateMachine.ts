export type GrnStatus = 'draft' | 'quality_inspection' | 'accepted' | 'stock_updated';

const validTransitions: Record<GrnStatus, GrnStatus[]> = {
  draft: ['quality_inspection', 'accepted'],
  quality_inspection: ['accepted', 'draft'],
  accepted: ['stock_updated'],
  stock_updated: [],
};

export const GRN_STATUS_LABELS: Record<GrnStatus, string> = {
  draft: 'Draft',
  quality_inspection: 'Quality Inspection',
  accepted: 'Accepted',
  stock_updated: 'Stock Updated',
};

export const GRN_LIFECYCLE_STAGES: GrnStatus[] = [
  'draft',
  'quality_inspection',
  'accepted',
  'stock_updated',
];

export function canTransition(currentStatus: GrnStatus, targetStatus: GrnStatus): boolean {
  return validTransitions[currentStatus]?.includes(targetStatus) ?? false;
}

export function validateTransition(
  currentStatus: GrnStatus,
  targetStatus: GrnStatus
): { valid: boolean; error?: string } {
  if (!validTransitions[currentStatus]) {
    return { valid: false, error: `Unknown current status: ${currentStatus}` };
  }

  if (!canTransition(currentStatus, targetStatus)) {
    const allowed = validTransitions[currentStatus];
    return {
      valid: false,
      error: `Cannot transition from '${currentStatus}' to '${targetStatus}'. Allowed: ${allowed.length > 0 ? allowed.join(', ') : 'none'}`,
    };
  }

  return { valid: true };
}

export function getAvailableTransitions(currentStatus: GrnStatus): GrnStatus[] {
  return validTransitions[currentStatus] || [];
}
