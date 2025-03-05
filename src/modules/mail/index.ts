import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import {
  MailService,
  SendGridService,
  SmtpService,
  SesService,
} from './service';
import { EmailServiceFactory } from './factory';

@Module({
  imports: [ConfigModule],
  providers: [
    MailService,
    SmtpService,
    SendGridService,
    SesService,
    EmailServiceFactory,
  ],
  exports: [MailService],
})
export class MailModule {}
