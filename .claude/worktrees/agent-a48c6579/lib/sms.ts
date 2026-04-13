export async function sendSms(to: string, message: string) {
  // Placeholder for MTN/Airtel integration; respects env toggles
  const provider = process.env.SMS_PROVIDER || "none"
  if (provider === "none") {
    console.log(`[sms] skipped provider=none to=${to} message=${message}`)
    return { success: true, skipped: true }
  }
  // Implement real provider calls here (e.g., fetch to gateway)
  return { success: true }
}


