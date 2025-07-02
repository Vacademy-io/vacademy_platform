// src/components/JoinSessionForm.tsx
import React, { useState } from 'react';
import { zodResolver } from "@hookform/resolvers/zod";
import type { ControllerRenderProps } from 'react-hook-form';
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Loader2, LogIn } from 'lucide-react';

const formSchema = z.object({
  inviteCode: z.string().min(4, "Invite code must be at least 4 characters").max(10, "Invite code too long"),
  username: z.string().min(2, "Username must be at least 2 characters").max(30, "Username too long"),
});

type JoinFormValues = z.infer<typeof formSchema>;

interface JoinSessionFormProps {
  onJoin: (inviteCode: string, username: string) => Promise<void>;
  isJoining: boolean;
  initialError?: string | null;
  initialInviteCode?: string;
}

export const JoinSessionForm: React.FC<JoinSessionFormProps> = ({ onJoin, isJoining, initialError, initialInviteCode }) => {
  const [error, setError] = useState<string | null>(initialError || null);

  const form = useForm<JoinFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      inviteCode: initialInviteCode || "",
      username: "",
    },
  });

  const handleSubmit = async (values: JoinFormValues) => {
    setError(null);
    try {
      await onJoin(values.inviteCode.toUpperCase(), values.username);
    } catch (e: any) {
      setError(e.message || "Failed to join. Please check the code and try again.");
    }
  };

  return (
    <Card className="w-full max-w-md bg-black/40 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl relative overflow-hidden">
      {/* Darker background for better text contrast */}
      <div className="absolute inset-0 bg-gradient-to-r from-orange-900/30 to-orange-800/20 rounded-2xl pointer-events-none" />
      
      <CardHeader className="px-6 pt-8 pb-2 text-center relative z-10">
        <CardTitle className="text-xl font-semibold text-white">Join Live Session</CardTitle>
        <CardDescription className="text-sm text-white/90 pt-1">Enter the invite code and your name to participate.</CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)}>
          <CardContent className="px-6 pt-5 space-y-5 pb-5 relative z-10">
            <FormField
              control={form.control}
              name="inviteCode"
              render={({ field }: { field: ControllerRenderProps<JoinFormValues, 'inviteCode'> }) => (
                <FormItem>
                  <FormLabel className="text-white font-medium">Invite Code</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., A1B2C"
                      {...field}
                      className="bg-white/10 border border-white/20 text-white placeholder:text-white/50 h-10 tracking-wider uppercase focus:border-orange-400/50 focus:ring-orange-400/25 backdrop-blur-sm transition-all duration-300 ease-out hover:bg-white/15"
                      disabled={isJoining || !!initialInviteCode}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => field.onChange(e.target.value.toUpperCase())}
                    />
                  </FormControl>
                  <FormMessage className="text-red-300" />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="username"
              render={({ field }: { field: ControllerRenderProps<JoinFormValues, 'username'> }) => (
                <FormItem>
                  <FormLabel className="text-white font-medium">Your Username</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter your username"
                      {...field}
                      className="bg-white/10 border border-white/20 text-white placeholder:text-white/50 h-10 focus:border-orange-400/50 focus:ring-orange-400/25 backdrop-blur-sm transition-all duration-300 ease-out hover:bg-white/15"
                      disabled={isJoining}
                    />
                  </FormControl>
                  <FormMessage className="text-red-300" />
                  <p className="text-xs text-white/60 pt-1">
                    Keep your username as your email to get the session action points, recording and presentation details.
                  </p>
                </FormItem>
              )}
            />
            {error && (
              <div className="bg-red-500/20 border border-red-400/30 rounded-lg px-3 py-2 backdrop-blur-sm">
                <p className="text-sm font-medium text-red-300 text-center">{error}</p>
              </div>
            )}
          </CardContent>
          <CardFooter className="px-6 pt-0 pb-6 relative z-10">
            <Button 
              type="submit" 
              className="w-full h-10 rounded-xl bg-gradient-to-r from-green-600 to-emerald-700 hover:from-green-700 hover:to-emerald-800 text-white font-semibold backdrop-blur-sm transition-all duration-300 ease-out hover:scale-105 shadow-lg shadow-green-500/25 border-0" 
              disabled={isJoining}
            >
              {isJoining ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <LogIn className="mr-2 size-4" />
              )}
              Join Session
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
};