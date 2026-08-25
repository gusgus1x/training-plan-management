# Admin + Audit Log — บันทึกความคืบหน้า

คู่กับ `docs/admin-and-audit-log-plan.md` (แผนและข้อตัดสิน) ไฟล์นี้บันทึก **ทำอะไรไปแล้วเมื่อไหร่ และเหลืออะไร**

- Branch: `feat/admin-audit-log`
- ปรับปรุงล่าสุด: 2026-08-24
- สถานะ: **เฟส 1-4 เสร็จ · เฟส 5-7 ยังไม่เริ่ม**
- บริบท: กำลังจะ commit เฟส 4 แล้วสลับกลับไปทำงาน branch `main` ต่อ

---

## ไทม์ไลน์

### 2026-08-24 (ก่อนหน้า) — วางแผน
เริ่มจากคำถามว่า admin ควรมีหน้าที่อะไร สำรวจโครงสร้างสิทธิ์ที่มีอยู่แล้วสรุปเป็นแผน

**ข้อตัดสินที่ล็อกไว้ (รายละเอียดเต็มใน plan.md):**
- ADMIN เป็นคนละคนกับ HRD Center — เป็น IT ไม่ใช่เจ้าของงาน HRD
- ADMIN จัดการบัญชี/สิทธิ์/ดู audit log เท่านั้น · **ห้ามเปิดดูเลขบัตรประชาชน**
- อ่าน audit log ได้เฉพาะ ADMIN
- เก็บ log: การลบ/PII/งาน admin = **2 ปี** · ล็อกอิน = **90 วัน**

### 2026-08-24 — เฟส 1: ตาราง audit_log ✅
- `prisma/migrations/27_Add_Audit_Log.sql` — 14 คอลัมน์ + index 4 ตัว + CHECK คุม category
- `prisma/permissions/15_Grant_Audit_Log_Api_Permissions.sql` — GRANT SELECT/INSERT + **DENY UPDATE/DELETE**
- รัน `prisma db pull` + `prisma generate` → model `audit_log` เข้า schema แล้ว
- ผู้ใช้รัน SQL เองใน SSMS (บัญชีแอปไม่มีสิทธิ์ DDL)

### 2026-08-24 — เฟส 2: ตัวเขียน log + Tier 1 ✅
- `app/lib/audit/index.ts` — `recordAudit` (fail-closed), `recordAuditQuietly` (fail-open), `recordDeleteAudit`, `auditRequestContext`, `AUDIT_RETENTION_DAYS`
- **ล็อกอิน**: `LOGIN_SUCCEEDED` / `LOGIN_FAILED` (เก็บ username ที่พยายามใช้) / `LOGOUT`
- **PII**: `NATIONAL_ID_REVEALED`
- **การลบ**: ครบทั้ง **21 endpoint**
  - 3 เส้นทาง cascade (หลักสูตร/OAP/รอบอบรม) → log ใน `cascadeDeleteTrainingPlans` **ในทรานแซกชันเดียวกัน** พร้อมนับแถวที่ถูกลบแยกตามตาราง
  - 18 endpoint master data → `recordDeleteAudit` หลังลบสำเร็จ
- เทสต์ใหม่ `tests/audit/record-audit.test.ts` (5 เคส)

**บทเรียนที่เจอ:** ตอนแรกตั้ง `recordDeleteAudit` เป็น fail-closed ทำให้เทสต์ 2 ตัวพังด้วย 500 — เพราะมันทำงาน *หลัง* ลบ commit แล้ว throw ไปก็ย้อนอะไรไม่ได้ เปลี่ยนเป็น fail-open (มี `ponytail:` comment ระบุเพดานไว้)

### 2026-08-24 — เฟส 3: role ADMIN ✅
- `ROLE_CODES` + `CLIENT_ROLE_CODES` เพิ่ม `"ADMIN"`
- `prisma/migrations/28_Allow_Admin_Role_Code.sql` — **ไม่ได้อยู่ในแผนเดิม** ตาราง `role` มี CHECK constraint 2 ตัวจาก schema V6 (`CK_RC2_role_role_code_enum`, `CK_role_role_code`) ทำ seed ล้ม Msg 547 → ยุบเหลือ `CK_role_role_code_enum` ตัวเดียวที่ตรงกับ `ROLE_CODES`
- `prisma/seeds/07_Seed_Admin_Role.sql`
- `AuthGate.tsx` เพิ่ม dev preview user สำหรับ ADMIN
- **ไม่ต้องเพิ่มสาขาใน `authentication.ts`** — fallback เดิมคืน `employeeId: null, companyId: null` ตรงกับที่ ADMIN ต้องการอยู่แล้ว
- เทสต์เพิ่ม 2 เคสใน `tests/auth/authentication.test.ts`

**Commit `e56300c`** = เฟส 1-3 (push แล้ว)

