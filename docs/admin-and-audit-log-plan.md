# Admin Account + Audit Log — แผนการทำงาน

สถานะ: **ยังไม่เริ่มทำ** (แผนอย่างเดียว รอไฟเขียว)
วันที่สรุป: 2026-08-24

---

## 1. ข้อตัดสินที่ล็อกแล้ว

| หัวข้อ | ตัดสินว่า |
|---|---|
| ADMIN เป็นใคร | **คนละคนกับ HRD Center** — เป็นผู้ดูแลระบบ ไม่ใช่เจ้าของงาน HRD |
| ADMIN ทำอะไร | จัดการบัญชีผู้ใช้ + สิทธิ์ + ดู audit log |
| ADMIN **ไม่** ทำอะไร | ไม่สร้าง/แก้หลักสูตร แผนอบรม ผลอบรม และ **ไม่มีสิทธิ์เปิดดูเลขบัตรประชาชน** (แยกหน้าที่ กันไม่ให้เกิด super-account) |
| ใครอ่าน audit log ได้ | **ADMIN เท่านั้น** |
| เก็บ log นานแค่ไหน | การลบ + PII + งาน admin = **2 ปี** (อยู่ในช่วง 1-3 ปีที่ตกลง ปรับได้ที่ค่าคงที่จุดเดียว) · ล็อกอิน = **90 วัน** |

---

## 2. ตาราง `audit_log`

ตารางเดียวจบ ไม่แยกตารางตามประเภท (ประเภทน้อย ปริมาณไม่สูงพอจะคุ้มกับการแยก)

```
audit_log_id     BIGINT IDENTITY  PK
occurred_at      DATETIME2        NOT NULL
category         NVARCHAR(20)     NOT NULL   -- AUTH | PII | DELETE | ACCOUNT | EXPORT
action           NVARCHAR(60)     NOT NULL   -- LOGIN_FAILED, NATIONAL_ID_REVEALED, COURSE_DELETED, ...
actor_user_id    BIGINT           NULL       -- NULL ได้: ล็อกอินล้มเหลวยังไม่รู้ว่าใคร
actor_username   NVARCHAR(100)    NULL       -- สำเนา ณ ขณะนั้น อยู่รอดแม้บัญชีถูกลบ
actor_role       NVARCHAR(30)     NULL
entity_type      NVARCHAR(60)     NULL       -- course, training_plan, employee, user_account
entity_id        NVARCHAR(50)     NULL       -- เก็บเป็น text ไม่ใช่ FK
entity_label     NVARCHAR(255)    NULL       -- ชื่อ ณ ขณะนั้น (ของจริงถูกลบไปแล้ว)
detail           NVARCHAR(MAX)    NULL       -- JSON: จำนวนแถวลูกที่ถูกลบ, employee เป้าหมาย ฯลฯ
ip_address       NVARCHAR(45)     NULL
user_agent       NVARCHAR(400)    NULL
retain_until     DATE             NOT NULL   -- คำนวณตอน insert
```

**เหตุผลของ 3 จุดสำคัญ**

1. **ไม่มี FK ไปยังของที่ถูกลบ** — ถ้าใช้ relation แบบ cascade พอลบแผน log ก็หายตามไปด้วย ซึ่งทำลายเหตุผลทั้งหมดที่มี log
2. **`actor_username` / `entity_label` เก็บเป็นสำเนา** — อ่าน log ย้อนหลังได้แม้บัญชีหรือหลักสูตรนั้นไม่มีอยู่แล้ว
3. **`retain_until` คำนวณตอนเขียน** — การล้างข้อมูลเหลือ `DELETE WHERE retain_until < today` คำสั่งเดียว ไม่ต้องกระจายกติกาการเก็บไปตามที่ต่างๆ

Index: `(occurred_at DESC)`, `(category, occurred_at DESC)`, `(actor_user_id)`, `(retain_until)`

---

## 3. สิทธิ์ระดับฐานข้อมูล (สำคัญ)

โปรเจกต์นี้ใช้ column-level GRANT อยู่แล้ว ([prisma/permissions/](../prisma/permissions/)) ใช้ประโยชน์ตรงนี้ให้เต็มที่:

