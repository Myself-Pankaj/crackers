import type { IncomingMessage, ServerResponse } from 'node:http'
export function createBillPdfHandler(options?: { env?: NodeJS.ProcessEnv; fetcher?: typeof fetch }): (req: IncomingMessage, res: ServerResponse) => Promise<void>
export const CLOUDINARY_FOLDER: string
export function cloudinarySignature(params: Record<string, string | number>, secret: string): string
export function cloudinaryUploadParams(uid: string, billId: string, secret: string, timestamp: number, fixedFolders?: boolean): Record<string, string | number>
