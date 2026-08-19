/* eslint-disable @typescript-eslint/no-explicit-any */
import type { AuthenticatedPrincipal } from "../auth/types";
import { getPrismaClient } from "../database/prisma";
import { withDatabaseErrorMapping } from "../database/errors";
import { maskNationalId } from "./nationalId";
import type { EmployeeInput, EmployeeListFilters, EmployeeRecord } from "./types";

const map=(r:any):EmployeeRecord=>({employeeId:String(r.employee_id),companyId:String(r.company_id),companyCode:r.company.company_code,employeeCode:r.employee_code,
  functionId:r.function_id?String(r.function_id):null,functionCode:r.organization_function?.function_code??null,functionName:r.organization_function?.function_name_en??r.organization_function?.function_name_th??null,
  divisionId:r.division_id?String(r.division_id):null,divisionCode:r.division?.division_code??null,divisionName:r.division?.division_name_en??r.division?.division_name_th??null,
  departmentId:r.department_id?String(r.department_id):null,departmentCode:r.department?.department_code??null,departmentName:r.department?.department_name_en??r.department?.department_name_th??null,
  sectionId:r.section_id?String(r.section_id):null,sectionCode:r.section?.section_code??null,sectionName:r.section?.section_name_en??r.section?.section_name_th??null,
  positionId:r.position_id?String(r.position_id):null,positionCode:r.position?.position_code??null,positionName:r.position?.position_name_en??r.position?.position_name_th??null,
  levelId:r.level_id?String(r.level_id):null,levelCode:r.employee_level?.level_code??r.employee_level?.level_code_en??r.employee_level?.level_key??null,levelKey:r.employee_level?.level_code??r.employee_level?.level_code_en??r.employee_level?.level_key??null,
  titleTh:r.title_th,titleEn:r.title_en,firstNameTh:r.first_name_th,lastNameTh:r.last_name_th,firstNameEn:r.first_name_en,lastNameEn:r.last_name_en,
  birthDate:r.birth_date?.toISOString().slice(0,10)??null,hireDate:r.hire_date?.toISOString().slice(0,10)??null,telephone:r.telephone,email:r.email,
  employmentStatus:r.employment_status,nationalIdMasked:maskNationalId(r.national_id_last4)??"*************"});

const include={company:true,organization_function:true,division:true,department:true,section:true,position:true,employee_level:true} as const;
const data=(i:EmployeeInput,p:{hash:string;encrypted:Buffer;last4:string;keyVersion:number})=>({company_id:BigInt(i.companyId),function_id:i.functionId?BigInt(i.functionId):null,division_id:i.divisionId?BigInt(i.divisionId):null,department_id:i.departmentId?BigInt(i.departmentId):null,section_id:i.sectionId?BigInt(i.sectionId):null,position_id:i.positionId?BigInt(i.positionId):null,level_id:i.levelId?BigInt(i.levelId):null,
  employee_code:i.employeeCode,national_id_hash:p.hash,national_id_encrypted:Uint8Array.from(p.encrypted),national_id_last4:p.last4,national_id_key_version:p.keyVersion,
  birth_date:i.birthDate?new Date(`${i.birthDate}T00:00:00Z`):null,hire_date:i.hireDate?new Date(`${i.hireDate}T00:00:00Z`):null,title_th:i.titleTh,title_en:i.titleEn,
  first_name_th:i.firstNameTh,last_name_th:i.lastNameTh,first_name_en:i.firstNameEn,last_name_en:i.lastNameEn,telephone:i.telephone,email:i.email,employment_status:i.employmentStatus});

export const employeeRepository={
  async list(principal:AuthenticatedPrincipal,f:EmployeeListFilters){const db=getPrismaClient();const where:any={};if(principal.role==="HRD_FACTORY")where.company_id=BigInt(principal.companyId!);if(f.status)where.employment_status=f.status;if(f.search)where.OR=[{employee_code:{contains:f.search}},{first_name_th:{contains:f.search}},{last_name_th:{contains:f.search}},{first_name_en:{contains:f.search}},{last_name_en:{contains:f.search}}];
    return withDatabaseErrorMapping(async()=>{const [rows,totalItems]=await Promise.all([db.employee.findMany({where,include,orderBy:{employee_id:"asc"},skip:f.skip,take:f.take}),db.employee.count({where})]);return{items:rows.map(map),totalItems}})},
  async findById(id:string){const r=await getPrismaClient().employee.findUnique({where:{employee_id:BigInt(id)},include});return r?map(r):null},
  async findCompany(id:string){return getPrismaClient().company.findUnique({where:{company_id:BigInt(id)},select:{company_id:true}})},
  async referencesExist(i:EmployeeInput){const db=getPrismaClient();const [company,fn,div,dept,sec,pos,lvl]=await Promise.all([db.company.findUnique({where:{company_id:BigInt(i.companyId)}}),i.functionId?db.organization_function.findUnique({where:{function_id:BigInt(i.functionId)}}):true,i.divisionId?db.division.findUnique({where:{division_id:BigInt(i.divisionId)}}):true,i.departmentId?db.department.findUnique({where:{department_id:BigInt(i.departmentId)}}):true,i.sectionId?db.section.findUnique({where:{section_id:BigInt(i.sectionId)}}):true,i.positionId?db.position.findUnique({where:{position_id:BigInt(i.positionId)}}):true,i.levelId?db.employee_level.findUnique({where:{level_id:BigInt(i.levelId)}}):true]);return Boolean(company&&fn&&div&&dept&&sec&&pos&&lvl)},
  async conflict(companyId:string,code:string,hash:string,exclude?:string){return getPrismaClient().employee.findFirst({where:{OR:[{company_id:BigInt(companyId),employee_code:code},{national_id_hash:hash}],...(exclude?{NOT:{employee_id:BigInt(exclude)}}:{})},select:{employee_id:true}})},
  async create(i:EmployeeInput,p:any){return withDatabaseErrorMapping(async()=>map(await getPrismaClient().employee.create({data:data(i,p),include})))},
  async update(id:string,i:EmployeeInput,p:any){return withDatabaseErrorMapping(async()=>map(await getPrismaClient().employee.update({where:{employee_id:BigInt(id)},data:data(i,p),include})))},
  async delete(id:string){return withDatabaseErrorMapping(async()=>map(await getPrismaClient().employee.delete({where:{employee_id:BigInt(id)},include})))},
  async bundle(id:string){return getPrismaClient().employee.findUnique({where:{employee_id:BigInt(id)},select:{employee_id:true,company_id:true,national_id_encrypted:true,national_id_key_version:true}})},
  async factoryTrainingAccess(employeeId:string,companyId:string){const count=await getPrismaClient().training_enrollment.count({where:{employee_id:BigInt(employeeId),approval_status:"APPROVED",training_plan:{user_account_training_plan_created_byTouser_account:{company_id:BigInt(companyId),role:{role_code:"HRD_FACTORY"}}}}});return count>0},
};
export type EmployeeRepository=typeof employeeRepository;