```sql
GRANT SELECT, INSERT ON dbo.audit_log TO training_plan_app;
-- ตั้งใจไม่ให้ UPDATE / DELETE
```

**ผลลัพธ์: ตัวแอปแก้หรือลบประวัติของตัวเองไม่ได้** ได้ความน่าเชื่อถือมาฟรีโดยไม่ต้องเขียนโค้ดเพิ่มสักบรรทัด

**ข้อควรระวัง:** เมื่อ app ไม่มีสิทธิ์ DELETE สคริปต์ล้างข้อมูลจึงรันด้วย login ของแอปไม่ได้ ต้องรันด้วยบัญชี DB แยก (ผ่าน SQL Server Agent job หรือรันมือตามรอบ) — เป็นข้อจำกัดที่ตั้งใจ ไม่ใช่บั๊ก

> ทุกครั้งที่เพิ่มตาราง/คอลัมน์ ต้องมีไฟล์ `prisma/permissions/*.sql` คู่กันเสมอ ไม่งั้นแอป query ไม่ได้ทั้งที่ตารางมีอยู่จริง

---

## 4. เหตุการณ์ที่ต้องบันทึก

### Tier 1 — ทำก่อน

| # | เหตุการณ์ | ทำไม | จุดในโค้ด |
|---|---|---|---|
| 1 | **การลบทุกชนิด** | มี DELETE endpoint 21 จุด และ cascade ลบต่อเนื่อง 11 ตาราง ลบหลักสูตรเดียว = ประวัติอบรมหายยกชุด | [trainingPlanCascade.ts](../app/lib/trainingPlanCascade.ts) + repository ต่างๆ |
| 2 | **เปิดดูเลขบัตรประชาชน** | ถอดรหัส PII ตอนนี้ไม่มีบันทึกเลย | [employees/service.ts](../app/lib/employees/service.ts) `reveal()` |
| 3 | **ล็อกอิน สำเร็จ/ล้มเหลว/ออก** | ปัจจุบันมีแค่ `last_login_at` ที่ทับตัวเอง จับการเดารหัสผ่านไม่ได้ | [auth/authentication.ts](../app/lib/auth/authentication.ts), `api/auth/*` |
| 4 | **งานของ ADMIN เอง** | สร้าง/ปิดบัญชี เปลี่ยน role รีเซ็ตรหัสผ่าน — ถ้าไม่บันทึก ก็ตรวจสอบ admin ไม่ได้ | API ใหม่ |
| 5 | **การส่งออกข้อมูล** | attendance-sheet / course-outline / Excel = PII ออกจากระบบเป็นก้อน | `api/training-accept-survey/attendance-sheet`, `api/course-master/course-outline` |

**ข้อ 1 ต้องเก็บจำนวนแถวลูกที่ถูกลบแยกตามตาราง** ลงใน `detail` (JSON) ไม่งั้นจะไม่รู้ว่าความเสียหายกว้างแค่ไหน

### Tier 2 — ตามมาทีหลัง

6. เผยแพร่/ยกเลิกรอบอบรม
7. อนุมัติ/ปฏิเสธการลงทะเบียน
8. แก้ไขการเช็คชื่อ (กระทบใบเซอร์)
9. เผยแพร่แบบทดสอบ/แบบประเมิน และการเปิดให้ส่งใหม่

### ไม่ทำ

- create/update ทั่วไปของ master data → `created_by`/`updated_by` ที่มีอยู่พอแล้ว
- การอ่าน/ค้นหาทั่วไป → ปริมาณมหาศาล ประโยชน์น้อย (ยกเว้นข้อ 2 และ 5)

---

## 5. ลำดับการทำ

