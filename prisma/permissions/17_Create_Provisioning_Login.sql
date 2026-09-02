USE [master];
GO

/*
Provisioning login for scripts/seed-development-account.mjs.

WHY THIS EXISTS
That script creates the first account on a new server — the HRD_CENTER account originally, and
now the first ADMIN account, which cannot be created through the admin screen because signing in
to that screen already requires an administrator. Chicken and egg: one account has to be made
outside the application.

The script deliberately refuses to do that as sa, as any sysadmin, or as the login the
application itself runs under. It verifies IS_SRVROLEMEMBER('sysadmin') = 0 before inserting.
So it needs a third, narrow login that can do one thing: add a row to dbo.user_account.

RUN THIS ONCE PER SERVER, connected as a sysadmin (Windows Authentication on the server machine
is the usual way). It is NOT part of the application's runtime and NOT used by the app.

BEFORE RUNNING
  1. Replace every <<PROVISIONING_LOGIN>> below with a name you choose. It must not be 'sa',
     'sysadmin', or the login the application connects with — the seed script rejects all three.
  2. Replace <<CHOOSE_A_STRONG_PASSWORD>> with a password you choose. Do not commit it, and do
     not paste it back into any file in this repository.
  3. Keep CHECK_POLICY = ON. This login can write to the account table; it is not the place to
     relax password rules. If the server policy rejects your password, pick a stronger one rather
     than turning the check off.

DO NOT add this login to any server role. Its whole value is that it cannot do anything else —
granting it sysadmin would both defeat the separation and make the seed script refuse to use it.
*/

IF SUSER_ID(N'<<PROVISIONING_LOGIN>>') IS NULL
BEGIN
    CREATE LOGIN [<<PROVISIONING_LOGIN>>]
        WITH PASSWORD = '<<CHOOSE_A_STRONG_PASSWORD>>',
             CHECK_POLICY = ON,
             DEFAULT_DATABASE = [TrainingPlanManagementDB];
END;
GO

USE [TrainingPlanManagementDB];
GO

IF DB_NAME() <> N'TrainingPlanManagementDB'
    THROW 53101, 'Wrong database context.', 1;
GO

IF USER_ID(N'<<PROVISIONING_LOGIN>>') IS NULL
BEGIN
    CREATE USER [<<PROVISIONING_LOGIN>>] FOR LOGIN [<<PROVISIONING_LOGIN>>];
END;
GO

-- Exactly what the seed script's three queries touch, and nothing more:
-- RESOLVE_ROLE_QUERY reads dbo.role; FIND_USERNAME_QUERY and INSERT_ACCOUNT_QUERY read and write
-- dbo.user_account. No UPDATE and no DELETE: this login creates accounts, it does not manage them.
GRANT SELECT ON dbo.role TO [<<PROVISIONING_LOGIN>>];
GRANT SELECT ON dbo.user_account TO [<<PROVISIONING_LOGIN>>];
GRANT INSERT ON dbo.user_account TO [<<PROVISIONING_LOGIN>>];
GO

DENY UPDATE ON dbo.user_account TO [<<PROVISIONING_LOGIN>>];
DENY DELETE ON dbo.user_account TO [<<PROVISIONING_LOGIN>>];
GO

/*
VERIFY — is_sysadmin must come back 0, otherwise the seed script will refuse this login.
*/
SELECT
    SUSER_ID(N'<<PROVISIONING_LOGIN>>')                          AS login_exists,
    USER_ID(N'<<PROVISIONING_LOGIN>>')                           AS db_user_exists,
    IS_SRVROLEMEMBER(N'sysadmin', N'<<PROVISIONING_LOGIN>>')     AS is_sysadmin;
GO
