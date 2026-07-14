# SQL Server Express 2022 placeholder

ไฟล์นี้เตรียมไว้สำหรับเชื่อม SQL Server Express 2022 ภายหลัง ยังไม่ได้ผูกเข้ากับหน้า UI หรือ API ใด ๆ

## Env ที่ควรใส่ใน `.env.local`

```env
SQLSERVER_HOST=localhost
SQLSERVER_INSTANCE=SQLEXPRESS
SQLSERVER_DATABASE=HRDTraining
SQLSERVER_USER=sa
SQLSERVER_PASSWORD=your_password
SQLSERVER_ENCRYPT=false
SQLSERVER_TRUST_CERT=true
```

ถ้า SQL Server ใช้ port ตรงแทน instance ให้เพิ่ม:

```env
SQLSERVER_PORT=1433
```

เมื่อจะเชื่อมจริง ค่อยติดตั้ง driver เช่น `mssql` แล้วนำ config จาก `getSqlServerExpressConfig()` ไปใช้ใน server-side code หรือ API route เท่านั้น
