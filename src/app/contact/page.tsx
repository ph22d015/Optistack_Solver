
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import type { ContactFormValues } from '@/types/contact';
import { ContactFormSchema } from '@/types/contact';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Separator } from '@/components/ui/separator';
import { Linkedin, Mail, User, BookUser, FlaskConical, MessageSquare, Send, ExternalLink } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import Link from 'next/link';

export default function ContactPage() {
  const { toast } = useToast();
  const form = useForm<ContactFormValues>({
    resolver: zodResolver(ContactFormSchema),
    defaultValues: {
      name: '',
      email: '',
      subject: '',
      message: '',
    },
    mode: 'onBlur',
  });

  function onSubmit(data: ContactFormValues) {
    console.log('Feedback form submitted:', data);
    toast({
      title: 'Message Sent (Simulation)',
      description: 'Thank you for your feedback! (This is a simulated submission)',
    });
    form.reset();
  }

  return (
    <div className="container mx-auto px-4 space-y-12"> {/* Removed py-8 */}
      <header className="text-center">
        <MessageSquare className="mx-auto h-16 w-16 text-primary mb-4" />
        <h1 className="text-4xl font-bold tracking-tight text-primary sm:text-5xl">
          Get In Touch
        </h1>
        <p className="mt-4 text-xl text-foreground/80 leading-relaxed">
          Contact the creator or send a message using the form below.
        </p>
      </header>

      <Separator />

      <div className="grid md:grid-cols-2 gap-12">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <User className="h-7 w-7 text-primary/80" />
              About the Creator
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-foreground/90 leading-relaxed">
            <div>
              <h3 className="text-lg font-semibold">Sourav Mondal</h3>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Email</Label>
              <a href="mailto:ph22d015@smail.iitm.ac.in" className="flex items-center gap-2 text-primary hover:underline">
                <Mail className="h-4 w-4" /> ph22d015@smail.iitm.ac.in
              </a>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Occupation</Label>
              <p className="flex items-center gap-2">
                <BookUser className="h-4 w-4" /> Research Scholar, Department of Physics, IIT Madras.
              </p>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Research Interest</Label>
              <p className="flex items-center gap-2">
                <FlaskConical className="h-4 w-4" /> Phase Change Material Based Photonic Devices for reconfigurable application (simulation and fabrication).
              </p>
            </div>
            <Separator className="my-6" />
            <div>
              <h4 className="text-md font-semibold mb-3">Connect:</h4>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link href="https://www.linkedin.com/in/your-linkedin-profile/" target="_blank" rel="noopener noreferrer" aria-label="Sourav Mondal on LinkedIn">
                    <Linkedin className="h-5 w-5 mr-2" /> LinkedIn
                  </Link>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link href="https://www.researchgate.net/profile/Your-ResearchGate-Profile" target="_blank" rel="noopener noreferrer" aria-label="Sourav Mondal on ResearchGate">
                    <ExternalLink className="h-5 w-5 mr-2" /> ResearchGate
                  </Link>
                </Button>
                 <Button variant="outline" size="sm" asChild>
                  <Link href="https://scholar.google.com/citations?user=YourScholarID" target="_blank" rel="noopener noreferrer" aria-label="Sourav Mondal on Google Scholar">
                     <ExternalLink className="h-5 w-5 mr-2" /> Google Scholar
                  </Link>
                </Button>
              </div>
               <p className="text-xs text-muted-foreground mt-2">
                (Note: Please replace placeholder URLs with actual profile links.)
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Send className="h-7 w-7 text-primary/80" />
              Send a Message
            </CardTitle>
            <CardDescription>
              Have a question, feedback, or suggestion? Fill out the form below.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Your Name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="your.email@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="subject"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Subject</FormLabel>
                      <FormControl>
                        <Input placeholder="Regarding..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="message"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Message</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Your message here..." rows={5} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? 'Sending...' : 'Send Message'}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>

      <footer className="text-center text-muted-foreground text-sm py-8">
        <p>Thank you for visiting!</p>
      </footer>
    </div>
  );
}
