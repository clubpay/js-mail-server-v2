import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { convert } from 'html-to-text';
import nodemailer from 'nodemailer';
import { IEmailService, ISendEmail } from '../../interface';

@Injectable()
export class SmtpService implements IEmailService {
  private readonly logger = new Logger(SmtpService.name);
  private readonly retries = 3;
  private readonly transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('SMTP_SERVICE_HOST'),
      port: this.configService.get<number>('SMTP_SERVICE_PORT') || 587,
      secure: this.configService.get<boolean>('SMTP_SERVICE_SSL') === true,
      auth: {
        user: this.configService.get<string>('SMTP_SERVICE_USERNAME'),
        pass: this.configService.get<string>('SMTP_SERVICE_PASSWORD'),
      },
      connectionTimeout: 30000,
      greetingTimeout: 30000,
      socketTimeout: 30000,
      pool: true,
      maxConnections: 5,
    });

    this.verifyConnection();
    this.setupErrorHandling();
  }

  private async verifyConnection() {
    try {
      await this.transporter.verify();
      this.logger.log('SMTP server connection verified');
    } catch (error) {
      this.logger.error(`SMTP connection verification failed: ${error}`);
    }
  }

  private setupErrorHandling() {
    this.transporter.on('error', async (err) => {
      this.logger.error(`SMTP Transport error occurred: ${err.message}`);
      try {
        await this.transporter.verify();
      } catch (verifyError) {
        this.logger.error(`Failed to recreate SMTP connection: ${verifyError}`);
      }
    });
  }

  async sendEmail(params: ISendEmail): Promise<any> {
    const { to, html, subject, cc, text, attachments, _from } = params;
    const from = _from ?? this.configService.get<string>('EMAIL_FROM');

    this.logger.log(`Starting SMTP email process to: ${JSON.stringify(to)}`);
    this.logger.log(
      `Email configuration - Subject: ${subject}, CC: ${cc}, Attachments: ${attachments?.length || 0}`,
    );

    const mailOptions: nodemailer.SendMailOptions = {
      from: typeof from === 'string' ? from : { name: from.name, address: from.email },
      to,
      subject,
      text: text ?? convert(html, { wordwrap: 120 }),
      html,
      cc,
      attachments: attachments?.map((att) => ({
        content: att.content,
        cid: att.content_id,
        filename: att.filename,
        contentType: att.type,
        contentDisposition: att.disposition as any,
        encoding: 'base64',
      })),
      headers: {
        'keep-alive': 'true',
        Connection: 'keep-alive',
      },
    };

    for (let attempt = 1; attempt <= this.retries; attempt++) {
      try {
        this.logger.log(`SMTP attempt ${attempt}/${this.retries} - Verifying connection`);
        await this.transporter.verify();

        this.logger.log('Sending mail via SMTP...');
        const response = await this.transporter.sendMail(mailOptions);

        this.logger.log(`SMTP mail sent successfully on attempt ${attempt}`);
        this.logger.log(`SMTP Response: ${JSON.stringify(response)}`);
        return response;
      } catch (error: any) {
        this.logger.error(`SMTP attempt ${attempt} failed: ${error.message}`);
        this.logger.error(`Full error details: ${JSON.stringify(error)}`);

        const retryableErrors = [
          'ECONNRESET',
          'ETIMEDOUT',
          'EHOSTUNREACH',
          'ECONNREFUSED',
          'EPIPE',
          'Protocol error: Connection closed',
          'Connection timed out',
          'socket hang up',
          'write EPIPE',
          'read ECONNRESET',
        ];

        const shouldRetry = retryableErrors.some(
          (errType) =>
            error.code === errType ||
            (error.message && error.message.toLowerCase().includes(errType.toLowerCase())),
        );

        if (shouldRetry && attempt < this.retries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          this.logger.log(`Retrying SMTP in ${delay}ms... (attempt ${attempt + 1})`);

          try {
            this.logger.log('Closing current SMTP connection before retry');
            await new Promise((resolve) => {
              this.transporter.close();
              setTimeout(resolve, delay);
            });
          } catch (closeError) {
            this.logger.error(`Error closing SMTP connection: ${closeError}`);
          }
          continue;
        }

        this.logger.error('Non-retryable error or max retries reached, giving up');
        throw error;
      }
    }
  }
} 