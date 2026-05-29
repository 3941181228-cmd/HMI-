export default async function handler(event: any) {
  return {
    statusCode: 200,
    body: JSON.stringify({ success: false, querying: false, gen_status: 'not_applicable' })
  }
}
