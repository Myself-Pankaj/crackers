import { createNetlifyBillPdfHandler } from '../../server/netlify-handler.mjs'

// Cloudinary secrets come from Netlify environment variables with Functions scope.
export default createNetlifyBillPdfHandler()
