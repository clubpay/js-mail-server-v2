import type { AttachmentJSON } from '@sendgrid/helpers/classes/attachment';

export interface ISendEmail {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  attachments?: AttachmentJSON[];
  cc?: string[];
  _from?: string | { email: string; name: string };
}

export interface IEmailService {
  sendEmail(params: ISendEmail): Promise<any>;
}
