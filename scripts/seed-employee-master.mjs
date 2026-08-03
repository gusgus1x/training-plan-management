import { createCipheriv, createHmac, randomBytes, randomInt } from "node:crypto";
import { readFileSync } from "node:fs";
import { config as loadEnvironment } from "dotenv";
import sql from "mssql";

loadEnvironment({ path: ".env.local", quiet: true });
const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};
const decodeKey = (name) => {
  const value = Buffer.from(required(name), "base64");
  if (value.length !== 32) throw new Error(`${name} must decode to 32 bytes`);
  return value;
};
const hmacKey = decodeKey("NATIONAL_ID_HMAC_KEY");
const keyVersion = Number(required("NATIONAL_ID_ACTIVE_KEY_VERSION"));
const encryptionKey = decodeKey(`NATIONAL_ID_ENCRYPTION_KEY_V${keyVersion}`);

const source = readFileSync("app/lib/employeeMasterData.ts", "utf8");
const thaiTitle = (titleEn) => titleEn === "Mr." ? "นาย" : titleEn === "Mrs." ? "นาง" : "นางสาว";
const pattern = /createEmployee\("(ATA|TEP|ATFB|NIC|SATI|SNF)",\s*(\d+),\s*\{\s*nameTh:\s*"([^"]+)",\s*surnameTh:\s*"([^"]+)",\s*titleEn:\s*"([^"]+)",\s*nameEn:\s*"([^"]+)",\s*surnameEn:\s*"([^"]+)",\s*birthday:\s*"([^"]+)",\s*workday:\s*"([^"]+)",\s*functionCode:\s*"([^"]+)",\s*functionName:\s*"([^"]+)",\s*positionName:\s*"([^"]+)",\s*levelKey:\s*"([^"]+)"\s*\}\)/g;
const profiles = [...source.matchAll(pattern)].map((m) => ({
  companyCode:m[1],sequence:Number(m[2]),firstNameTh:m[3],lastNameTh:m[4],titleEn:m[5],titleTh:thaiTitle(m[5]),firstNameEn:m[6],lastNameEn:m[7],birthDate:m[8],hireDate:m[9],functionCode:m[10],positionName:m[12],levelKey:m[13],
}));
const companyCodes=["ATA","TEP","ATFB","NIC","SATI","SNF"];
const selected=companyCodes.flatMap((code)=>profiles.filter((p)=>p.companyCode===code).slice(0,5));
if(selected.length!==30)throw new Error(`Expected 30 UI mock profiles, found ${selected.length}`);

