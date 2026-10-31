export function rejectIfResponseIsNotOk(response: Response) {
  if (response.ok) return response

  return Promise.reject(response.status)
}
