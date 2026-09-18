/*
  45_Add_Employee_Login_Otp.sql

  An EMPLOYEE signs in with <company prefix>-<6 digits> and their birth date (DDMMYYYY). Because a
  birth date is easy to know, the first login and every login after the last check has expired
  must also pass a 6-digit code sent to the employee's own email address. HRD and Admin accounts
  are not affected.

  WHERE THE EMAIL LIVES

  user_account.email already exists (filtered-unique, editable in Admin). The employee types a
  personal address (Gmail, Outlook, Yahoo, anything) the first time; it is written there only
  after the code sent to it is confirmed. No new email column.

  otp_verified_until

  Set to "code confirmed at + 2 days". While it is in the future the employee signs in with the
  birth date alone; once it passes, the next login asks for a new code. It belongs to the user,
  not the device. NULL means never confirmed.

  auth_login_otp

  One row per code sent. Only an HMAC of the code is stored, never the code itself. A row is used
  once (consumed_at), expires after a few minutes (expires_at) and is refused after too many wrong
  guesses (attempt_count). Rows are kept as a history of what was sent where and when.

  Safe to run more than once.
*/

IF COL_LENGTH('dbo.user_account', 'otp_verified_until') IS NULL
  ALTER TABLE dbo.user_account ADD otp_verified_until DATETIME2 NULL;
GO

IF OBJECT_ID(N'dbo.auth_login_otp', N'U') IS NULL
  CREATE TABLE dbo.auth_login_otp (
    otp_id        BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_auth_login_otp PRIMARY KEY,
    user_id       BIGINT        NOT NULL,
    email         NVARCHAR(255) NOT NULL,
    code_hash     NVARCHAR(128) NOT NULL,
    expires_at    DATETIME2     NOT NULL,
    attempt_count INT           NOT NULL CONSTRAINT DF_auth_login_otp_attempt_count DEFAULT (0),
    consumed_at   DATETIME2     NULL,
    created_at    DATETIME2     NOT NULL CONSTRAINT DF_auth_login_otp_created_at DEFAULT (SYSDATETIME()),
    CONSTRAINT FK_auth_login_otp_user_id FOREIGN KEY (user_id) REFERENCES dbo.user_account (user_id),
    CONSTRAINT CK_auth_login_otp_attempt_count CHECK (attempt_count >= 0)
  );
GO

-- Every read is "the latest code for this user".
IF NOT EXISTS (SELECT 1 FROM sys.indexes
               WHERE name = 'IX_auth_login_otp_user_id_created_at'
                 AND object_id = OBJECT_ID(N'dbo.auth_login_otp'))
  CREATE INDEX IX_auth_login_otp_user_id_created_at
    ON dbo.auth_login_otp (user_id, created_at DESC);
GO
