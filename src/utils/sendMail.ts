import { createTransport } from "nodemailer";

interface SendMailOptions {
  email: string;
  subject: string;
  html: string;
}

const sendMail = async ({ email, subject, html }: SendMailOptions) => {
  const transport = createTransport({
    host: "smtp.gmail.com",
    port: 465,
    auth: {
      user: process.env.MAIL_ID,
      pass: process.env.MAIL_PASSWORD,
    },
  });

  await transport.sendMail({
    from: process.env.MAIL_ID,
    to: email,
    subject,
    html,
  });
};

export default sendMail;
