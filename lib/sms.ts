// ═══════════════════════════════════════════════════════════════
// KrishiDam — GreenSMS Integration
// Provides Bengali SMS OTP support
// ═══════════════════════════════════════════════════════════════

interface SendSmsParams {
  to: string;
  message: string;
}

export async function sendSms({ to, message }: SendSmsParams): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const user = process.env.GREENSMS_USER;
  const pass = process.env.GREENSMS_PASS;
  const token = process.env.GREENSMS_TOKEN;

  // Ensure phone numbers have the correct country prefix format for Bangladesh if needed
  let formattedPhone = to;
  if (!formattedPhone.startsWith('+880') && !formattedPhone.startsWith('880')) {
    // Remove leading zero and append country code
    const cleanNumber = formattedPhone.replace(/^0+/, '');
    formattedPhone = `+880${cleanNumber}`;
  }

  console.log(`[GreenSMS] Queueing SMS to: ${formattedPhone} | Message: ${message}`);

  // In local development or missing configuration, run in simulation mode
  if (!token && (!user || !pass)) {
    console.log(`[GreenSMS] [SIMULATOR] SMS successfully sent to ${formattedPhone}`);
    return { success: true, messageId: `simulated-sms-${Date.now()}` };
  }

  try {
    const response = await fetch('https://api.greensms.co/v1/sms/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        to: formattedPhone,
        txt: message,
        ...(token ? {} : { user, pass })
      }),
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      return {
        success: false,
        error: data.error || `HTTP error ${response.status}: Failed to send SMS`
      };
    }

    return {
      success: true,
      messageId: data.request_id || data.message_id
    };
  } catch (err: any) {
    console.error('[GreenSMS] API Request Failed:', err);
    return {
      success: false,
      error: err.message || 'Network request failed'
    };
  }
}
