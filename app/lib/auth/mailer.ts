import nodemailer, { type Transporter } from "nodemailer";
import { ApiError } from "../api/errors";
import { OTP_CODE_TTL_SECONDS } from "./loginOtp";

export type OtpMailer = (to: string, code: string) => Promise<void>;

type Environment = Record<string, string | undefined>;

export type SmtpConfig = {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
};

/** SMTP_* + MAIL_FROM from .env; null when any is missing. Test: Gmail + App Password. Production: the company SMTP. */
export const readSmtpConfig = (environment: Environment = process.env): SmtpConfig | null => {
  const host = environment.SMTP_HOST?.trim();
  const port = Number(environment.SMTP_PORT?.trim() || "587");
  const user = environment.SMTP_USER?.trim();
  // Gmail shows App Passwords in groups of four; the spaces are not part of it.
  const pass = environment.SMTP_PASS?.replace(/\s+/g, "");
  const from = environment.MAIL_FROM?.trim() || user;
  if (!host || !user || !pass || !from || !Number.isInteger(port)) return null;
  return { host, port, user, pass, from };
};

let cachedTransport: { key: string; transport: Transporter } | null = null;

const transportFor = (config: SmtpConfig) => {
  const key = `${config.host}:${config.port}:${config.user}`;
  if (cachedTransport?.key !== key) {
    cachedTransport = {
      key,
      transport: nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.port === 465, // 587 upgrades with STARTTLS
        auth: { user: config.user, pass: config.pass },
      }),
    };
  }
  return cachedTransport.transport;
};

export const otpEmailContent = (code: string) => {
  const minutes = OTP_CODE_TTL_SECONDS / 60;
  return {
    subject: `รหัสยืนยันเข้าสู่ระบบ ${code} / Your sign-in code`,
    text: [
      `รหัสยืนยันเข้าสู่ระบบ Training Plan Management ของคุณคือ ${code}`,
      `รหัสมีอายุ ${minutes} นาที และใช้ได้ครั้งเดียว`,
      "ถ้าคุณไม่ได้เป็นผู้เข้าสู่ระบบ ไม่ต้องทำอะไร และไม่ต้องบอกรหัสนี้กับใคร",
      "",
      `Your Training Plan Management sign-in code is ${code}.`,
      `It is valid for ${minutes} minutes and can be used once.`,
      "If you did not try to sign in, ignore this email and do not share the code.",
    ].join("\n"),
  };
};

/**
 * Sends the login code. Without SMTP settings a non-production server prints the code to its own
 * console so the flow can still be tried; production refuses instead of pretending it sent.
 */
export const sendOtpEmail: OtpMailer = async (to, code) => {
  const config = readSmtpConfig();
  if (!config) {
    if (process.env.NODE_ENV !== "production") {
      console.info(`[Login OTP] code for ${to}: ${code} (SMTP not configured - dev console only)`);
      return;
    }
    throw new ApiError({ code: "MAIL_NOT_CONFIGURED", message: "Email sending is not configured", status: 503 });
  }

  try {
    await transportFor(config).sendMail({ from: config.from, to, ...otpEmailContent(code) });
  } catch (error) {
    // The SMTP error can echo the account name; log only its code/command.
    const failure = error as { code?: string; command?: string; responseCode?: number };
    console.error("[Login OTP] send failed", failure.code, failure.command, failure.responseCode);
    throw new ApiError({ code: "MAIL_SEND_FAILED", message: "The email could not be sent", status: 502 });
  }
};
