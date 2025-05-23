
'use server';

export async function verifyRecaptchaToken(token: string): Promise<{ success: boolean; message: string }> {
  const secretKey = process.env.RECAPTCHA_SECRET_KEY;

  if (!secretKey) {
    console.error("ReCAPTCHA secret key is not set.");
    // In a production environment, you might want to fail closed here.
    // For development, or if you want to allow submissions if reCAPTCHA is misconfigured,
    // you might return success, but log a severe warning.
    // For now, let's assume misconfiguration means failure for security.
    return { success: false, message: "ReCAPTCHA configuration error on server." };
  }

  const verificationUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${token}`;

  try {
    const response = await fetch(verificationUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("ReCAPTCHA verification request failed:", response.status, errorText);
      return { success: false, message: `ReCAPTCHA server communication error. Status: ${response.status}` };
    }

    const result = await response.json();

    if (result.success) {
      return { success: true, message: "ReCAPTCHA verified successfully." };
    } else {
      console.warn("ReCAPTCHA verification failed:", result['error-codes']);
      return { success: false, message: `ReCAPTCHA verification failed. Errors: ${result['error-codes']?.join(', ') || 'Unknown error'}` };
    }
  } catch (error) {
    console.error("Error during reCAPTCHA verification:", error);
    return { success: false, message: "An unexpected error occurred during reCAPTCHA verification." };
  }
}
