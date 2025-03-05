import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sgMail from '@sendgrid/mail';
import { convert } from 'html-to-text';
import type { AttachmentData } from '@sendgrid/helpers/classes/attachment';
import { IEmailService, ISendEmail } from '../../interface';

@Injectable()
export class SendGridService implements IEmailService {
  private readonly logger = new Logger(SendGridService.name);
  private readonly retries = 3;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('EMAIL_KEY');
    if (apiKey) {
      sgMail.setApiKey(apiKey);
    }
  }

  async sendEmail(params: ISendEmail): Promise<any> {
    const { to, html, subject, attachments, cc, text, _from } = params;
    const from = _from ?? this.configService.get<string>('EMAIL_FROM');

    this.logger.log(
      `Starting SendGrid email attempt to: ${JSON.stringify(to)}`,
    );

    for (let attempt = 1; attempt <= this.retries; attempt++) {
      try {
        this.logger.log(`SendGrid attempt ${attempt}/${this.retries}`);

        const response = await sgMail.send({
          to,
          from,
          subject,
          text: text ?? convert(html, { wordwrap: 120 }),
          html,
          attachments: attachments as AttachmentData[],
          cc,
        });

        this.logger.log(
          `SendGrid email sent successfully on attempt ${attempt}`,
        );
        this.logger.log(`Response: ${JSON.stringify(response)}`);
        return response;
      } catch (error: any) {
        this.logger.error(
          `SendGrid attempt ${attempt} failed: ${error.message}`,
        );
        this.logger.error(`Error details: ${JSON.stringify(error)}`);

        if (attempt === this.retries) {
          this.logger.error('Max retries reached for SendGrid, giving up');
          throw error;
        }
      }
    }
  }
}
