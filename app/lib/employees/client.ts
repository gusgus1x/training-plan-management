"use client";
import type { EmployeeInput,EmployeeRecord,UpdateEmployeeInput } from "./types";
type Envelope<T>={ok:true;data:T}|{ok:false;error?:{code?:string;message?:string;details?:{reason?:string}}};export class EmployeeClientError extends Error{constructor(readonly code="EMPLOYEE_REQUEST_FAILED",message="Employee request failed"){super(message)}}
const read=async<T>(r:Response)=>{const b=await r.json().catch(()=>null) as Envelope<T>|null;if(!r.ok||!b||b.ok!==true){const e=b&&b.ok===false?b.error:undefined;const message=e?.details?.reason?`${e.message??"Employee request failed"}: ${e.details.reason}`:e?.message;throw new EmployeeClientError(e?.code,message)}return b.data};const json=(method:string,body:unknown)=>({method,credentials:"include" as const,headers:{"content-type":"application/json"},body:JSON.stringify(body)});
export const listEmployees=async()=>{
  const pageSize=100;
  const fetchPage=async(page:number)=>read<{items:EmployeeRecord[];pagination:{totalPages:number}}>(await fetch(`/api/master-data/employees?page=${page}&pageSize=${pageSize}`,{credentials:"include",cache:"no-store"}));
  const first=await fetchPage(1);
  const items=[...first.items];
  // Sequential, not Promise.all: firing every page at once saturates the DB
  // connection pool once employee count crosses a few thousand, causing
  // page timeouts that fail the whole listing.
  for(let page=2;page<=(first.pagination?.totalPages??1);page++){
    items.push(...(await fetchPage(page)).items);
  }
  return{items};
};
export const createEmployee=async(i:EmployeeInput)=>read<{employee:EmployeeRecord}>(await fetch("/api/master-data/employees",json("POST",i)));
export const updateEmployee=async(id:string,i:UpdateEmployeeInput)=>read<{employee:EmployeeRecord}>(await fetch(`/api/master-data/employees/${id}`,json("PATCH",i)));
export const deleteEmployee=async(id:string)=>read<{employee:EmployeeRecord}>(await fetch(`/api/master-data/employees/${id}`,{method:"DELETE",credentials:"include"}));
export const revealEmployeeNationalId=async(id:string)=>read<{nationalId:string}>(await fetch(`/api/master-data/employee-national-ids/${id}`,{credentials:"include",cache:"no-store"}));

/** company_id -> the four-digit prefix that company's employee codes carry. */
export const listEmployeeCodePrefixes = async (): Promise<Record<string, string>> => {
  const response = await fetch("/api/master-data/employee-code-prefixes", {
    credentials: "same-origin",
  });
  const body = await response.json();
  if (!response.ok || !body?.ok) return {};
  return body.data?.prefixes ?? {};
};
