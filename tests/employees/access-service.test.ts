import { randomBytes } from "node:crypto";
import { beforeAll,describe,expect,it,vi } from "vitest";
import type { AuthenticatedPrincipal,RoleCode } from "../../app/lib/auth/types";
import type { EmployeeRepository } from "../../app/lib/employees/repository";
import { createEmployeeService } from "../../app/lib/employees/service";
import { protectNationalId } from "../../app/lib/employees/nationalId";

const nationalId="1101700207030";let protectedId:ReturnType<typeof protectNationalId>;
beforeAll(()=>{process.env.NATIONAL_ID_HMAC_KEY=randomBytes(32).toString("base64");process.env.NATIONAL_ID_ACTIVE_KEY_VERSION="1";process.env.NATIONAL_ID_ENCRYPTION_KEY_V1=randomBytes(32).toString("base64");protectedId=protectNationalId(nationalId)});
const principal=(role:RoleCode,companyId:string|null,employeeId:string|null=null):AuthenticatedPrincipal=>({userId:"9",username:"test",role,companyId,employeeId,employeeUserId:employeeId?`USER-${employeeId}`:null,email:null,employeeCode:null,displayName:null,companyCode:null,companyName:null,functionCode:null,functionName:null,positionCode:null,positionName:null,levelCode:null,levelName:null,pl:null});
const repo=(trainingAccess=false)=>({bundle:vi.fn().mockResolvedValue({employee_id:BigInt("1"),company_id:BigInt("2"),national_id_encrypted:protectedId.encrypted,national_id_key_version:1}),factoryTrainingAccess:vi.fn().mockResolvedValue(trainingAccess)}) as unknown as EmployeeRepository;
describe("Employee National ID access",()=>{
  it("allows HRD_CENTER and Employee self",async()=>{expect(await createEmployeeService(repo()).reveal(principal("HRD_CENTER",null),"1")).toEqual({nationalId});expect(await createEmployeeService(repo()).reveal(principal("EMPLOYEE","2","1"),"1")).toEqual({nationalId})});
  it("allows factory cross-company only through approved training access",async()=>{await expect(createEmployeeService(repo(false)).reveal(principal("HRD_FACTORY","1"),"1")).rejects.toMatchObject({status:403});await expect(createEmployeeService(repo(true)).reveal(principal("HRD_FACTORY","1"),"1")).resolves.toEqual({nationalId})});
});