const generateId=()=>{const digits=[randomInt(1,9),...Array.from({length:11},()=>randomInt(0,10))];const sum=digits.reduce((t,d,i)=>t+d*(13-i),0);digits.push((11-(sum%11))%10);return digits.join("")};
const protect=(id)=>{const iv=randomBytes(12);const cipher=createCipheriv("aes-256-gcm",encryptionKey,iv);const ciphertext=Buffer.concat([cipher.update(id,"utf8"),cipher.final()]);return{hash:createHmac("sha256",hmacKey).update(id).digest("hex"),encrypted:Buffer.concat([Buffer.from([1]),iv,cipher.getAuthTag(),ciphertext]),last4:id.slice(-4)}};
const add=(request,name,type,value)=>request.input(name,type,value);
const config={server:process.env.DB_INSTANCE?`${required("DB_SERVER")}\\${process.env.DB_INSTANCE}`:required("DB_SERVER"),database:required("DB_DATABASE"),user:required("DB_USER"),password:required("DB_PASSWORD"),options:{encrypt:process.env.DB_ENCRYPT==="true",trustServerCertificate:process.env.DB_TRUST_SERVER_CERTIFICATE!=="false"}};
const pool=await sql.connect(config);const transaction=new sql.Transaction(pool);await transaction.begin();
try{
  const companies=(await new sql.Request(transaction).query("SELECT company_id,company_code FROM dbo.company")).recordset;
  const functions=(await new sql.Request(transaction).query("SELECT function_id,function_code FROM dbo.organization_function")).recordset;
  const positions=(await new sql.Request(transaction).query("SELECT position_id,position_name_en FROM dbo.position")).recordset;
  const levels=(await new sql.Request(transaction).query("SELECT level_id,level_key FROM dbo.employee_level")).recordset;
  const employees=(await new sql.Request(transaction).query("SELECT employee_id,company_id,employee_code,national_id_last4 FROM dbo.employee ORDER BY employee_id")).recordset;
  const companyMap=new Map(companies.map((x)=>[x.company_code,x.company_id]));const functionMap=new Map(functions.map((x)=>[x.function_code,x.function_id]));const positionMap=new Map(positions.map((x)=>[x.position_name_en,x.position_id]));const levelMap=new Map(levels.map((x)=>[x.level_key,x.level_id]));
  let inserted=0,updated=0;
  for(const companyCode of companyCodes){const companyProfiles=selected.filter((p)=>p.companyCode===companyCode);const companyId=companyMap.get(companyCode);if(!companyId)throw new Error(`Missing company ${companyCode}`);const existing=employees.filter((e)=>String(e.company_id)===String(companyId)).slice(0,2);
    if(existing.length!==2)throw new Error(`Expected two existing development employees for ${companyCode}`);
    for(let index=0;index<2;index++){const p=companyProfiles[index];const current=existing[index];const request=new sql.Request(transaction);add(request,"employeeId",sql.BigInt,current.employee_id);add(request,"firstNameTh",sql.NVarChar(150),p.firstNameTh);add(request,"lastNameTh",sql.NVarChar(150),p.lastNameTh);add(request,"titleTh",sql.NVarChar(50),p.titleTh);add(request,"titleEn",sql.NVarChar(50),p.titleEn);add(request,"firstNameEn",sql.NVarChar(150),p.firstNameEn);add(request,"lastNameEn",sql.NVarChar(150),p.lastNameEn);add(request,"birthDate",sql.Date,p.birthDate);add(request,"hireDate",sql.Date,p.hireDate);
      let nationalSql="";if(!current.national_id_last4){const n=protect(generateId());add(request,"hash",sql.Char(64),n.hash);add(request,"encrypted",sql.VarBinary(256),n.encrypted);add(request,"last4",sql.Char(4),n.last4);add(request,"keyVersion",sql.SmallInt,keyVersion);nationalSql=",national_id_hash=@hash,national_id_encrypted=@encrypted,national_id_last4=@last4,national_id_key_version=@keyVersion"}
      await request.query(`UPDATE dbo.employee SET first_name_th=@firstNameTh,last_name_th=@lastNameTh,title_th=@titleTh,title_en=@titleEn,first_name_en=@firstNameEn,last_name_en=@lastNameEn,birth_date=@birthDate,hire_date=@hireDate${nationalSql} WHERE employee_id=@employeeId`);updated++}
    for(const p of companyProfiles.slice(2)){const code=`${companyCode}-${String(p.sequence).padStart(4,"0")}`;if(employees.some((e)=>String(e.company_id)===String(companyId)&&e.employee_code===code))continue;const functionId=functionMap.get(p.functionCode),positionId=positionMap.get(p.positionName),levelId=levelMap.get(p.levelKey);if(!functionId||!positionId||!levelId)throw new Error(`Missing master mapping for ${companyCode}/${code}`);const n=protect(generateId());const request=new sql.Request(transaction);for(const [name,type,value] of [["companyId",sql.BigInt,companyId],["functionId",sql.BigInt,functionId],["positionId",sql.BigInt,positionId],["levelId",sql.BigInt,levelId],["code",sql.NVarChar(50),code],["hash",sql.Char(64),n.hash],["encrypted",sql.VarBinary(256),n.encrypted],["last4",sql.Char(4),n.last4],["keyVersion",sql.SmallInt,keyVersion],["birthDate",sql.Date,p.birthDate],["titleTh",sql.NVarChar(50),p.titleTh],["titleEn",sql.NVarChar(50),p.titleEn],["firstNameTh",sql.NVarChar(150),p.firstNameTh],["lastNameTh",sql.NVarChar(150),p.lastNameTh],["firstNameEn",sql.NVarChar(150),p.firstNameEn],["lastNameEn",sql.NVarChar(150),p.lastNameEn],["hireDate",sql.Date,p.hireDate]])add(request,name,type,value);
      await request.query("INSERT dbo.employee(company_id,function_id,position_id,level_id,employee_code,national_id_hash,national_id_encrypted,national_id_last4,national_id_key_version,birth_date,title_th,title_en,first_name_th,last_name_th,first_name_en,last_name_en,hire_date,employment_status) VALUES(@companyId,@functionId,@positionId,@levelId,@code,@hash,@encrypted,@last4,@keyVersion,@birthDate,@titleTh,@titleEn,@firstNameTh,@lastNameTh,@firstNameEn,@lastNameEn,@hireDate,N'ACTIVE')");inserted++}
  }
  await transaction.commit();process.stdout.write(`Employee seed completed: ${updated} existing profiles updated, ${inserted} employees inserted. Full National IDs were not logged.\n`);
}catch(error){await transaction.rollback();throw error}finally{await pool.close()}
