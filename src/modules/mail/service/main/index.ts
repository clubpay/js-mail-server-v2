import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailServiceFactory } from '../../factory';
import { ISendEmail } from '../../interface';
import { IsValidEmail } from '../utils';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly emailService: any;

  constructor(
    private configService: ConfigService,
    private emailServiceFactory: EmailServiceFactory,
  ) {
    this.emailService = this.emailServiceFactory.createEmailService();
  }

  async sendEmail(params: ISendEmail): Promise<any> {
    const { to, cc, _from } = params;
    const from = _from ?? this.configService.get<string>('EMAIL_FROM');

    this.logger.log(
      `Starting email send process with medium: ${this.configService.get<string>('EMAIL_MEDIUM')}`,
    );
    this.logger.log(
      `Email parameters - To: ${JSON.stringify(to)}, CC: ${cc}, From: ${JSON.stringify(from)}`,
    );

    const filteredToList = Array.isArray(to)
      ? !to.some((email) => !IsValidEmail(email))
      : IsValidEmail(to);

    const isAllGoodFrom = IsValidEmail(
      typeof from === 'string' ? from : from.email,
    );

    if (!filteredToList || !isAllGoodFrom) {
      this.logger.error(
        `Email validation failed - Valid To: ${filteredToList}, Valid From: ${isAllGoodFrom}`,
      );
      throw new Error('Email is not valid');
    }

    this.logger.log('Email validation passed, proceeding with email service');

    try {
      return await this.emailService.sendEmail(params);
    } catch (err) {
      this.logger.error(
        `Failed to send email to: ${JSON.stringify(to)}, cc: ${cc}, error message: ${err}`,
      );
      throw err;
    }
  }
}
