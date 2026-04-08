export type TransferStatus = 'requested' | 'pending_approval' | 'approved' | 'picking' | 'dispatched' | 'received' | 'closed';

const validTransitions: Record<TransferStatus, TransferStatus[]> = {
  requested: ['pending_approval', 'approved'],
  pending_approval: ['approved', 'requested'],
  approved: ['picking'],
  picking: ['dispatched'],
  dispatched: ['received'],
  received: ['closed'],
  closed: [],
};

export const TRANSFER_STATUS_LABELS: Record<TransferStatus, string> = {
  requested: 'Requested',
  pending_approval: 'Pending Approval',
  approved: 'Approved',
  picking: 'Picking',
  dispatched: 'Dispatched',
  received: 'Received',
  closed: 'Closed',
};

export const TRANSFER_LIFECYCLE: TransferStatus[] = [
  'requested', 'pending_approval', 'approved', 'picking', 'dispatched', 'received', 'closed',
];

export function canTransition(current: TransferStatus, target: TransferStatus): boolean {
  return validTransitions[current]?.includes(target) ?? false;
}

export function validateTransition(current: TransferStatus, target: TransferStatus): { valid: boolean; error?: string } {
  if (!validTransitions[current]) return { valid: false, error: `Unknown status: ${current}` };
  if (!canTransition(current, target)) {
    const allowed = validTransitions[current];
    return { valid: false, error: `Cannot transition from '${current}' to '${target}'. Allowed: ${allowed.length > 0 ? allowed.join(', ') : 'none'}` };
  }
  return { valid: true };
}

export function getAvailableTransitions(current: TransferStatus): TransferStatus[] {
  return validTransitions[current] || [];
}
