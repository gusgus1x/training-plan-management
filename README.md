# ATTG Training Plan Management

ระบบจัดการแผนฝึกอบรม — Next.js + TypeScript + Prisma + SQL Server

## ติดตั้ง

```bash
npm install   
```

## ตั้งค่า Environment

คัดลอก `.env.example` เป็น `.env` แล้วกรอกค่า:

```env
DB_SERVER=
DB_INSTANCE=
DB_DATABASE=
DB_USER=
DB_PASSWORD=

DB_ENCRYPT=false
DB_TRUST_SERVER_CERTIFICATE=true
DB_CONNECTION_TIMEOUT_MS=15000
DB_REQUEST_TIMEOUT_MS=15000
DB_POOL_MAX=10
DB_POOL_IDLE_TIMEOUT_MS=30000

AUTH_SESSION_SECRET=

NATIONAL_ID_HMAC_KEY=
NATIONAL_ID_ACTIVE_KEY_VERSION=
NATIONAL_ID_ENCRYPTION_KEY_V1=
```



## รันระบบ

```bash
npm run dev     # โหมดพัฒนา
npm run build && npm run start   # production
```
