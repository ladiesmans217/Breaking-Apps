export type EmailMessage = {
  id: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  createdAt: string;
};

type EmailState = {
  messages: EmailMessage[];
};

declare global {
  var __RECEIPTRIPPER_EMAIL_STATE__: EmailState | undefined;
}

function state(): EmailState {
  globalThis.__RECEIPTRIPPER_EMAIL_STATE__ ??= { messages: [] };
  return globalThis.__RECEIPTRIPPER_EMAIL_STATE__;
}

export function clearEmails(): void {
  state().messages = [];
}

export function sendEmail(message: Omit<EmailMessage, "id" | "createdAt">): EmailMessage {
  const email: EmailMessage = {
    ...message,
    id: `email_${Date.now()}_${state().messages.length + 1}`,
    createdAt: new Date().toISOString(),
  };
  state().messages.push(email);
  return email;
}

export function listEmails(to?: string): EmailMessage[] {
  const messages = state().messages;
  return to ? messages.filter((message) => message.to.toLowerCase() === to.toLowerCase()) : messages;
}

export function latestEmail(to: string): EmailMessage | undefined {
  return listEmails(to).at(-1);
}
