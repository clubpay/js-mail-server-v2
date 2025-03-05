import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { convert } from 'html-to-text';
import { SESClient } from '@aws-sdk/client-ses';
import nodemailer from 'nodemailer';
import { IEmailService, ISendEmail } from '../../interface';

@Injectable()
export class SesService implements IEmailService {
  private readonly logger = new Logger(SesService.name);
  private readonly retries = 3;
  private readonly transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    const sesClient = new SESClient({
      region: this.configService.get<string>('AWS_REGION'),
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY'),
        secretAccessKey: this.configService.get<string>('AWS_SECRET_KEY'),
      },
    });
    this.transporter = nodemailer.createTransport({
      SES: sesClient,
    });
  }

  async sendEmail(params: ISendEmail): Promise<any> {
    const { to, html, subject, attachments, cc, text, _from } = params;
    const from = _from ?? this.configService.get<string>('EMAIL_FROM');

    this.logger.log(`Starting SES email process to: ${JSON.stringify(to)}`);
    this.logger.log(
      `Email configuration - Subject: ${subject}, CC: ${cc}, Attachments: ${attachments?.length || 0}`,
    );

    for (let attempt = 1; attempt <= this.retries; attempt++) {
      try {
        this.logger.log(`SES attempt ${attempt}/${this.retries}`);

        const response = await this.transporter.sendMail({
          from:
            typeof from === 'string'
              ? from
              : { name: from.name, address: from.email },
          to,
          subject,
          text: text ?? convert(html, { wordwrap: 120 }),
          html,
          attachments: attachments?.map((attachment) => ({
            filename: attachment.filename,
            content: attachment.content,
            contentType: attachment.type,
            encoding: 'base64',
            contentDisposition: (attachment.disposition === 'inline'
              ? 'inline'
              : 'attachment') as 'attachment' | 'inline',
          })),
          cc,
        });

        this.logger.log(`SES mail sent successfully on attempt ${attempt}`);
        this.logger.log(`SES Response: ${JSON.stringify(response)}`);
        return response;
      } catch (error: any) {
        this.logger.error(`SES attempt ${attempt} failed: ${error.message}`);
        this.logger.error(`Full error details: ${JSON.stringify(error)}`);

        if (attempt === this.retries) {
          this.logger.error('Max retries reached for SES, giving up');
          throw error;
        }
      }
    }
  }
}
