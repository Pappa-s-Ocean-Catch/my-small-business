export function isPosStatusEmailStatus(status: string | undefined) {
  return status === 'ready' || status === 'completed';
}

export function isPublicStatusEmailStatus(status: string | undefined) {
  return status === 'placed';
}
