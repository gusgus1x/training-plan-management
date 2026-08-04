"use client";
import type { EmployeeInput,EmployeeRecord,UpdateEmployeeInput } from "./types";
type Envelope<T>={ok:true;data:T}|{ok:false;error?:{code?:string;message?:string;details?:{reason?:string}}};export class EmployeeClientError extends Error{constructor(readonly code="EMPLOYEE_REQUEST_FAILED",message="Employee request failed"){super(message)}}
const read=async<T>(r:Response)=>{const b=await r.json().catch(()=>null) as Envelope<T>|null;if(!r.ok||!b||b.ok!==true){const e=b&&b.ok===false?b.error:undefined;const message=e?.details?.reason?`${e.message??"Employee request failed"}: ${e.details.reason}`:e?.message;throw new EmployeeClientError(e?.code,message)}return b.data};const json=(method:string,body:unknown)=>({method,credentials:"include" as const,headers:{"content-type":"application/json"},body:JSON.stringify(body)});
export const listEmployees=async()=>read<{items:EmployeeRecord[]}>(await fetch("/api/master-data/employees?page=1&pageSize=100",{credentials:"include",cache:"no-store"}));
export const createEmployee=async(i:EmployeeInput)=>read<{employee:EmployeeRecord}>(await fetch("/api/master-data/employees",json("POST",i)));
export const updateEmployee=async(id:string,i:UpdateEmployeeInput)=>read<{employee:EmployeeRecord}>(await fetch(`/api/master-data/employees/${id}`,json("PATCH",i)));
export const deleteEmployee=async(id:string)=>read<{employee:EmployeeRecord}>(await fetch(`/api/master-data/employees/${id}`,{method:"DELETE",credentials:"include"}));
export const revealEmployeeNationalId=async(id:string)=>read<{nationalId:string}>(await fetch(`/api/master-data/employee-national-ids/${id}`,{credentials:"include",cache:"no-store"}));