### 2026-08-24 — เฟส 4: จัดการบัญชีผู้ใช้ ✅ (ยังไม่ commit)
- `prisma/permissions/16_Grant_User_Account_Admin_Permissions.sql` — เดิม `user_account` มีแค่ SELECT ระดับคอลัมน์ เพิ่ม INSERT + UPDATE 7 คอลัมน์ + **DENY DELETE** (บัญชีถูก *ปิด* ไม่ใช่ลบ เพราะ audit log และ `created_by` ทั่วระบบชี้มาที่ user_id)
- `app/lib/userAccounts/` — types, validation, repository, service, client
- API: `GET/POST /api/admin/users` · `GET/PATCH /api/admin/users/[userId]` · `POST /api/admin/users/[userId]/password` ทั้งหมด `allowedRoles: ["ADMIN"]`
- audit หมวด `ACCOUNT`: `USER_ACCOUNT_CREATED` / `_UPDATED` / `_PASSWORD_RESET` (fail-closed)
- UI `app/components/admin/AdminWorkspace.tsx` + CSS — ตารางบัญชี, ค้นหา/กรอง, สร้างบัญชี (ฟอร์มเปลี่ยนตาม role), รีเซ็ตรหัสผ่าน, ปิด/เปิดบัญชี
- `app/page.tsx` route ADMIN มาหน้านี้ (ไม่งั้นไปโดน dashboard HRD ที่ 403 ทุก API)
- `scripts/seed-development-account.mjs` เพิ่ม `--role` (HRD_CENTER | ADMIN) + npm script `account:seed`
- `prisma/permissions/17_Create_Provisioning_Login.sql` — สร้าง SQL login สำหรับ seed บัญชีแรก (placeholder ไม่มีรหัสผ่านจริง)
- เทสต์ใหม่ `tests/userAccounts/service.test.ts` (9 เคส)

**กฎที่ service บังคับ:** ผูก role ให้ตรงกับ `resolveActivePrincipal` · เปลี่ยน role/ปิดบัญชีตัวเองไม่ได้ · ปิด admin คนสุดท้ายไม่ได้

**เปลี่ยนตามที่ผู้ใช้ขอ:** ความยาวรหัสผ่านขั้นต่ำ 12 → **6** ตัว (แก้ 4 ไฟล์: seed script, validation, UI 2 จุด, test)

---

## สถานะการรัน SQL บนเครื่อง dev

| ไฟล์ | รันแล้ว |
|---|---|
| migrations/27, 28 | ✅ |
| permissions/15, 16 | ✅ |
| seeds/07 | ✅ |
| permissions/17 (provisioning login) | ⚠️ สร้าง login สำเร็จแล้ว แต่ยังไม่ได้ทำขั้นต่อไป |

**ติดค้างตรงนี้:** ผู้ใช้สร้าง provisioning login เสร็จ (หลังแก้ปัญหารหัสผ่านสั้นเกินนโยบาย Windows — Msg 15116) **แต่ยังไม่ได้รัน `npm run account:seed` สร้าง admin คนแรก และยังไม่ได้ทดสอบหน้าจอ admin จริง**

---

## เหลือทำ

### ทำต่อทันทีเมื่อกลับมา
1. `npm run account:seed -- --username <ชื่อ> --role ADMIN` (ใช้ provisioning login ที่สร้างไว้)
2. `npm run dev` → ล็อกอินเป็น admin → ทดสอบหน้า User Accounts
3. ตรวจว่า audit ทำงาน: `SELECT TOP 10 ... FROM dbo.audit_log ORDER BY audit_log_id DESC` ควรเห็น `LOGIN_SUCCEEDED` + `USER_ACCOUNT_CREATED`

### เฟสที่ยังไม่เริ่ม
- **เฟส 5** — หน้าดู audit log (ADMIN เท่านั้น) + กรองตาม category/ช่วงเวลา/ผู้ใช้
- **เฟส 6** — `scripts/purge-audit-log.mjs` (`DELETE WHERE retain_until < today`) **ต้องรันด้วยบัญชี DB คนละตัว** เพราะบัญชีแอปโดน DENY DELETE
- **เฟส 7** — Tier 2 events: เผยแพร่/ยกเลิกรอบอบรม, อนุมัติ/ปฏิเสธการลงทะเบียน, แก้ไขการเช็คชื่อ, เผยแพร่แบบทดสอบ/ประเมิน

### หนี้ที่รู้ตัว
- UI: ช่อง Employee ID ตอนสร้างบัญชี EMPLOYEE ให้พิมพ์เลข id ดิบ · รีเซ็ตรหัสผ่านใช้ `window.prompt` — ใช้ได้แต่ไม่สวย
- ยังไม่ได้ log การ **ส่งออกข้อมูล** (Tier 1 ข้อ 5: attendance-sheet, course-outline)
- ยังไม่ได้ log การเปิดดูเลขบัตรที่ **ถูกปฏิเสธ** (log เฉพาะที่สำเร็จ)
- `AdminWorkspace` ไม่ผ่าน `thaiUiDictionary` — ยังไม่รองรับสองภาษา

---

## เรื่อง deploy ที่คุยกันไว้ (ยังไม่ได้ทำอะไร)

ฐานข้อมูลเป็น `containment = NONE` และบัญชีแอปเป็น `SQL_USER` แบบ `INSTANCE` → login อยู่ระดับ server, database user อยู่ในฐานข้อมูล จับคู่ด้วย SID

**restore backup ข้ามเครื่อง = database user ไปด้วย (พร้อมสิทธิ์) แต่ login ไม่ไป → orphaned user**

- ตรวจแล้วว่าเครื่องทดลองปัจจุบัน**ไม่มีปัญหานี้** (ล็อกอินได้ปกติ, `is_sysadmin = 0`, `is_db_owner = 0` → กลไก DENY บน audit_log จะทำงานตามที่ออกแบบ)
- ความเสี่ยงจริงไม่ใช่ตัว orphan แต่คือ**วิธีแก้แบบเร่งด่วน**: ถ้าใครลบ+สร้าง database user ใหม่ หรือเปลี่ยนไปใช้ sa สิทธิ์ DENY UPDATE/DELETE บน `audit_log` จะหายไปเงียบๆ
- ทางเลือกที่เสนอไว้: **A)** contained database user (ต้องเปิด `contained database authentication` ที่ระดับ server ตอนนี้ = 0) · **B)** bootstrap script สร้าง login ด้วย SID เดิม
- **ยังไม่ได้ตัดสิน ยังไม่ได้แตะอะไร**