| เฟส | งาน | ผลลัพธ์ที่ตรวจได้ |
|---|---|---|
| 1 | Migration `27_Add_Audit_Log.sql` + `prisma/permissions/15_Grant_Audit_Log.sql` + `prisma db pull` | ตารางมีจริง แอป INSERT ได้ UPDATE ไม่ได้ |
| 2 | ตัวช่วยเขียน log (`app/lib/audit/`) + ต่อ Tier 1 ข้อ 1-3 | ลบของ / เปิดดูเลขบัตร / ล็อกอินผิด แล้วมีแถวขึ้นใน `audit_log` |
| 3 | เพิ่ม role `ADMIN`: `ROLE_CODES`, `CLIENT_ROLE_CODES`, **migration 28 ปรับ CHECK constraint บน `role.role_code`**, seed แถวใน `role` | ล็อกอินเป็น admin ได้ และโดน 403 ทุก route เดิมโดยอัตโนมัติ |

**สิ่งที่พบตอนทำเฟส 3 (ต่างจากแผน):**
- ไม่ต้องเพิ่มสาขา ADMIN ใน `authentication.ts` — fallback เดิมคืน `employeeId: null, companyId: null` ตรงกับที่ ADMIN ต้องการอยู่แล้ว
- ตาราง `role` มี CHECK constraint คุม `role_code` อยู่ **2 ตัว** (`CK_RC2_role_role_code_enum`, `CK_role_role_code`) มาจาก schema V6 เดิม ไม่มีใน repo ทำให้ seed ล้มด้วย Msg 547 → เพิ่ม `28_Allow_Admin_Role_Code.sql` รวมเป็นตัวเดียวที่ตรงกับ `ROLE_CODES`
- **ลำดับการรัน: migration 28 ก่อน แล้วค่อย seed 07**
| 4 | API + หน้าจอจัดการบัญชี (`allowedRoles: ["ADMIN"]`) + Tier 1 ข้อ 4 | สร้าง/ปิดบัญชีในแอปได้ เลิกต้องรัน script |

**ลำดับ SQL ที่ต้องรันสำหรับเซิร์ฟเวอร์ใหม่ (สะสมจากเฟส 1-4):**

1. `prisma/migrations/27_Add_Audit_Log.sql`
2. `prisma/migrations/28_Allow_Admin_Role_Code.sql`
3. `prisma/permissions/15_Grant_Audit_Log_Api_Permissions.sql`
4. `prisma/permissions/16_Grant_User_Account_Admin_Permissions.sql`
5. `prisma/seeds/07_Seed_Admin_Role.sql`
6. `prisma/permissions/17_Create_Provisioning_Login.sql` — **ครั้งเดียวต่อเซิร์ฟเวอร์ ต้องแก้ placeholder ก่อน** ใช้สร้าง login สำหรับ seed บัญชีแรก
7. `npm run account:seed -- --username <ชื่อ> --role ADMIN` — สร้าง admin คนแรก (ไก่กับไข่: หน้าจอ admin ต้องล็อกอินเป็น admin ก่อนถึงจะสร้างบัญชีได้)

หมายเหตุ: ถ้า restore จาก backup ที่รันข้อ 1-5 ไปแล้ว ไม่ต้องรันซ้ำ (สิทธิ์เก็บอยู่ในตัว database) แต่ข้อ 6 เป็น **login ระดับ server** ซึ่ง backup ไม่พาไป ต้องสร้างใหม่ทุกเครื่อง
| 5 | หน้าดู audit log (ADMIN เท่านั้น) + ตัวกรองตาม category/ช่วงเวลา/ผู้ใช้ | |
| 6 | สคริปต์ล้างข้อมูลตามรอบ (`scripts/purge-audit-log.mjs`) | `DELETE WHERE retain_until < today` |
| 7 | Tier 2 ข้อ 6-9 | |

**หมายเหตุเฟส 3:** กลไก `allowedRoles` ที่มีอยู่ทำให้ role ใหม่ถูกปฏิเสธทุก route โดยปริยาย — ได้ least privilege มาฟรี ไม่ต้องไล่แก้ 71 จุด

---

## 6. ทางลัดที่เคยเสนอ (ตกไปแล้ว)

เคยเสนอว่า "ไม่ต้องเพิ่ม role ใหม่ ทำแค่หน้าจัดการบัญชีให้ HRD_CENTER" — **ตกไป** เพราะตัดสินแล้วว่า admin เป็นคนละคนกับ HRD Center บันทึกไว้เผื่อทบทวนภายหลัง
