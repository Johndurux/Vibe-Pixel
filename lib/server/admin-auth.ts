import 'server-only';

import { timingSafeEqual } from 'node:crypto';

export function isAdminRequest(request: Request): boolean {
  const expected = process.env.ADMIN_SECRET;
  const provided = request.headers.get('x-admin-secret');

  if (!expected || !provided) return false;

  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);

  return (
    expectedBuffer.length === providedBuffer.length &&
    timingSafeEqual(expectedBuffer, providedBuffer)
  );
}
