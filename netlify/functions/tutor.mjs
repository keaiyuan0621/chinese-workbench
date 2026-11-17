import { handleTutorRequest } from '../../server/ai-tutors/handler.mjs'

export async function handler(event) {
  return handleTutorRequest(event, { allowDevPreview: false })
}
