import nodemailer from 'nodemailer';
import 'dotenv/config';

interface ReportEmailOptions {
  recipients: string[];
  scheduleName: string;
  reportType: string;
  attachment: { filename: string; content: Buffer };
}

export async function sendReportEmail({ recipients, scheduleName, reportType, attachment }: ReportEmailOptions): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || '127.0.0.1',
    port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 25,
    secure: false,
    auth: {
      user: process.env.SMTP_USER || 'user',
      pass: process.env.SMTP_PASS || 'pass',
    },
  });

  const reportLabel = reportType.charAt(0).toUpperCase() + reportType.slice(1);

  await transporter.sendMail({
    from: process.env.SMTP_FROM || '"Retail System" <noreply@localhost>',
    to: recipients.join(', '),
    subject: `Scheduled Report: ${scheduleName}`,
    html: `
      <p>Your scheduled <strong>${reportLabel} Report</strong> is attached.</p>
      <p>Report name: <strong>${scheduleName}</strong><br/>
      Generated: ${new Date().toLocaleString('id-ID')}</p>
      <p style="color:#666;font-size:12px;">This is an automated report from your Retail Management System.</p>
    `,
    attachments: [{ filename: attachment.filename, content: attachment.content }],
  });
}
