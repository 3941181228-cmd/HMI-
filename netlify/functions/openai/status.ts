export default async function handler(event: any) {
  return {
    statusCode: 200,
    body: JSON.stringify({ ok: false, credit: '' })
  }
}
