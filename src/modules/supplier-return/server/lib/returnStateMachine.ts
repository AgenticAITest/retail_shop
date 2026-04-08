export type ReturnStatus =
  | 'requested'
  | 'pending_approval'
  | 'approved'
  | 'dispatched'
  | 'acknowledged'
  | 'credit_note_received'
  | 'closed'
  | 'rejected';

const validTransitions: Record<ReturnStatus, ReturnStatus[]> = {
  requested: ['pending_approval', 'approved', 'rejected'],
  pending_approval: ['approved', 'rejected'],
  approved: ['dispatched'],
  dispatched: ['acknowledged'],
  acknowledged: ['credit_note_received', 'closed'],
  credit_note_received: ['closed'],
  closed: [],
  rejected: [],
};

export const RETURN_STATUS_LABELS: Record<ReturnStatus, string> = {
  requested: 'Requested',
  pending_approval: 'Pending Approval',
  approved: 'Approved',
  dispatched: 'Dispatched',
  acknowledged: 'Acknowledged',
  credit_note_received: 'Credit Note Received',
  closed: 'Closed',
  rejected: 'Rejected',
};

export const RETURN_LIFECYCLE_STAGES: ReturnStatus[] = [
  'requested',
  'pending_approval',
  'approved',
  'dispatched',
  'acknowledged',
  'credit_note_received',
  'closed',
];

export function canTransition(currentStatus: ReturnStatus, targetStatus: ReturnStatus): boolean {
  return validTransitions[currentStatus]?.includes(targetStatus) ?? false;
}

export function validateTransition(
  currentStatus: ReturnStatus,
  targetStatus: ReturnStatus
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

export function getAvailableTransitions(currentStatus: ReturnStatus): ReturnStatus[] {
  return validTransitions[currentStatus] || [];
}
