import { ApiError } from "../api/errors";
import { readOptionalString, readPositiveId, readRequiredString, type InputObject } from "../api/validation";
import { isValidThaiNationalId } from "./nationalId";
import type { EmployeeInput, EmployeeListFilters, EmploymentStatus, UpdateEmployeeInput } from "./types";

const own=(o:InputObject,k:string)=>Object.prototype.hasOwnProperty.call(o,k);
const invalid=(field:string,reason:string)=>new ApiError({code:"INVALID_INPUT",message:"The submitted employee data is invalid",status:400,details:{field,reason}});
const optionalId=(o:InputObject,k:string)=>{const v=o[k];return v===null||v===undefined||v===""?null:readPositiveId(v,k)};
const date=(o:InputObject,k:string)=>{const v=readOptionalString(o,k,{maxLength:10});if(v&&!/^\d{4}-\d{2}-\d{2}$/.test(v))throw invalid(k,"Use YYYY-MM-DD");return v};
const status=(v:unknown,fallback?:EmploymentStatus):EmploymentStatus=>{if(v===undefined&&fallback)return fallback;if(typeof v!=="string"||!["ACTIVE","INACTIVE"].includes(v.toUpperCase()))throw invalid("employmentStatus","Status must be ACTIVE or INACTIVE");return v.toUpperCase() as EmploymentStatus};
const national=(o:InputObject)=>{const v=readRequiredString(o,"nationalId",{maxLength:13});if(!isValidThaiNationalId(v))throw invalid("nationalId","National ID must contain exactly 13 digits");return v};
const thaiTitle=(o:InputObject)=>{const v=readRequiredString(o,"titleTh",{maxLength:50});if(!["นาย","นาง","นางสาว"].includes(v))throw invalid("titleTh","Title TH must be นาย, นาง, or นางสาว");return v};
export const parseCreateEmployee=(o:InputObject):EmployeeInput=>({
  companyId:readPositiveId(o.companyId,"companyId"),employeeCode:readRequiredString(o,"employeeCode",{maxLength:50}).toUpperCase(),userId:readRequiredString(o,"userId",{maxLength:50}),
  functionId:optionalId(o,"functionId"),divisionId:optionalId(o,"divisionId"),departmentId:optionalId(o,"departmentId"),sectionId:optionalId(o,"sectionId"),
  positionId:optionalId(o,"positionId"),levelId:optionalId(o,"levelId"),nationalId:national(o),
  titleTh:thaiTitle(o),titleEn:readOptionalString(o,"titleEn",{maxLength:50}),
  firstNameTh:readRequiredString(o,"firstNameTh",{maxLength:150}),lastNameTh:readRequiredString(o,"lastNameTh",{maxLength:150}),
  firstNameEn:readOptionalString(o,"firstNameEn",{maxLength:150}),lastNameEn:readOptionalString(o,"lastNameEn",{maxLength:150}),
  birthDate:date(o,"birthDate"),hireDate:date(o,"hireDate"),telephone:readOptionalString(o,"telephone",{maxLength:30}),
  email:readOptionalString(o,"email",{maxLength:255}),employmentStatus:status(o.employmentStatus,"ACTIVE")});
export const parseUpdateEmployee=(o:InputObject):UpdateEmployeeInput=>{const u:UpdateEmployeeInput={};
  if(own(o,"companyId"))u.companyId=readPositiveId(o.companyId,"companyId");if(own(o,"employeeCode"))u.employeeCode=readRequiredString(o,"employeeCode",{maxLength:50}).toUpperCase();if(own(o,"userId"))u.userId=readRequiredString(o,"userId",{maxLength:50});
  for(const k of ["functionId","divisionId","departmentId","sectionId","positionId","levelId"] as const)if(own(o,k))u[k]=optionalId(o,k);if(own(o,"nationalId"))u.nationalId=national(o);
  if(own(o,"titleTh"))u.titleTh=thaiTitle(o);for(const k of ["titleEn","firstNameEn","lastNameEn","telephone","email"] as const)if(own(o,k))u[k]=readOptionalString(o,k,{maxLength:k==="telephone"?30:k.startsWith("title")?50:k==="email"?255:150});
  for(const k of ["firstNameTh","lastNameTh"] as const)if(own(o,k))u[k]=readRequiredString(o,k,{maxLength:150});
  for(const k of ["birthDate","hireDate"] as const)if(own(o,k))u[k]=date(o,k);if(own(o,"employmentStatus"))u.employmentStatus=status(o.employmentStatus);
  if(!Object.keys(u).length)throw invalid("body","At least one editable field is required");return u};
export const parseEmployeeListFilters=(p:URLSearchParams,page:Pick<EmployeeListFilters,"skip"|"take">):EmployeeListFilters=>{const search=p.get("search")?.trim()||null;const raw=p.get("status");if(search&&search.length>100)throw invalid("search","Search is too long");return{search,status:raw?status(raw):null,...page}};
