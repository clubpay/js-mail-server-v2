import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailServiceFactory {
  constructor(
    private readonly configService: ConfigService,
    private readonly smtpService: SmtpService,
    private readonly sendGridService: SendGridService,
    private readonly sesService: SesService,
  ) {}

  createEmailService(): IEmailService {
    const emailMedium =
      this.configService.get<string>('EMAIL_MEDIUM') || 'SMTP';

    switch (emailMedium) {
      case 'SEND_GRID':
        return this.sendGridService;
      case 'SES':
        return this.sesService;
      default:
      case 'SMTP':
        return this.smtpService;
    }
  }
}
