import { createLazyFileRoute, useNavigate, useParams } from '@tanstack/react-router';
import { TokenKey } from '@/constants/auth/tokens';
import { loginUser } from '@/hooks/login/login-button';
import { setAuthorizationCookie } from '@/lib/auth/sessionUtility';
import { handleLoginFlow, navigateFromLoginFlow } from '@/lib/auth/loginFlowHandler';
import { loginSchema } from '@/schemas/login/login';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import CryptoJS from 'crypto-js';
import ClipLoader from 'react-spinners/ClipLoader';

export const Route = createLazyFileRoute('/login/$key/')({
  component: RouteComponent,
});

type FormValues = z.infer<typeof loginSchema>;

function RouteComponent() {
  const queryClient = useQueryClient();
  const { key } = useParams({ from: '/login/$key/' });
  const secretKey = 'asjhdjyehbadkjakykajnasdajgasdas';
  const bytes = CryptoJS.AES.decrypt(key, secretKey);
  const text = bytes.toString(CryptoJS.enc.Utf8);
  const credentials = JSON.parse(text);

  const navigate = useNavigate();

  const mutation = useMutation({
    mutationFn: (values: FormValues) => loginUser(values.username, values.password),
    onSuccess: async (response) => {
      if (response) {
        // Use centralized login flow
        const result = await handleLoginFlow({
          loginMethod: 'demo_account',
          accessToken: response.accessToken,
          refreshToken: response.refreshToken,
          queryClient
        });

        if (result.shouldShowInstituteSelection) {
          // For demo accounts, we'll redirect to institute selection page
          window.location.href = '/login?showInstituteSelection=true';
        } else {
          navigateFromLoginFlow(result);
        }
      } else {
        toast.error('Login Error', {
          description: 'Invalid credentials',
          className: 'error-toast',
          duration: 3000,
        });
      }
    },
    onError: (error: unknown) => {
      console.error(error);
    },
  });

  useEffect(() => {
    setTimeout(() => {
      mutation.mutate({
        username: credentials.username,
        password: credentials.password,
      });
    }, 10);
  }, []);

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center">
      <h1 className="mb-4">Loading your demo account</h1>
      <ClipLoader size={40} color="#ED7424" />
    </div>
  );
}
