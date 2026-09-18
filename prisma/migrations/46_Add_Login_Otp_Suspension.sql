/*
  46_Add_Login_Otp_Suspension.sql

  Master Data > System lets HRD switch the employee email code (migration 45) off for a company,
  for example while the mail server is down. HRD Factory can switch off only its own company;
  HRD Center any company. HRD and Admin logins never use the code, so they are not affected.

  AUTOMATIC SWITCH-BACK

  A suspension always ends by itself 24 hours after it was switched off, so a forgotten switch
  cannot leave the code off. The row stores that moment (suspended_until); the login check reads
  "suspended_until > now", so nothing has to run at the 24-hour mark. Switching back on early
  deletes the row. Who switched what and when is kept in audit_log, not here.

  ONE ROW PER COMPANY

  company_id is the key: at most one active suspension per company. Switching off again while
  already off restarts the 24 hours.

  Safe to run more than once.
*/

IF OBJECT_ID(N'dbo.login_otp_suspension', N'U') IS NULL
  CREATE TABLE dbo.login_otp_suspension (
    company_id      BIGINT    NOT NULL CONSTRAINT PK_login_otp_suspension PRIMARY KEY,
    suspended_until DATETIME2 NOT NULL,
    suspended_by    BIGINT    NOT NULL,
    suspended_at    DATETIME2 NOT NULL CONSTRAINT DF_login_otp_suspension_suspended_at DEFAULT (SYSDATETIME()),
    CONSTRAINT FK_login_otp_suspension_company_id FOREIGN KEY (company_id) REFERENCES dbo.company (company_id),
    CONSTRAINT FK_login_otp_suspension_suspended_by FOREIGN KEY (suspended_by) REFERENCES dbo.user_account (user_id),
    CONSTRAINT CK_login_otp_suspension_window CHECK (suspended_until > suspended_at)
  );
GO
