export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

// Tests pass a fake; the Worker uses Brevo (ADR 0005).
export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}
