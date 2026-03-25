import { z } from 'zod';
import { FORGOT_PASSWORD } from '@/constants/urls';

const forgotPasswordResponseSchema = z.object({
    status: z.enum(['success', 'error']),
    message: z.string().optional(),
});

async function forgotPassword(email: string) {
    const encodedEmail = encodeURIComponent(email);
    const url = `${FORGOT_PASSWORD}?email=${encodedEmail}`;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            Accept: '*/*',
        },
        body: '',
    });

    const contentType = response.headers.get('Content-Type') || '';

    let data: any;

    if (contentType.includes('application/json')) {
        data = await response.json();

        // ✅ Patch missing status if needed
        if (!data.status) {
            data.status = response.ok ? 'success' : 'error';
        }
    } else {
        const text = await response.text();
        console.warn('[API] Non-JSON response received:', text);
        data = {
            status: response.ok ? 'success' : 'error',
            message: text,
        };
    }

    console.log('[API] Final parsed response:', data);

    return forgotPasswordResponseSchema.parse(data);
}

export { forgotPassword };
