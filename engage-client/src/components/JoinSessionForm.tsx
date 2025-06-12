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
    <Card className="w-full max-w-md shadow-lg rounded-lg bg-white">
      <CardHeader className="px-6 pt-8 pb-2 text-center">
        <CardTitle className="text-xl font-semibold text-primary">Join Live Session</CardTitle>
        <CardDescription className="text-sm text-gray-500 pt-1">Enter the invite code and your name to participate.</CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)}>
          <CardContent className="px-6 pt-5 space-y-5 pb-5">
            <FormField
              control={form.control}
              name="inviteCode"
              render={({ field }: { field: ControllerRenderProps<JoinFormValues, 'inviteCode'> }) => (
                <FormItem>
                  <FormLabel className="text-slate-700 text-sm font-medium">Invite Code</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., A1B2C"
                      {...field}
                      className="text-base h-10 tracking-wider uppercase focus:ring-2 focus:ring-blue-500 transition-shadow duration-200 ease-in-out"
                      disabled={isJoining || !!initialInviteCode}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => field.onChange(e.target.value.toUpperCase())}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="username"
              render={({ field }: { field: ControllerRenderProps<JoinFormValues, 'username'> }) => (
                <FormItem>
                  <FormLabel className="text-slate-700 text-sm font-medium">your username</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter your username"
                      {...field}
                      className="text-base h-10 focus:ring-2 focus:ring-blue-500 transition-shadow duration-200 ease-in-out"
                      disabled={isJoining}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {error && <p className="text-sm font-medium text-red-600 text-center py-2">{error}</p>}
          </CardContent>
          <CardFooter className="px-6 pt-0 pb-6">
            <Button type="submit" className="w-full h-10 text-base bg-primary hover:bg-primary/90 text-primary-foreground transition-colors duration-200 ease-in-out" disabled={isJoining}>
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