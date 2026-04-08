export type PoStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'sent'
  | 'partially_received'
  | 'fully_received'
  | 'closed'
  | 'cancelled';

const validTransitions: Record<PoStatus, PoStatus[]> = {
  draft: ['pending_approval', 'approved', 'cancelled'],
  pending_approval: ['approved', 'draft'], // rejected goes back to draft
  approved: ['sent', 'cancelled'],
  sent: ['partially_received', 'fully_received'],
  partially_received: ['fully_received'],
  fully_received: ['closed'],
  closed: [],
  cancelled: [],
};

export const PO_STATUS_LABELS: Record<PoStatus, string> = {
  draft: 'Draft',
  pending_approval: 'Pending Approval',
  approved: 'Approved',
  sent: 'Sent to Supplier',
  partially_received: 'Partially Received',
  fully_received: 'Fully Received',
  closed: 'Closed',
  cancelled: 'Cancelled',
};

// Ordered lifecycle stages for the status timeline (excludes cancelled)
export const PO_LIFECYCLE_STAGES: PoStatus[] = [
  'draft',
  'pending_approval',
  'approved',
  'sent',
  'partially_received',
  'fully_received',
  'closed',
];

export function canTransition(currentStatus: PoStatus, targetStatus: PoStatus): boolean {
  return validTransitions[currentStatus]?.includes(targetStatus) ?? false;
}

export function validateTransition(
  currentStatus: PoStatus,
  targetStatus: PoStatus
): { valid: boolean; error?: string } {
  if (!validTransitions[currentStatus]) {
    return { valid: false, error: `Unknown current status: ${currentStatus}` };
  }

  if (!canTransition(currentStatus, targetStatus)) {
    const allowed = validTransitions[currentStatus];
    return {
      valid: false,
      error: `Cannot transition from '${currentStatus}' to '${targetStatus}'. Allowed transitions: ${allowed.length > 0 ? allowed.join(', ') : 'none'}`,
    };
  }

  return { valid: true };
}

export function getAvailableTransitions(currentStatus: PoStatus): PoStatus[] {
  return validTransitions[currentStatus] || [];
}

export function isEditable(status: PoStatus): boolean {
  return status === 'draft' || status === 'approved';
}

export function isCancellable(status: PoStatus): boolean {
  return status === 'draft' || status === 'approved';
}
