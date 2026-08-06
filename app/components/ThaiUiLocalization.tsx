"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";

export type UiLanguage = "en" | "th";

type UiLanguageContextValue = {
  language: UiLanguage;
  setLanguage: (language: UiLanguage) => void;
};

const UI_LANGUAGE_STORAGE_KEY = "attg-ui-language";
const UI_LANGUAGE_CHANGE_EVENT = "attg-ui-language-change";
let inMemoryLanguage: UiLanguage = "th";

const readUiLanguage = (): UiLanguage => {
  if (typeof window === "undefined") {
    return "th";
  }

  try {
    const savedLanguage = window.localStorage.getItem(UI_LANGUAGE_STORAGE_KEY);

    if (savedLanguage === "en" || savedLanguage === "th") {
      inMemoryLanguage = savedLanguage;
    } else {
      window.localStorage.setItem(UI_LANGUAGE_STORAGE_KEY, "th");
      inMemoryLanguage = "th";
    }
  } catch {
    inMemoryLanguage = "th";
  }

  return inMemoryLanguage;
};

const subscribeToUiLanguage = (onStoreChange: () => void) => {
  const handleStorage = (event: StorageEvent) => {
    if (event.key === UI_LANGUAGE_STORAGE_KEY) {
      onStoreChange();
    }
  };

  window.addEventListener("storage", handleStorage);
  window.addEventListener(UI_LANGUAGE_CHANGE_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(UI_LANGUAGE_CHANGE_EVENT, onStoreChange);
  };
};

const UiLanguageContext = createContext<UiLanguageContextValue>({
  language: "th",
  setLanguage: () => undefined,
});

export const useUiLanguage = () => useContext(UiLanguageContext);

const thaiUiDictionary: Record<string, string> = {
  "0 completed courses": "0 หลักสูตรที่เสร็จสิ้น",
  "30-Day Follow-up": "ติดตามผลหลัง 30 วัน",
  Absent: "ขาด",
  Accepted: "รับแล้ว",
  Action: "การดำเนินการ",
  Actions: "การดำเนินการ",
  Actual: "ข้อมูลจริง",
  "Actual Attendees": "ผู้เข้าอบรมจริง",
  "Actual Cost": "ค่าใช้จ่ายจริง",
  "Add module record": "เพิ่มรายการโมดูล",
  "Add question": "เพิ่มคำถาม",
  Add: "เพิ่ม",
  "After Training": "หลังการอบรม",
  "All comp code": "รหัสบริษัททั้งหมด",
  "All Companies": "ทุกบริษัท",
  "All Completed Training Files": "ไฟล์ประวัติการอบรมที่เสร็จสิ้นทั้งหมด",
  "All status": "ทุกสถานะ",
  "Annual plan list": "รายการแผนประจำปี",
  "Approved training need": "คำขอฝึกอบรมที่อนุมัติแล้ว",
  Approve: "อนุมัติ",
  "Assessment Code": "รหัสแบบทดสอบ",
  "Assessment detail": "รายละเอียดแบบทดสอบ",
  "Assessment Flow": "ลำดับการทำแบบทดสอบ",
  "Assessment Name": "ชื่อแบบทดสอบ",
  "Attached files": "ไฟล์แนบ",
  Attachments: "ไฟล์แนบ",
  Attend: "เข้าร่วม",
  "Attendance Check": "ตรวจสอบการเข้าอบรม",
  Authentication: "การยืนยันตัวตน",
  "Available Courses": "หลักสูตรที่เปิดให้ลงทะเบียน",
  "Based On Training Record": "อ้างอิงจากประวัติการอบรม",
  Batch: "รุ่น",
  "Before Training": "ก่อนการอบรม",
  Birthday: "วันเกิด",
  Budget: "งบประมาณ",
  Cancel: "ยกเลิก",
  "Cancel Plan": "ยกเลิกแผน",
  Capacity: "จำนวนที่รับ",
  Center: "ส่วนกลาง",
  "Center permission: center requests": "สิทธิ์ส่วนกลาง: คำขอของส่วนกลาง",
  Central: "ส่วนกลาง",
  "Certificate No.": "เลขที่ใบรับรอง",
  "Check List Level": "เลือกระดับเป้าหมาย",
  "Check List Position": "เลือกตำแหน่งเป้าหมาย",
  "Checking your session...": "กำลังตรวจสอบเซสชัน...",
  Choice: "ตัวเลือก",
  "Choose an owner first, then select a course to record actual attendance and training expenses.":
    "เลือกผู้รับผิดชอบก่อน จากนั้นเลือกหลักสูตรเพื่อบันทึกการเข้าอบรมและค่าใช้จ่ายจริง",
  "Clear all": "ล้างทั้งหมด",
  "Clear Data": "ล้างข้อมูล",
  Close: "ปิด",
  Code: "รหัส",
  "Comp Code": "รหัสบริษัท",
  "Comp Name (EN)": "ชื่อบริษัท (อังกฤษ)",
  "Comp Name (TH)": "ชื่อบริษัท (ไทย)",
  Company: "บริษัท",
  "Completed Course": "หลักสูตรที่เรียนจบ",
  "Completed History": "ประวัติการอบรมที่จบแล้ว",
  "Completed Hours": "ชั่วโมงอบรมสะสม",
  Compose: "ร่างรายงาน",
  Confirm: "ยืนยัน",
  "Cost Breakdown": "รายละเอียดค่าใช้จ่าย",
  "Course Code": "รหัสหลักสูตร",
  "Course detail": "รายละเอียดหลักสูตร",
  "Course detail from Course Master": "รายละเอียดจากฐานข้อมูลหลักสูตร",
  "Course Group": "กลุ่มหลักสูตร",
  "Course list": "รายการหลักสูตร",
  "Course Name": "ชื่อหลักสูตร",
  "Course Name (TH)": "ชื่อหลักสูตร (ไทย)",
  "Course Needed": "หลักสูตรที่ต้องการ",
  "Course overview": "ภาพรวมหลักสูตร",
  "Course Owner": "ผู้ดูแลหลักสูตร",
  "Course participant list": "รายชื่อผู้เข้าอบรม",
  "Course Record": "บันทึกหลักสูตร",
  "Course Selection": "เลือกหลักสูตร",
  "Course Sequence": "ลำดับหลักสูตร",
  "Course Setup": "ตั้งค่าหลักสูตร",
  "Course Master & Standard": "ฐานข้อมูลและมาตรฐานหลักสูตร",
  "Course database and standards": "ฐานข้อมูลและมาตรฐานหลักสูตร",
  "Course workflow": "ขั้นตอนการจัดทำหลักสูตร",
  "Course Standard": "มาตรฐานหลักสูตร",
  "Course Standard target": "กลุ่มเป้าหมายตามมาตรฐานหลักสูตร",
  "Course Type": "ประเภทหลักสูตร",
  "Course type library": "รายการประเภทหลักสูตร",
  "Create an active Course Master first": "กรุณาสร้างหลักสูตรที่เปิดใช้งานก่อน",
  "Create courses and define training standards in one workspace.":
    "สร้างหลักสูตรและกำหนดมาตรฐานการฝึกอบรมในพื้นที่ทำงานเดียว",
  "Create the course and define its training standard in one form.":
    "สร้างข้อมูลหลักสูตรและกำหนดมาตรฐานการอบรมในฟอร์มเดียว",
  "Select course owner to open this survey": "กรุณาเลือกผู้ดูแลหลักสูตรเพื่อเปิดแบบสำรวจ",
  "Select a course to open this survey": "กรุณาเลือกหลักสูตรเพื่อเปิดแบบสำรวจ",
  "View all companies / approve factory submissions":
    "ดูทุกบริษัท / อนุมัติข้อมูลที่โรงงานส่งมา",
  "Course Standard target group": "กลุ่มเป้าหมายตามมาตรฐานหลักสูตร",
  "Course Standard auto target": "เป้าหมายตามมาตรฐานหลักสูตรอัตโนมัติ",
  "Out-of-target group": "กลุ่มเป้าหมายนอกเหนือมาตรฐานหลักสูตร",
  "Add employees outside target group": "เพิ่มพนักงานนอกกลุ่มเป้าหมาย",
  "Training Participants": "รายชื่อผู้เข้าร่วมอบรม",
  "Accepted participants list": "รายชื่อผู้ได้รับการยืนยันเข้าอบรม",
  "Employee acceptance list": "รายการการตอบรับรายชื่อพนักงาน",
  "Candidate approval": "การอนุมัติรายชื่อผู้สมัคร",
  "Factory course applicants": "ผู้สมัครอบรมของโรงงาน",
  "Factory acceptance list": "รายการตอบรับของโรงงาน",
  "No factory submissions": "ยังไม่มีรายการที่โรงงานส่งมา",
  "No applicants": "ยังไม่มีผู้สมัคร",
  "Factory submitted employees will appear here before they become training participants.":
    "รายชื่อพนักงานที่โรงงานส่งมาจะแสดงที่นี่ก่อนการยืนยันเข้าร่วมอบรม",
  "Submitted employees for this factory-owned course will appear here before acceptance.":
    "รายชื่อผู้สมัครสำหรับหลักสูตรของโรงงานจะแสดงที่นี่ก่อนการรับเข้าอบรม",
  "Unsaved training participants": "มีรายชื่อผู้เข้าร่วมอบรมที่ยังไม่ได้บันทึก",
  "Unsaved submitted employees": "มีรายชื่อพนักงานที่ยังไม่ได้บันทึก",
  "Saved participants successfully": "บันทึกรายชื่อผู้เข้าร่วมอบรมเรียบร้อยแล้ว",
  "Export Attendance": "ส่งออกใบลงชื่อ",
  Create: "สร้าง",
  "Created By": "สร้างโดย",
  "Current access": "สิทธิ์การเข้าถึงปัจจุบัน",
  "Current User": "ผู้ใช้ปัจจุบัน",
  "Current month": "เดือนปัจจุบัน",
  "Data Setup": "ตั้งค่าข้อมูล",
  Date: "วันที่",
  Delete: "ลบ",
  Department: "แผนก",
  Detail: "รายละเอียด",
  Details: "รายละเอียด",
  Done: "เสร็จแล้ว",
  Down: "ลง",
  Download: "ดาวน์โหลด",
  "Download by person or export all evaluation forms.":
    "ดาวน์โหลดรายบุคคลหรือส่งออกแบบประเมินทั้งหมด",
  "Download full training record": "ดาวน์โหลดประวัติการอบรมฉบับเต็ม",
  Draft: "ฉบับร่าง",
  Due: "กำหนด",
  Edit: "แก้ไข",
  "Edit schedule": "แก้ไขกำหนดการ",
  Education: "การศึกษา",
  "Emp Code": "รหัสพนักงาน",
  Employee: "พนักงาน",
  "Employee ID": "รหัสพนักงาน",
  "Employee inbox": "กล่องคำขอจากพนักงาน",
  "Employee Profile": "ข้อมูลพนักงาน",
  "End Date": "วันที่สิ้นสุด",
  "End Time": "เวลาสิ้นสุด",
  Evaluation: "แบบประเมิน",
  "Evaluation After 30 Day": "แบบประเมินหลัง 30 วัน",
  "Evaluation After 30 Days": "แบบประเมินหลัง 30 วัน",
  "Evaluation After Training": "แบบประเมินหลังอบรม",
  "Evaluation Download by Company / Person": "ดาวน์โหลดแบบประเมินแยกบริษัท / บุคคล",
  "Evaluation Form": "แบบประเมิน",
  "Evaluation form settings": "ตั้งค่าแบบประเมิน",
  "Evaluation Name": "ชื่อแบบประเมิน",
  "Evidence Note": "หมายเหตุหลักฐาน",
  "Excel export file": "ไฟล์ส่งออก Excel",
  "Excel Import": "นำเข้า Excel",
  Export: "ส่งออก",
  "Expected Benefit": "ประโยชน์ที่คาดว่าจะได้รับ",
  "Expense/Person": "ค่าใช้จ่าย/คน",
  Factory: "โรงงาน",
  Files: "ไฟล์",
  "First Name": "ชื่อ",
  From: "จาก",
  Function: "หน่วยงาน",
  "Function Code": "รหัสหน่วยงาน",
  "Function Name": "ชื่อหน่วยงาน",
  "Function Name(EN)": "ชื่อหน่วยงาน (อังกฤษ)",
  "Function Name(TH)": "ชื่อหน่วยงาน (ไทย)",
  "Function(EN)": "หน่วยงาน (อังกฤษ)",
  "Function(TH)": "หน่วยงาน (ไทย)",
  Group: "กลุ่ม",
  "Group ID": "รหัสกลุ่ม",
  "Group No.": "รุ่นที่",
  Hide: "ซ่อน",
  "Hide the respondent identity in evaluation results.":
    "ซ่อนตัวตนของผู้ตอบในผลการประเมิน",
  History: "ประวัติ",
  "History / Queue": "ประวัติ / คิวงาน",
  Hours: "ชั่วโมง",
  "ID Card": "เลขบัตรประชาชน",
  "Import completed training records": "นำเข้าประวัติการอบรมที่เสร็จสิ้น",
  Import: "นำเข้า",
  Inactive: "ไม่ใช้งาน",
  Institute: "สถาบัน",
  "Institute / Provider": "สถาบัน / ผู้ให้บริการ",
  Instructor: "วิทยากร",
  "Job Status": "สถานะงาน",
  "Last Name": "นามสกุล",
  "Last Updated": "อัปเดตล่าสุด",
  "Learning Content": "หัวข้อการเรียนรู้",
  "Level Code(EN)": "รหัสระดับ (อังกฤษ)",
  "Level Code(TH)": "รหัสระดับ (ไทย)",
  "Level Key": "คีย์ระดับ",
  "Level Name(EN)": "ชื่อระดับ (อังกฤษ)",
  "Level Name(TH)": "ชื่อระดับ (ไทย)",
  Location: "สถานที่",
  "Log Date": "วันที่บันทึก",
  Manager: "ผู้จัดการ",
  Match: "ความตรงกัน",
  "Matched Profile": "โปรไฟล์ที่ตรงกัน",
  Message: "ข้อความ",
  Methodology: "วิธีการอบรม",
  Mode: "รูปแบบ",
  Month: "เดือน",
  "Monthly calendar": "ปฏิทินรายเดือน",
  "Monthly view": "มุมมองรายเดือน",
  "Most attendees did not pass before training.":
    "ผู้เข้าอบรมส่วนใหญ่ยังไม่ผ่านก่อนการอบรม",
  "Mr.": "นาย",
  "Mrs.": "นาง",
  "Ms.": "นางสาว",
  "My Requests": "คำขอของฉัน",
  Name: "ชื่อ",
  "Name(EN)": "ชื่อ (อังกฤษ)",
  "Name(TH)": "ชื่อ (ไทย)",
  New: "เพิ่ม",
  "New annual plan": "เพิ่มแผนประจำปี",
  "New monthly plan": "เพิ่มแผนรายเดือน",
  "No approved participants yet.": "ยังไม่มีผู้เข้าอบรมที่ได้รับอนุมัติ",
  "No attachment selected.": "ยังไม่ได้เลือกไฟล์แนบ",
  "No company data found.": "ไม่พบข้อมูลบริษัท",
  "No completed training record found.": "ไม่พบประวัติการอบรมที่เสร็จสิ้น",
  "No course type found": "ไม่พบประเภทหลักสูตร",
  "No employee data found for this company.": "ไม่พบข้อมูลพนักงานของบริษัทนี้",
  "No employee training request found.": "ไม่พบคำขอฝึกอบรมจากพนักงาน",
  "No employees match the selected target filter.": "ไม่มีพนักงานตรงตามตัวกรองกลุ่มเป้าหมาย",
  "No employees shown for this company.": "ไม่มีพนักงานที่แสดงสำหรับบริษัทนี้",
  "No employees submitted to Center yet.": "ยังไม่มีรายชื่อส่งมายังส่วนกลาง",
  "No files attached.": "ไม่มีไฟล์แนบ",
  "No function data found.": "ไม่พบข้อมูลหน่วยงาน",
  "No instructor data found.": "ไม่พบข้อมูลวิทยากร",
  "No level data found.": "ไม่พบข้อมูลระดับ",
  "No position data found.": "ไม่พบข้อมูลตำแหน่ง",
  "No questions added yet.": "ยังไม่มีคำถาม",
  "No report found.": "ไม่พบรายงาน",
  "No report history found.": "ไม่พบประวัติรายงาน",
  "No target courses in this group.": "ไม่พบหลักสูตรเป้าหมายในกลุ่มนี้",
  "No training plans found": "ไม่พบแผนการอบรม",
  "No.": "ลำดับ",
  Objective: "วัตถุประสงค์การเรียนรู้",
  Online: "ออนไลน์",
  Open: "เปิด",
  Owner: "ผู้รับผิดชอบ",
  "Owner / Scope": "ผู้รับผิดชอบ / ขอบเขต",
  Participants: "ผู้เข้าอบรม",
  "Participants / Group": "ผู้เข้าอบรม / รุ่น",
  Pass: "ผ่าน",
  "Pass rate after course completion.": "อัตราการผ่านหลังจบหลักสูตร",
  "Pass Score": "คะแนนผ่าน",
  Password: "รหัสผ่าน",
  "Pending Requests": "คำขอที่รอดำเนินการ",
  Person: "บุคคล",
  Place: "สถานที่",
  Planned: "วางแผนแล้ว",
  Planning: "กำลังวางแผน",
  "Position / Level": "ตำแหน่ง / ระดับ",
  "Position Code": "รหัสตำแหน่ง",
  "Position Name": "ชื่อตำแหน่ง",
  "Position Name(EN)": "ชื่อตำแหน่ง (อังกฤษ)",
  "Position Name(TH)": "ชื่อตำแหน่ง (ไทย)",
  Positions: "ตำแหน่ง",
  "Post Test": "แบบทดสอบหลังอบรม",
  "Pre Test": "แบบทดสอบก่อนอบรม",
  "Preferred Month": "เดือนที่ต้องการ",
  Prefix: "คำนำหน้า",
  Prepare: "เตรียมส่ง",
  Preview: "ดูตัวอย่าง",
  "Preview Request": "ตรวจสอบคำขอ",
  "Previous Training": "ประวัติการอบรมก่อนหน้า",
  Priority: "ความสำคัญ",
  Profile: "ข้อมูลผู้ใช้",
  Provider: "ผู้ให้บริการ",
  Published: "เผยแพร่แล้ว",
  "Published forms": "แบบฟอร์มที่เผยแพร่แล้ว",
  Publish: "เผยแพร่",
  Questions: "คำถาม",
  Rating: "ระดับคะแนน",
  Ready: "พร้อม",
  Recipient: "ผู้รับ",
  Records: "รายการ",
  Refresh: "รีเฟรช",
  Registered: "ลงทะเบียนแล้ว",
  "Related Company": "บริษัทที่เกี่ยวข้อง",
  Remark: "หมายเหตุ",
  "Remark.": "หมายเหตุ",
  Report: "รายงาน",
  "Request No.": "เลขที่คำขอ",
  "Request Reason": "เหตุผลที่ขอ",
  Reject: "ปฏิเสธ",
  Remove: "นำออก",
  Reset: "รีเซ็ต",
  Save: "บันทึก",
  Respondent: "ผู้ตอบ",
  "Response identity": "การแสดงตัวตนผู้ตอบ",
  Result: "ผลลัพธ์",
  Room: "ห้อง",
  Round: "รอบ",
  "Save Draft": "บันทึกร่าง",
  Scope: "ขอบเขต",
  Score: "คะแนน",
  Search: "ค้นหา",
  Seats: "ที่นั่ง",
  "Select Course Group": "เลือกกลุ่มหลักสูตร",
  "Select Course Owner": "เลือกผู้ดูแลหลักสูตร",
  "Select Course Type": "เลือกประเภทหลักสูตร",
  "Select owner": "เลือกผู้รับผิดชอบ",
  "Select owner first": "เลือกผู้รับผิดชอบก่อน",
  Select: "เลือก",
  "Send Date": "วันที่ส่ง",
  "Send Report": "ส่งรายงาน",
  "Send To": "ส่งถึง",
  Sent: "ส่งแล้ว",
  "Seq.": "ลำดับ",
  "Sign in": "เข้าสู่ระบบ",
  "Single Choice": "เลือกได้หนึ่งข้อ",
  Source: "แหล่งที่มา",
  "Start Date": "วันที่เริ่ม",
  "Start Time": "เวลาเริ่ม",
  Status: "สถานะ",
  Subject: "หัวข้อข้อความ",
  Submit: "ส่งข้อมูล",
  Submitted: "วันที่ส่งคำขอ",
  "Submitted to Center": "ส่งไปยังส่วนกลางแล้ว",
  "Target Companies": "บริษัทเป้าหมาย",
  "Target Found": "กลุ่มเป้าหมายที่พบ",
  "Target Functions": "หน่วยงานเป้าหมาย",
  "Target Group": "กลุ่มผู้เข้าอบรม",
  "Target Levels": "ระดับเป้าหมาย",
  "Target Positions": "ตำแหน่งเป้าหมาย",
  Telephone: "โทรศัพท์",
  "Test access": "ทดสอบเข้าใช้งาน",
  Text: "ข้อความ",
  Time: "เวลา",
  Timing: "ช่วงเวลา",
  "Title(EN)": "คำนำหน้า (อังกฤษ)",
  "Title(TH)": "คำนำหน้า (ไทย)",
  To: "ถึง",
  Total: "รวม",
  "Total Actual Cost": "ค่าใช้จ่ายจริงรวม",
  Trainer: "วิทยากร",
  "Trainer Name": "ชื่อวิทยากร",
  "Training Date": "วันที่อบรม",
  "Training Expenses": "ค่าใช้จ่ายการอบรม",
  "Training Hour": "ชั่วโมงอบรม",
  "Training Hours": "ชั่วโมงอบรม",
  "Training list": "รายการอบรม",
  "Training participants": "ผู้เข้าอบรม",
  "Training Place": "สถานที่อบรม",
  "Training Records": "ประวัติการอบรม",
  "Training Requests": "คำขอฝึกอบรม",
  "Try a different keyword or add a new course type.":
    "ลองใช้คำค้นอื่นหรือเพิ่มประเภทหลักสูตรใหม่",
  "Try changing the search text or status filter.":
    "ลองเปลี่ยนคำค้นหรือตัวกรองสถานะ",
  Type: "ประเภท",
  Update: "อัปเดต",
  Up: "ขึ้น",
  Upload: "อัปโหลด",
  Username: "ชื่อผู้ใช้",
  View: "ดู",
  "Walk-in": "เข้าร่วมหน้างาน",
  Workday: "วันที่เริ่มงาน",
  Year: "ปี",
  "A leading Aluminium casting partner of global OEMs in Thailand and ASEAN.":
    "พันธมิตรชั้นนำด้านงานหล่ออะลูมิเนียมสำหรับผู้ผลิตระดับโลกในไทยและอาเซียน",
  "A leading Iron casting partner of global OEMs in Thailand and ASEAN.":
    "พันธมิตรชั้นนำด้านงานหล่อเหล็กสำหรับผู้ผลิตระดับโลกในไทยและอาเซียน",
  "Open center management workspace": "เข้าสู่พื้นที่จัดการส่วนกลาง",
  "Open factory management workspace": "เข้าสู่พื้นที่จัดการโรงงาน",
  "Open user dashboard without password": "เข้าสู่หน้าพนักงานโดยไม่ใช้รหัสผ่าน",
  "Select a course from your training record": "เลือกหลักสูตรจากประวัติการอบรม",
  "Select a report to view details.": "เลือกรายงานเพื่อดูรายละเอียด",
  "No completed course available": "ยังไม่มีหลักสูตรที่เสร็จสิ้น",
  "No published Rolling course is available for this owner.":
    "ยังไม่มีหลักสูตร Rolling ที่เผยแพร่สำหรับผู้รับผิดชอบนี้",
  "Open Training Rolling and click Publish, then the course will appear here automatically.":
    "ไปที่ Training Rolling แล้วกดเผยแพร่ จากนั้นหลักสูตรจะแสดงที่นี่อัตโนมัติ",
  "No training record available to export.": "ไม่มีประวัติการอบรมสำหรับส่งออก",
  "Assessment deleted.": "ลบแบบทดสอบแล้ว",
  "Assessment data refreshed from browser storage.":
    "โหลดข้อมูลแบบทดสอบล่าสุดแล้ว",
  "All Assessment data cleared.": "ล้างข้อมูลแบบทดสอบทั้งหมดแล้ว",
  "There are no assessments to export.": "ไม่มีแบบทดสอบสำหรับส่งออก",
  "Question updated.": "แก้ไขคำถามแล้ว",
  "Question added.": "เพิ่มคำถามแล้ว",
  "Question removed.": "ลบคำถามแล้ว",
  "Please correct the highlighted fields.": "กรุณาแก้ไขช่องที่ระบุ",
  "Assessment updated.": "แก้ไขแบบทดสอบแล้ว",
  "Assessment created.": "สร้างแบบทดสอบแล้ว",
  "Evaluation duplicated as a new draft.": "คัดลอกแบบประเมินเป็นฉบับร่างใหม่แล้ว",
  "Evaluation deleted.": "ลบแบบประเมินแล้ว",
  "Evaluation data refreshed from browser storage.":
    "โหลดข้อมูลแบบประเมินล่าสุดแล้ว",
  "All Evaluation Management data cleared.": "ล้างข้อมูลแบบประเมินทั้งหมดแล้ว",
  "There are no evaluations to export.": "ไม่มีแบบประเมินสำหรับส่งออก",
  "Evaluation updated.": "แก้ไขแบบประเมินแล้ว",
  "Evaluation created.": "สร้างแบบประเมินแล้ว",
  "Changes saved.": "บันทึกการเปลี่ยนแปลงแล้ว",
  "Unable to save participants.": "ไม่สามารถบันทึกผู้เข้าอบรมได้",
  "Export attendance sheet": "ส่งออกใบเช็กชื่อ",
  "Save participant list before exporting.": "บันทึกรายชื่อผู้เข้าอบรมก่อนส่งออก",
  "Add and save at least one participant before exporting.":
    "เพิ่มและบันทึกผู้เข้าอบรมอย่างน้อย 1 คนก่อนส่งออก",
  "Attendance sheet exported.": "ส่งออกใบเช็กชื่อแล้ว",
  "Unable to export attendance sheet.": "ไม่สามารถส่งออกใบเช็กชื่อได้",
  "Budget, expense & attendance overview": "ภาพรวมงบประมาณ ค่าใช้จ่าย และการเข้าอบรม",
  "Financial & Attendance Overview": "ภาพรวมการเงินและการเข้าอบรม",
  "Monitor course budgets, actual spending, remaining funds, and completed training attendance in one place.":
    "ติดตามงบหลักสูตร ค่าใช้จ่ายจริง งบคงเหลือ และการเข้าอบรมที่เสร็จสิ้นได้ในหน้าเดียว",
  "Financial overview": "ภาพรวมการเงิน",
  "Course Budget & Expense Summary": "สรุปงบประมาณและค่าใช้จ่ายหลักสูตร",
  "Total Courses": "หลักสูตรทั้งหมด",
  "Total Planned Budget": "งบประมาณตามแผนทั้งหมด",
  "Total Actual Spent": "ค่าใช้จ่ายจริงทั้งหมด",
  "Remaining Budget": "งบประมาณคงเหลือ",
  "Approved course budget": "งบหลักสูตรที่ได้รับอนุมัติ",
  "Saved from Training Actual": "บันทึกจากค่าใช้จ่ายจริงในการอบรม",
  "Budget exceeded": "ใช้งบเกินแผน",
  "Available balance": "ยอดคงเหลือที่ใช้ได้",
  "Budget utilization": "สัดส่วนการใช้งบ",
  "Factory to Center": "งบจากโรงงานสำหรับหลักสูตรส่วนกลาง",
  "Company Budget Share for Center Courses": "ส่วนแบ่งงบบริษัทสำหรับหลักสูตรส่วนกลาง",
  "Center courses submitted by your company and their calculated budget share.":
    "หลักสูตรส่วนกลางที่บริษัทส่งรายชื่อ พร้อมส่วนแบ่งงบประมาณที่คำนวณสำหรับบริษัท",
  "Allocated Company Budget": "งบประมาณที่จัดสรรให้บริษัท",
  "Estimated Actual Share": "ส่วนแบ่งค่าใช้จ่ายจริงโดยประมาณ",
  "Remaining Company Share": "ส่วนแบ่งงบบริษัทคงเหลือ",
  "Center Course": "หลักสูตรส่วนกลาง",
  "Submitted / Approved": "ส่งรายชื่อ / อนุมัติ",
  "Center Budget": "งบส่วนกลาง",
  "Company Budget Share": "ส่วนแบ่งงบบริษัท",
  "Actual Share": "ส่วนแบ่งค่าใช้จ่ายจริง",
  Calculation: "วิธีคำนวณ",
  "Approved employees": "คำนวณจากผู้ที่อนุมัติ",
  "Submitted employees": "คำนวณจากผู้ที่ส่งรายชื่อ",
  "Company scope": "คำนวณจากขอบเขตบริษัท",
  "No company submissions to Center courses were found for this period.":
    "ไม่พบหลักสูตรส่วนกลางที่บริษัทส่งรายชื่อในช่วงเวลานี้",
  "Budget share is calculated from Center-approved employees. If approval is pending, submitted employees or the course company scope is used.":
    "ส่วนแบ่งงบคำนวณจากพนักงานที่ส่วนกลางอนุมัติ หากยังรออนุมัติจะใช้จำนวนผู้ที่ส่งรายชื่อหรือขอบเขตบริษัทของหลักสูตร",
  "Completed training": "การอบรมที่เสร็จสิ้น",
  "Attendance Summary": "สรุปการเข้าอบรม",
  "Course status": "สถานะหลักสูตร",
  "Financial Health": "สถานะการใช้งบ",
  "Within budget": "อยู่ภายในงบ",
  "Over budget": "เกินงบประมาณ",
  "Planned budget is counted once per course group, while actual expenses include all completed sessions.":
    "งบตามแผนนับหนึ่งครั้งต่อกลุ่มหลักสูตร ส่วนค่าใช้จ่ายจริงรวมทุกรอบที่อบรมเสร็จแล้ว",
  "Course breakdown": "รายละเอียดรายหลักสูตร",
  "Budget vs Actual by Course": "งบประมาณเทียบค่าใช้จ่ายจริงรายหลักสูตร",
  "Planned Budget": "งบประมาณตามแผน",
  "Actual Spent": "ค่าใช้จ่ายจริง",
  Remaining: "คงเหลือ",
  "No planned or completed courses are available for this period.":
    "ไม่พบหลักสูตรที่วางแผนหรือดำเนินการเสร็จในช่วงเวลานี้",
  "Composer cleared.": "ล้างข้อมูลการเขียนแล้ว",
  "Loaded selected report.": "โหลดรายงานที่เลือกแล้ว",
  "Loaded selected report into composer.": "โหลดรายงานที่เลือกเข้าสู่แบบฟอร์มแล้ว",
  "Add record": "เพิ่มรายการ",
  "All companies": "ทุกบริษัท",
  "All year": "ทุกปี",
  "All Year": "ทั้งปี",
  "Anonymous responses": "ไม่แสดงชื่อผู้ตอบ",
  "Answer Type": "รูปแบบคำตอบ",
  "Approve & Create Training": "อนุมัติและสร้างรายการอบรม",
  "Assessment Type": "ประเภทแบบทดสอบ",
  "Attach Files": "แนบไฟล์",
  "Build and maintain course classifications, standards, assessments, and evaluation forms from one place.":
    "จัดการประเภทหลักสูตร มาตรฐาน แบบทดสอบ และแบบประเมินได้จากที่เดียว",
  "Cancel question edit": "ยกเลิกการแก้ไขคำถาม",
  Clear: "ล้าง",
  "Company data summary": "สรุปข้อมูลบริษัท",
  "Company:": "บริษัท:",
  "Correct Answer": "คำตอบที่ถูกต้อง",
  Course: "หลักสูตร",
  "Course Name (EN)": "ชื่อหลักสูตร (อังกฤษ)",
  "Course Reference (optional)": "หลักสูตรอ้างอิง (ไม่บังคับ)",
  "Course owner": "ผู้ดูแลหลักสูตร",
  "Course uploaded record details": "รายละเอียดข้อมูลหลักสูตรที่อัปโหลด",
  "Download All Forms": "ดาวน์โหลดแบบฟอร์มทั้งหมด",
  "Download All Records": "ดาวน์โหลดประวัติทั้งหมด",
  "Download Company Forms": "ดาวน์โหลดแบบฟอร์มของบริษัท",
  "Download Form": "ดาวน์โหลดแบบฟอร์ม",
  "Download one file that includes every completed training record, certificate number, learning hours, score, provider, evidence status, and document purpose.":
    "ดาวน์โหลดไฟล์เดียวที่รวมประวัติการอบรม เลขที่ใบรับรอง ชั่วโมงเรียน คะแนน ผู้ให้บริการ สถานะหลักฐาน และวัตถุประสงค์เอกสารทั้งหมด",
  Duplicate: "ทำสำเนา",
  "Employee request preview": "ตัวอย่างคำขอของพนักงาน",
  End: "สิ้นสุด",
  "Evaluation Code": "รหัสแบบประเมิน",
  "Evaluation preview": "ตัวอย่างแบบประเมิน",
  "Export Excel": "ส่งออก Excel",
  Filter: "กรอง",
  "Function scope": "ขอบเขตหน่วยงาน",
  Functions: "หน่วยงาน",
  "Level:": "ระดับ:",
  "Load Selected": "โหลดรายการที่เลือก",
  "Maintain company, function, position, employee, instructor, level, and mapping data for every training workflow.":
    "ดูแลข้อมูลบริษัท หน่วยงาน ตำแหน่ง พนักงาน วิทยากร ระดับ และการเชื่อมโยงสำหรับทุกขั้นตอนการอบรม",
  "Manage training plans, course data, records, and reports across the AISIN TAKAOKA Thailand group.":
    "จัดการแผนอบรม ข้อมูลหลักสูตร ประวัติ และรายงานของกลุ่มบริษัท AISIN TAKAOKA Thailand",
  "Mark Review": "ทำเครื่องหมายว่าตรวจสอบแล้ว",
  "No completed training record yet.": "ยังไม่มีประวัติการอบรมที่เสร็จสิ้น",
  "No published courses in this group.": "ยังไม่มีหลักสูตรที่เผยแพร่ในกลุ่มนี้",
  "No questions yet. Add a question to preview the evaluation form.":
    "ยังไม่มีคำถาม เพิ่มคำถามเพื่อดูตัวอย่างแบบประเมิน",
  "No uploaded Excel record rows are linked with this course yet.":
    "ยังไม่มีข้อมูลจาก Excel ที่เชื่อมกับหลักสูตรนี้",
  Option: "ตัวเลือก",
  "Options are loaded from Assessment and Evaluation Management.":
    "ระบบดึงตัวเลือกจากหน้า Assessment และ Evaluation Management",
  "Post test opens after pre test is completed. Evaluation opens after post test is completed.":
    "แบบทดสอบหลังเรียนจะเปิดเมื่อทำแบบทดสอบก่อนเรียนเสร็จ และแบบประเมินจะเปิดเมื่อทำแบบทดสอบหลังเรียนเสร็จ",
  "Post test": "แบบทดสอบหลังเรียน",
  "Pre test": "แบบทดสอบก่อนเรียน",
  "Prepare Email": "เตรียมอีเมล",
  "Prepare annual training plans, rolling schedules, training needs, and acceptance surveys for the HRD workflow.":
    "จัดเตรียมแผนอบรมประจำปี ตารางอบรมรายเดือน ความต้องการฝึกอบรม และแบบตอบรับสำหรับขั้นตอนงาน HRD",
  Question: "คำถาม",
  "Question Type": "ประเภทคำถาม",
  "Rating uses the standard five-point scale from Strongly disagree to Strongly agree.":
    "การให้คะแนนใช้มาตรฐาน 5 ระดับ ตั้งแต่ไม่เห็นด้วยอย่างยิ่งจนถึงเห็นด้วยอย่างยิ่ง",
  "Record the real cost used for this course.":
    "บันทึกค่าใช้จ่ายจริงของหลักสูตรนี้",
  "Register Training": "ลงทะเบียนอบรม",
  "Required columns: Course Code, Course Title. Optional: Date, Company, Room, Instructor, Actual Attendees, Registered Attendees, scores, and costs.":
    "คอลัมน์ที่จำเป็น: รหัสหลักสูตรและชื่อหลักสูตร ส่วนวันที่ บริษัท ห้อง วิทยากร ผู้เข้าอบรมจริง ผู้ลงทะเบียน คะแนน และค่าใช้จ่ายเป็นข้อมูลไม่บังคับ",
  "Required question": "คำถามบังคับ",
  "Review training schedules, internal reports, and HRD reporting outputs in one workspace.":
    "ตรวจสอบตารางอบรม รายงานภายใน และผลลัพธ์รายงาน HRD ได้ในพื้นที่เดียว",
  "Review your training calendar, register courses, request training needs, and follow your training records.":
    "ตรวจสอบปฏิทินอบรม ลงทะเบียนหลักสูตร ส่งคำขอฝึกอบรม และติดตามประวัติการอบรมของคุณ",
  "Save Imported Courses": "บันทึกหลักสูตรที่นำเข้า",
  "Save Training Actual": "บันทึกผลการอบรมจริง",
  "Save assessment": "บันทึกแบบทดสอบ",
  "Save changes": "บันทึกการเปลี่ยนแปลง",
  "Save course": "บันทึกหลักสูตร",
  "Save evaluation": "บันทึกแบบประเมิน",
  "Search function data": "ค้นหาข้อมูลหน่วยงาน",
  "Search level data": "ค้นหาข้อมูลระดับ",
  "Search position data": "ค้นหาข้อมูลตำแหน่ง",
  Section: "หมวด",
  "Select a completed course first to view training record details.":
    "เลือกหลักสูตรที่เสร็จสิ้นก่อนเพื่อดูรายละเอียดประวัติการอบรม",
  "Select a course first to show training actual details.":
    "เลือกหลักสูตรก่อนเพื่อแสดงรายละเอียดผลการอบรมจริง",
  "Show target group only": "แสดงเฉพาะกลุ่มเป้าหมาย",
  Start: "เริ่มต้น",
  "Submit Training Need": "ส่งคำขอฝึกอบรม",
  "This draft does not have questions yet.": "ฉบับร่างนี้ยังไม่มีคำถาม",
  "Withdraw": "ถอนรายชื่อ",
  "actual attendees": "ผู้เข้าอบรมจริง",
  "are available.": "พร้อมใช้งาน",
  assessments: "แบบทดสอบ",
  attended: "เข้าอบรมแล้ว",
  "completed courses": "หลักสูตรที่เสร็จสิ้น",
  course: "หลักสูตร",
  "courses /": "หลักสูตร /",
  courses: "หลักสูตร",
  evaluations: "แบบประเมิน",
  files: "ไฟล์",
  groups: "กลุ่ม",
  "in view": "ในรายการที่แสดง",
  questions: "คำถาม",
  records: "รายการ",
  "records in view": "รายการที่แสดง",
  reports: "รายงาน",
  rows: "แถว",
  seats: "ที่นั่ง",
  "shown /": "แสดง /",
  standards: "มาตรฐาน",
  submitted: "ส่งแล้ว",
  target: "เป้าหมาย",
  "target /": "เป้าหมาย /",
  "training schedules in": "ตารางอบรมใน",
  types: "ประเภท",
  waiting: "รอดำเนินการ",
  "ATTG TRAINING PLAN MANAGEMENT": "ระบบจัดการแผนฝึกอบรม ATTG",
  "Back to Dashboard": "กลับหน้าหลัก",
  "Back to main dashboard": "กลับไปหน้าหลัก",
  Calendar: "ปฏิทิน",
  "Center Factory": "ส่วนกลางและโรงงาน",
  "Company :": "บริษัท :",
  Classification: "ประเภทและกลุ่มหลักสูตร",
  "Company Data module": "โมดูลข้อมูลบริษัท",
  "Company Records": "รายการบริษัท",
  "Course Group management": "จัดการกลุ่มหลักสูตร",
  "Course Master Records": "รายการหลักสูตร",
  "Course Master management": "จัดการฐานข้อมูลหลักสูตร",
  "Course Standard management": "จัดการมาตรฐานหลักสูตร",
  "Course Standard Records": "รายการมาตรฐานหลักสูตร",
  "Course Type management": "จัดการประเภทหลักสูตร",
  "Set Standard": "กำหนดมาตรฐาน",
  "Save course and standard": "บันทึกหลักสูตรและมาตรฐาน",
  "Saved standards": "มาตรฐานที่บันทึกแล้ว",
  "Saved Course Standard data in the original matrix view.":
    "ข้อมูลมาตรฐานหลักสูตรที่บันทึกแล้วในรูปแบบตารางเดิม",
  "No saved Course Standard records.": "ยังไม่มีรายการมาตรฐานหลักสูตรที่บันทึก",
  "No standard": "ยังไม่ได้กำหนดมาตรฐาน",
  "Not set": "ยังไม่ได้กำหนด",
  "Define the training target together with the course.":
    "กำหนดกลุ่มเป้าหมายการฝึกอบรมพร้อมกับข้อมูลหลักสูตร",
  "Function, Position and Level": "หน่วยงาน ตำแหน่ง และระดับ",
  "Input form": "กรอกข้อมูล",
  "Set up the course, then define its standard.":
    "สร้างข้อมูลหลักสูตร แล้วกำหนดมาตรฐานของหลักสูตรต่อเนื่องในขั้นตอนถัดไป",
  "Course group actions": "การดำเนินการกลุ่มหลักสูตร",
  "Course type actions": "การดำเนินการประเภทหลักสูตร",
  "Current module navigation": "เมนูโมดูลปัจจุบัน",
  "Current workspace": "พื้นที่ทำงานปัจจุบัน",
  "Language selector": "เลือกภาษา",
  "Switch to English": "เปลี่ยนเป็นภาษาอังกฤษ",
  "Switch to Thai": "เปลี่ยนเป็นภาษาไทย",
  "Email Setup": "ตั้งค่าอีเมล",
  "Employee Data module": "โมดูลข้อมูลพนักงาน",
  "Employee Records": "รายการพนักงาน",
  "Employee Training": "การฝึกอบรมพนักงาน",
  "Employee Workspace": "พื้นที่ทำงานพนักงาน",
  "Employee records from": "ข้อมูลพนักงานจาก",
  "Evaluation Management": "จัดการแบบประเมิน",
  "Factory permission:": "สิทธิ์ของโรงงาน:",
  "Factory permission: only courses owned by":
    "สิทธิ์ของโรงงาน: เฉพาะหลักสูตรที่ดูแลโดย",
  "Factory submitted target employees": "พนักงานเป้าหมายที่โรงงานส่งมา",
  "Function Data module": "โมดูลข้อมูลหน่วยงาน",
  "Function Mapping module": "โมดูลเชื่อมโยงหน่วยงาน",
  "Function Records": "รายการหน่วยงาน",
  "HRD Center": "HRD ส่วนกลาง",
  "HRD Factory": "HRD โรงงาน",
  "HRD Training": "การฝึกอบรม HRD",
  "Instructor Data module": "โมดูลข้อมูลวิทยากร",
  "Instructor Records": "รายการวิทยากร",
  "Internal Report Queue": "คิวรายงานภายใน",
  "Internal Report module": "โมดูลรายงานภายใน",
  "Keep Pre/Post Test and Evaluation module":
    "โมดูลจัดเก็บผลทดสอบและแบบประเมิน",
  "Level Data module": "โมดูลข้อมูลระดับ",
  "Level Records": "รายการระดับ",
  "Live preview": "ตัวอย่างแบบเรียลไทม์",
  Logout: "ออกจากระบบ",
  "Main menu": "เมนูหลัก",
  Management: "ระดับบริหาร",
  Management4: "ระดับบริหาร 4",
  "Master Data": "ข้อมูลหลัก",
  "Master Data Management modules": "โมดูลจัดการข้อมูลหลัก",
  "Master List": "รายการข้อมูลหลัก",
  "Master Workspace": "พื้นที่จัดการข้อมูลหลัก",
  "My Training Dashboard": "แดชบอร์ดการอบรมของฉัน",
  "My Training Record": "ประวัติการอบรมของฉัน",
  "Name :": "ชื่อ :",
  Operator: "พนักงานปฏิบัติการ",
  "Plan Setup": "ตั้งค่าแผน",
  "Planning Workspace": "พื้นที่จัดทำแผน",
  "Position Data module": "โมดูลข้อมูลตำแหน่ง",
  "Position Records": "รายการตำแหน่ง",
  "Position:": "ตำแหน่ง:",
  "Pre / Post Test and Evaluation":
    "แบบทดสอบก่อนเรียน หลังเรียน และแบบประเมิน",
  "Pre test / Post test / Evaluation":
    "แบบทดสอบก่อนเรียน / หลังเรียน / แบบประเมิน",
  "Published Rolling Course": "หลักสูตรรายเดือนที่เผยแพร่แล้ว",
  "Question builder": "สร้างคำถาม",
  "Question preview": "ตัวอย่างคำถาม",
  "Record Operation": "งานบันทึกผลการอบรม",
  "Record Workspace": "หน้าบันทึกผลการอบรม",
  "Record actual training, verify employee history, and follow completion evidence across the HRD workflow.":
    "บันทึกผลการอบรมจริง ตรวจสอบประวัติพนักงาน และติดตามหลักฐานการจบอบรมในขั้นตอนงาน HRD",
  "Related employees by company": "พนักงานที่เกี่ยวข้องแยกตามบริษัท",
  "Report Management modules": "โมดูลจัดการรายงาน",
  "Report Operation": "งานรายงานและสรุปผล",
  "Report Setup": "ตั้งค่ารายงาน",
  "Report Workspace": "หน้ารายงาน",
  "Request Training Need": "คำขอฝึกอบรม",
  "Request Training Need module": "โมดูลคำขอฝึกอบรม",
  "Role :": "บทบาท :",
  "Rolling detail": "รายละเอียดแผนรายเดือน",
  "Schedule calendar module": "โมดูลปฏิทินกำหนดการ",
  "Select a workspace": "เลือกเมนูที่ต้องการใช้งาน",
  "Submitted Reports": "รายงานที่ส่งแล้ว",
  Supervisor: "หัวหน้างาน",
  "SurName(TH)": "นามสกุล (ไทย)",
  "Surname(EN)": "นามสกุล (อังกฤษ)",
  "Surname(TH)": "นามสกุล (ไทย)",
  "Survey controls": "การจัดการแบบตอบรับ",
  "Target group": "กลุ่มเป้าหมาย",
  "Test login options": "ตัวเลือกทดสอบการเข้าสู่ระบบ",
  "This form lives in the": "แบบฟอร์มนี้อยู่ในไฟล์",
  "Training Accept Survey module": "โมดูลแบบตอบรับการอบรม",
  "Training Actual module": "โมดูลบันทึกผลการอบรมจริง",
  "Training Calendar": "ปฏิทินการอบรม",
  "Training Course": "หลักสูตรอบรม",
  "Training Course Management modules": "โมดูลจัดการหลักสูตรอบรม",
  "Training Expense module": "โมดูลค่าใช้จ่ายการอบรม",
  "Training OAP annual plan": "แผนการอบรมประจำปี OAP",
  "Training OAP records": "รายการแผน OAP",
  "Training Plan": "แผนการอบรม",
  "Training Plan Management modules": "โมดูลจัดการแผนการอบรม",
  "Training Record": "ประวัติการอบรม",
  "Training Record Details": "รายละเอียดประวัติการอบรม",
  "Training Record Management modules": "โมดูลจัดการประวัติการอบรม",
  "Training Record module": "โมดูลประวัติการอบรม",
  "Training Report": "รายงานการอบรม",
  "Training Rolling monthly plan": "แผนการอบรมรายเดือน",
  "Training Schedule": "กำหนดการอบรม",
  "Training Timeline": "ลำดับเวลาการอบรม",
  "User Operation": "งานของผู้ใช้",
  "User modules": "โมดูลผู้ใช้",
  "Why This Course Appears": "เหตุผลที่แสดงหลักสูตรนี้",
  Workspace: "พื้นที่ทำงาน",
  "Workspace Operation": "เมนูการทำงาน",
  completed: "เสร็จสิ้น",
  "e.g. Safety Basics Pre Test": "เช่น แบบทดสอบก่อนเรียนด้านความปลอดภัย",
  "e.g. Standard Course Evaluation": "เช่น แบบประเมินหลักสูตรมาตรฐาน",
  "factory requests only": "เฉพาะคำขอจากโรงงาน",
  "module file, so page-specific logic can be edited here.":
    "ของโมดูล จึงสามารถแก้ไขตรรกะเฉพาะหน้านี้ได้ที่นี่",
  modules: "โมดูล",
  registration: "การลงทะเบียน",
  roadmap: "แผนพัฒนา",
  "rolling schedule": "กำหนดการรายเดือน",
  schedules: "กำหนดการ",
  shown: "ที่แสดง",
  January: "มกราคม",
  February: "กุมภาพันธ์",
  March: "มีนาคม",
  April: "เมษายน",
  May: "พฤษภาคม",
  June: "มิถุนายน",
  July: "กรกฎาคม",
  August: "สิงหาคม",
  September: "กันยายน",
  October: "ตุลาคม",
  November: "พฤศจิกายน",
  December: "ธันวาคม",
  Mon: "จ.",
  Tue: "อ.",
  Wed: "พ.",
  Thu: "พฤ.",
  Fri: "ศ.",
  Sat: "ส.",
  Sun: "อา.",
  "Development sample data": "ข้อมูลตัวอย่างสำหรับการพัฒนา",
  "What training is available": "มีอบรมอะไรบ้าง",
  "Show monthly training details from Training Rolling data":
    "แสดงรายละเอียดการอบรมรายเดือนจากข้อมูล Training Rolling",
  "Test and evaluation results": "ผลทดสอบและประเมิน",
  "Test and evaluation results by course, company, and date range":
    "รายงานผล Pre/Post Test และ Evaluation แยกตามหลักสูตร บริษัท และช่วงเวลา",
  "Training expense summary": "ค่าใช้จ่ายฝึกอบรม",
  "Training expense summary by course, company, and date range":
    "สรุปรายงานค่าใช้จ่ายฝึกอบรมตามหลักสูตร บริษัท และช่วงเวลา",
  "Map functions to companies": "ผูกหน่วยงานกับบริษัท",
  "Define relationships between companies, functions, and training owners":
    "กำหนดความสัมพันธ์ระหว่างบริษัท หน่วยงาน และผู้รับผิดชอบด้านอบรม",
  "Thai function name": "ชื่อหน่วยงานภาษาไทย",
  "Thai position name": "ชื่อตำแหน่งภาษาไทย",
  Dashboard: "แดชบอร์ด",
  "Training Course Management": "จัดการหลักสูตรอบรม",
  "Training Plan Management": "จัดการแผนการอบรม",
  "Training Record Management": "จัดการประวัติการอบรม",
  "Master Data Management": "จัดการข้อมูลหลัก",
  "Report Management": "จัดการรายงาน",
  Assessment: "แบบทดสอบ",
  "Course Master": "ฐานข้อมูลหลักสูตร",
  "Company Data": "ข้อมูลบริษัท",
  "Employee Data": "ข้อมูลพนักงาน",
  "Function Data": "ข้อมูลหน่วยงาน",
  "Function Mapping": "การเชื่อมโยงหน่วยงาน",
  "Instructor Data": "ข้อมูลวิทยากร",
  "Level Data": "ข้อมูลระดับ",
  "Position Data": "ข้อมูลตำแหน่ง",
  "Training Actual": "ผลการอบรมจริง",
  "Training Accept Survey": "แบบตอบรับการอบรม",
  "Training Expense": "ค่าใช้จ่ายการอบรม",
  "Training OAP": "แผนอบรมประจำปี OAP",
  "Training Rolling": "แผนอบรมรายเดือน",
  "Internal Report": "รายงานภายใน",
  "Schedule calendar": "ปฏิทินกำหนดการ",
  "Keep Pre/Post Test and Evaluation":
    "จัดเก็บผลทดสอบก่อนเรียน หลังเรียน และแบบประเมิน",
  "Actual Attendance": "การเข้าอบรมจริง",
  "Annual training plan": "แผนการอบรมประจำปี",
  "Audience & Requirement": "กลุ่มผู้เรียนและข้อกำหนด",
  "Center Roadmap": "แผนพัฒนาส่วนกลาง",
  "Class Detail": "รายละเอียดการอบรม",
  "Company master": "ข้อมูลหลักบริษัท",
  "Completed Course Records": "ประวัติหลักสูตรที่เสร็จสิ้น",
  "Course Information": "ข้อมูลหลักสูตร",
  "Course category": "หมวดหมู่หลักสูตร",
  "Course database": "ฐานข้อมูลหลักสูตร",
  "Course group": "กลุ่มหลักสูตร",
  "Course standard matrix": "ตารางมาตรฐานหลักสูตร",
  "Employee master": "ข้อมูลหลักพนักงาน",
  "Employee request inbox": "กล่องคำขอจากพนักงาน",
  "Evaluation form": "แบบฟอร์มประเมิน",
  "Factory Roadmap": "แผนพัฒนาโรงงาน",
  "Factory Training": "การอบรมของโรงงาน",
  "Function master": "ข้อมูลหลักหน่วยงาน",
  "Instructor master": "ข้อมูลหลักวิทยากร",
  "Internal communication": "การสื่อสารภายใน",
  Level: "ระดับ",
  "Level master": "ข้อมูลหลักระดับ",
  "Mandatory Center Training": "หลักสูตรบังคับจากส่วนกลาง",
  "Monthly training plan": "แผนการอบรมรายเดือน",
  Position: "ตำแหน่ง",
  "Position master": "ข้อมูลหลักตำแหน่ง",
  "Pre / Post Test": "แบบทดสอบก่อนเรียน / หลังเรียน",
  Reports: "รายงาน",
  "Roadmap Requirement": "ข้อกำหนดตามแผนพัฒนา",
  "Target & approval workflow": "กลุ่มเป้าหมายและขั้นตอนอนุมัติ",
  "This Month": "เดือนนี้",
  "Training schedule": "กำหนดการอบรม",
  "Actual training results, attendance records, and employee history.":
    "ผลการอบรมจริง บันทึกการเข้าอบรม และประวัติของพนักงาน",
  "Annual plans, training needs, acceptance surveys, OAP, and rolling plans.":
    "แผนประจำปี ความต้องการฝึกอบรม แบบตอบรับ แผน OAP และแผนรายเดือน",
  "Build post-training and follow-up evaluation forms for employees and managers.":
    "สร้างแบบประเมินหลังอบรมและแบบติดตามผลสำหรับพนักงานและผู้จัดการ",
  "Center courses are mandatory and controlled by HRD Center.":
    "หลักสูตรส่วนกลางเป็นหลักสูตรบังคับและควบคุมโดย HRD ส่วนกลาง",
  "Check actual attendance, add unregistered attendees, record real training expenses, and save the completed actual record.":
    "ตรวจสอบผู้เข้าอบรมจริง เพิ่มผู้ที่ไม่ได้ลงทะเบียน บันทึกค่าใช้จ่ายจริง และบันทึกผลการอบรมที่เสร็จสิ้น",
  "Companies, employees, instructors, levels, positions, and functions.":
    "บริษัท พนักงาน วิทยากร ระดับ ตำแหน่ง และหน่วยงาน",
  "Convert annual OAP items into monthly rolling training schedules.":
    "แปลงรายการ OAP ประจำปีเป็นกำหนดการอบรมรายเดือน",
  "Course type, course group, master courses, standards, and assessments.":
    "ประเภทหลักสูตร กลุ่มหลักสูตร ฐานข้อมูลหลักสูตร มาตรฐาน และแบบทดสอบ",
  "Courses opened internally by your factory.":
    "หลักสูตรภายในที่เปิดโดยโรงงานของคุณ",
  "Create and maintain course master data for training plans, records, and reports.":
    "สร้างและดูแลฐานข้อมูลหลักสูตรสำหรับแผนอบรม ประวัติ และรายงาน",
  "Create assessment sets and question banks for training courses.":
    "สร้างชุดแบบทดสอบและคลังคำถามสำหรับหลักสูตรอบรม",
  "Define required training by course, function, position, and employee level.":
    "กำหนดหลักสูตรบังคับตามหลักสูตร หน่วยงาน ตำแหน่ง และระดับพนักงาน",
  "Maintain course group master data for course classification and reporting.":
    "ดูแลข้อมูลกลุ่มหลักสูตรสำหรับการจัดหมวดหมู่และรายงาน",
  "Maintain course type master data for Course Master and training planning.":
    "ดูแลข้อมูลประเภทหลักสูตรสำหรับฐานข้อมูลหลักสูตรและการวางแผนอบรม",
  "Maintain employee level codes, PL values, and level keys for training standards.":
    "ดูแลรหัสระดับ ค่า PL และคีย์ระดับพนักงานสำหรับมาตรฐานการอบรม",
  "Maintain employee profile data by company, function, position, and level without PL values.":
    "ดูแลข้อมูลพนักงานตามบริษัท หน่วยงาน ตำแหน่ง และระดับโดยไม่รวมค่า PL",
  "Maintain function codes and bilingual function names for training workflows.":
    "ดูแลรหัสและชื่อหน่วยงานสองภาษาสำหรับขั้นตอนงานอบรม",
  "Maintain instructor contact and education records for training courses.":
    "ดูแลข้อมูลติดต่อและประวัติการศึกษาของวิทยากร",
  "Maintain position codes and bilingual position names for training standards.":
    "ดูแลรหัสและชื่อตำแหน่งสองภาษาสำหรับมาตรฐานการอบรม",
  "Plan annual training courses, budget, trainer, provider, and target participants.":
    "วางแผนหลักสูตรประจำปี งบประมาณ วิทยากร ผู้ให้บริการ และผู้เข้าอบรมเป้าหมาย",
  "Prepare, preview, and send internal training reports to HRD Center, factory HR, management, and related departments.":
    "จัดเตรียม ตรวจสอบ และส่งรายงานอบรมภายในไปยัง HRD ส่วนกลาง HR โรงงาน ผู้บริหาร และหน่วยงานที่เกี่ยวข้อง",
  "Review Course Needed and Request Reason submitted from the employee training request page.":
    "ตรวจสอบหลักสูตรที่ต้องการและเหตุผลจากคำขอฝึกอบรมของพนักงาน",
  "Review completed courses, actual attendees, cost, pre/post test results, evaluation progress, and downloadable training evidence.":
    "ตรวจสอบหลักสูตรที่เสร็จสิ้น ผู้เข้าอบรมจริง ค่าใช้จ่าย ผลทดสอบ ความคืบหน้าแบบประเมิน และหลักฐานการอบรม",
  "Store and maintain company master data.":
    "จัดเก็บและดูแลข้อมูลหลักของบริษัท",
  "Survey target employees from Course Standard, collect factory submissions, and approve training participants.":
    "สำรวจพนักงานเป้าหมายจากมาตรฐานหลักสูตร รวบรวมรายชื่อจากโรงงาน และอนุมัติผู้เข้าอบรม",
  "Target courses assigned by HRD Center or corporate learning teams.":
    "หลักสูตรเป้าหมายที่กำหนดโดย HRD ส่วนกลางหรือทีมพัฒนาบุคลากร",
  "Target courses assigned by factory HR, safety, or local operation teams.":
    "หลักสูตรเป้าหมายที่กำหนดโดย HR โรงงาน ทีมความปลอดภัย หรือทีมปฏิบัติการ",
  "Training schedules, result reports, expenses, and internal reports.":
    "กำหนดการอบรม รายงานผล ค่าใช้จ่าย และรายงานภายใน",
  Accommodation: "ค่าที่พัก",
  "Food & Beverage": "ค่าอาหารและเครื่องดื่ม",
  Material: "ค่าวัสดุ",
  "Seminar Room": "ค่าห้องสัมมนา",
  Traveling: "ค่าเดินทาง",
  "Job application / transfer": "สมัครงาน / โอนย้ายงาน",
  "Resignation document": "เอกสารลาออก",
  "Use this file as a complete training record for resignation documents.":
    "ใช้ไฟล์นี้เป็นประวัติการอบรมฉบับสมบูรณ์สำหรับเอกสารลาออก",
  "Use this file as supporting evidence when applying for or changing jobs.":
    "ใช้ไฟล์นี้เป็นหลักฐานประกอบการสมัครงานหรือเปลี่ยนงาน",
  "ATTG Training plan management": "ระบบจัดการแผนฝึกอบรม ATTG",
  Email: "อีเมล",
  "Employee Code": "รหัสพนักงาน",
  "Course setup guideline": "แนวทางการสร้างหลักสูตร",
  "Complete the required fields from top to bottom before linking tests and evaluations.":
    "กรอกช่องที่จำเป็นจากบนลงล่างให้ครบ ก่อนเชื่อมแบบทดสอบและแบบประเมิน",
  "Required field completion": "ความครบถ้วนของช่องที่จำเป็น",
  "Select the course group to generate the course code.":
    "เลือกกลุ่มหลักสูตร เพื่อให้ระบบออกรหัสหลักสูตร",
  "Enter bilingual names and describe the learning outcome.":
    "กรอกชื่อหลักสูตรไทย-อังกฤษ และระบุผลลัพธ์ที่ผู้เรียนต้องทำได้",
  "Link published tests and evaluations when available.":
    "เชื่อมแบบทดสอบและแบบประเมินที่เผยแพร่ไว้ หากมีให้เลือก",
  "Required field": "จำเป็นต้องกรอก",
  Optional: "ไม่บังคับ",
  "Generated after selecting a course group":
    "ระบบจะสร้างให้หลังเลือกกลุ่มหลักสูตร",
  "Generated automatically from the selected course group.":
    "สร้างจากกลุ่มหลักสูตรที่เลือกโดยอัตโนมัติ",
  "Example: หลักสูตรความปลอดภัยพื้นฐาน":
    "ตัวอย่าง: หลักสูตรความปลอดภัยพื้นฐาน",
  "Example: Safety Basics": "ตัวอย่าง: ความปลอดภัยพื้นฐาน",
  "Controls course classification and the generated course code.":
    "ใช้จัดประเภทหลักสูตรและกำหนดรหัสที่ระบบสร้างให้",
  "Life Cycle (Month)": "อายุหลักสูตร (เดือน)",
  "Example: 12": "ตัวอย่าง: 12",
  "Enter 0 for no course expiration": "ถ้าไม่มีวันหมดอายุให้ใส่ 0",
  "Number of months before the course should be reviewed.":
    "จำนวนเดือนก่อนถึงรอบทบทวนหลักสูตรครั้งถัดไป",
  "Describe what learners should achieve after completing the course.":
    "ระบุสิ่งที่ผู้เรียนต้องทำได้หลังจบหลักสูตร",
  "Use a measurable outcome, for example “Explain and apply the five safety rules.”":
    "เขียนเป็นผลลัพธ์ที่วัดได้ เช่น “อธิบายและนำกฎความปลอดภัย 5 ข้อไปใช้ได้”",
  "List the main topics, activities, or skills covered by the course.":
    "ระบุหัวข้อ กิจกรรม หรือทักษะหลักที่เรียนในหลักสูตรนี้",
  "Example: Production employees, supervisors, and new hires":
    "ตัวอย่าง: พนักงานฝ่ายผลิต หัวหน้างาน และพนักงานเข้าใหม่",
  "Example: Lecture, workshop, demonstration, and practice":
    "ตัวอย่าง: บรรยาย เวิร์กช็อป สาธิต และฝึกปฏิบัติจริง",
  "Add supporting notes or special conditions.":
    "เพิ่มหมายเหตุหรือเงื่อนไขพิเศษของหลักสูตร",
  "No Pre Test": "ไม่ใช้แบบทดสอบก่อนเรียน",
  "No Post Test": "ไม่ใช้แบบทดสอบหลังเรียน",
  "No Evaluation": "ไม่ใช้แบบประเมิน",
  "No 30-Day Evaluation": "ไม่ใช้แบบประเมินติดตามผล 30 วัน",
  "Manual form link will be used.": "ระบบจะใช้ลิงก์แบบฟอร์มที่ใส่ไว้",
  "Paste pre-test form link": "วางลิงก์แบบทดสอบก่อนเรียน",
  "Paste post-test form link": "วางลิงก์แบบทดสอบหลังเรียน",
  "Paste evaluation form link": "วางลิงก์แบบประเมิน",
  "Paste 30-day evaluation form link": "วางลิงก์แบบประเมินติดตามผล 30 วัน",
  "Training sessions": "รอบการอบรม",
  "Add another session when the course has a different batch, date, time, or location.":
    "เพิ่มรอบใหม่เมื่อหลักสูตรมีรุ่น วันที่ เวลา หรือสถานที่ต่างกัน",
  "Add session": "เพิ่มรอบอบรม",
  "Related Companies": "บริษัทที่เกี่ยวข้อง",
  "Select every company whose employees can join these sessions.":
    "เลือกทุกบริษัทที่พนักงานสามารถเข้าร่วมรอบอบรมเหล่านี้ได้",
  "Please select at least one related company.":
    "กรุณาเลือกบริษัทที่เกี่ยวข้องอย่างน้อย 1 บริษัท",
  "Training Sessions": "รอบการอบรม",
  Sessions: "รอบอบรม",
  "Batches:": "รุ่น:",
  "All published": "เผยแพร่ทั้งหมดแล้ว",
  "Publish all": "เผยแพร่ทั้งหมด",
  "Delete all": "ลบทั้งหมด",
  "Session schedule": "กำหนดการแต่ละรอบ",
  "Edit, publish, or remove each session independently.":
    "แก้ไข เผยแพร่ หรือลบแต่ละรอบได้อย่างอิสระ",
  "Training Session": "รอบการอบรม",
  "Select training session": "เลือกรอบการอบรม",
  "Select course first": "เลือกหลักสูตรก่อน",
  "Summary Dashboard": "แดชบอร์ดสรุปผล",
  "Training attendance overview": "ภาพรวมการเข้าอบรม",
  "View attended and absent participant totals from completed Training Actual records.":
    "ดูจำนวนผู้เข้าอบรมและไม่เข้าอบรมจากข้อมูลการอบรมจริงที่บันทึกเสร็จแล้ว",
  "Completed Training Sessions": "รอบอบรมที่ดำเนินการแล้ว",
  "Training Attendance Summary": "สรุปผลการเข้าอบรม",
  "Recorded Participants": "ผู้เข้าอบรมทั้งหมด",
  Attended: "เข้าอบรม",
  "Did Not Attend": "ไม่เข้าอบรม",
  "Attendance Rate": "อัตราการเข้าอบรม",
  people: "คน",
  "No completed Training Actual records are available yet.":
    "ยังไม่มีข้อมูล Training Actual ที่บันทึกเสร็จแล้ว",
  Locked: "ล็อกอยู่",
  "All months": "ทุกเดือน",
  "Automatic target group": "กลุ่มเป้าหมายอัตโนมัติ",
  "Course Standard target employees": "พนักงานกลุ่มเป้าหมายตาม Course Standard",
  "Automatically matched from position and level in Course Standard.":
    "จับคู่ให้อัตโนมัติจากตำแหน่งและระดับที่กำหนดใน Course Standard",
  "No remaining Course Standard target employees.":
    "ไม่มีพนักงานกลุ่มเป้าหมายตาม Course Standard ที่รอเพิ่ม",
  "Additional employees": "พนักงานเพิ่มเติม",
  "Add employees outside the target group":
    "เพิ่มพนักงานนอกกลุ่มเป้าหมาย",
  "Open this section only when you need to add an employee who does not match the Course Standard position and level.":
    "เปิดส่วนนี้เมื่อต้องการเพิ่มพนักงานที่ตำแหน่งและระดับไม่ตรงกับ Course Standard",
  "No additional employees are available.":
    "ไม่มีพนักงานเพิ่มเติมที่สามารถเพิ่มได้",
  "Manually added outside Course Standard target.":
    "เพิ่มพนักงานนอกกลุ่มเป้าหมาย Course Standard ด้วยตนเอง",
  "Manually accepted outside Course Standard target by factory.":
    "โรงงานเพิ่มพนักงานนอกกลุ่มเป้าหมาย Course Standard ด้วยตนเอง",
  "Manually submitted outside Course Standard target for center approval.":
    "ส่งพนักงานนอกกลุ่มเป้าหมาย Course Standard ให้ส่วนกลางอนุมัติด้วยตนเอง",
  "A personal training passport for completed courses, certificates, scores, and verified learning hours.":
    "สมุดประวัติการอบรมส่วนบุคคลสำหรับหลักสูตรที่เรียนจบ ใบรับรอง คะแนน และชั่วโมงเรียนรู้ที่ตรวจสอบแล้ว",
  Active: "ใช้งาน",
  "Authentication unavailable": "ไม่สามารถยืนยันตัวตนได้",
  Auditorium: "หอประชุม",
  "Center Approved": "ส่วนกลางอนุมัติแล้ว",
  "Center Dashboard": "แดชบอร์ดส่วนกลาง",
  "Center Workspace": "พื้นที่ทำงานส่วนกลาง",
  Confirmed: "ยืนยันแล้ว",
  "Core Skill": "ทักษะหลัก",
  "Courses appear here after HRD confirms and publishes the monthly rolling plan.":
    "หลักสูตรจะแสดงที่นี่หลังจาก HRD ยืนยันและเผยแพร่แผนอบรมรายเดือนแล้ว",
  "Development only": "สำหรับการพัฒนาเท่านั้น",
  "Employee Training Record": "ประวัติการอบรมพนักงาน",
  "Factory Approved": "โรงงานอนุมัติแล้ว",
  "Factory Dashboard": "แดชบอร์ดโรงงาน",
  "Factory Submitted": "โรงงานส่งแล้ว",
  "Factory Workspace": "พื้นที่ทำงานโรงงาน",
  "Hide month list": "ซ่อนรายการของเดือน",
  hours: "ชั่วโมง",
  "HRD Training Center": "การฝึกอบรม HRD ส่วนกลาง",
  "HRD Training Factory": "การฝึกอบรม HRD โรงงาน",
  Mandatory: "หลักสูตรบังคับ",
  "Meeting Room 2": "ห้องประชุม 2",
  "Mock UI Preview": "ตัวอย่างหน้าจอจำลอง",
  "Mock Factory Users · 6 Companies": "ผู้ใช้จำลอง HRD โรงงาน · 6 บริษัท",
  "New Request": "สร้างคำขอใหม่",
  "Pending Approval": "รออนุมัติ",
  "Prepare and send employee training reports by email.":
    "จัดทำและส่งรายงานการอบรมพนักงานทางอีเมล",
  Review: "ตรวจสอบ",
  "Retry session check": "ตรวจสอบเซสชันอีกครั้ง",
  "Return to sign in": "กลับไปหน้าเข้าสู่ระบบ",
  "Select a completed training record, then request follow-up training need to HRD Center.":
    "เลือกประวัติการอบรมที่เสร็จสิ้น แล้วส่งคำขอฝึกอบรมติดตามผลไปยัง HRD ส่วนกลาง",
  "Select an existing instructor or type an external instructor name.":
    "เลือกวิทยากรที่มีอยู่ หรือพิมพ์ชื่อวิทยากรภายนอก",
  "Select from Instructor Master or enter another name":
    "เลือกจากข้อมูลวิทยากร หรือระบุชื่ออื่น",
  "Select function": "เลือกหน่วยงาน",
  "Select level": "เลือกระดับ",
  "Select position": "เลือกตำแหน่ง",
  Session: "รอบอบรม",
  "Show month list": "แสดงรายการของเดือน",
  "Shows courses where this employee is included in the target group by company, function, or position.":
    "แสดงหลักสูตรที่พนักงานอยู่ในกลุ่มเป้าหมายตามบริษัท หน่วยงาน หรือตำแหน่ง",
  "Training Roadmap": "แผนพัฒนาการอบรม",
  "Training Room A": "ห้องอบรม A",
  "Training Room B": "ห้องอบรม B",
  "We could not verify your session.": "ไม่สามารถตรวจสอบเซสชันของคุณได้",
  "/ Batch": "/ รุ่น",
  "/ Batches:": "/ รุ่น:",
  available: "พร้อมเพิ่ม",
  "available /": "พร้อมเพิ่ม /",
  "companies selected": "บริษัทที่เลือก",
  "Function:": "หน่วยงาน:",
  HRD_CENTER: "HRD ส่วนกลาง",
  HRD_FACTORY: "HRD โรงงาน",
  EMPLOYEE: "พนักงาน",
  "MOCK UI PREVIEW": "ตัวอย่างหน้าจอจำลอง",
  "No server session": "ไม่ได้เชื่อมต่อเซสชันเซิร์ฟเวอร์",
  "outside target": "นอกกลุ่มเป้าหมาย",
  "required fields": "ช่องที่จำเป็น",
  Safety: "ความปลอดภัย",
  sessions: "รอบอบรม",
  status: "สถานะ",
  Target: "เป้าหมาย",
  User: "ผู้ใช้",
  "User dashboard": "แดชบอร์ดผู้ใช้",
  "Unable to sign in. Check your username and password.":
    "ไม่สามารถเข้าสู่ระบบได้ โปรดตรวจสอบชื่อผู้ใช้และรหัสผ่าน",
  "Unable to sign out. Please try again.":
    "ไม่สามารถออกจากระบบได้ โปรดลองอีกครั้ง",
  "Unable to verify your session. Check the connection and try again.":
    "ไม่สามารถตรวจสอบเซสชันได้ โปรดตรวจสอบการเชื่อมต่อแล้วลองอีกครั้ง",
  PLAN: "แผน",
  RECORD: "ประวัติ",
  COURSE: "หลักสูตร",
  MASTER: "ข้อมูลหลัก",
  REPORT: "รายงาน",
  Need: "ความต้องการ",
  Record: "ประวัติ",
  Register: "ลงทะเบียน",
  "Register Train": "ลงทะเบียนอบรม",
  Roadmap: "แผนพัฒนา",
  "2 pending": "รอดำเนินการ 2 รายการ",
  "9 hours": "9 ชั่วโมง",
  "Select available courses, submit registration, and let HRD review the request.":
    "เลือกหลักสูตรที่เปิดอยู่ ส่งคำขอลงทะเบียน และรอ HRD ตรวจสอบ",
  "Review the personal development plan and required courses by timeline.":
    "ตรวจสอบแผนพัฒนารายบุคคลและหลักสูตรที่ต้องเรียนตามช่วงเวลา",
  "Submit a new training need to HRD Center for review and approval.":
    "ส่งความต้องการฝึกอบรมใหม่ให้ HRD ส่วนกลางตรวจสอบและอนุมัติ",
  "Check training history, accumulated hours, course results, and evidence status.":
    "ตรวจสอบประวัติการอบรม ชั่วโมงสะสม ผลหลักสูตร และสถานะหลักฐาน",
  "Prepare and review employee training reports for HRD follow-up.":
    "จัดทำและตรวจสอบรายงานการอบรมพนักงานสำหรับการติดตามผลของ HRD",
  Completed: "เสร็จสิ้น",
  Compliance: "การปฏิบัติตามข้อกำหนด",
  Core: "หลักสูตรแกนกลาง",
  "In review": "อยู่ระหว่างตรวจสอบ",
  "Open registration": "เปิดรับลงทะเบียน",
  Pending: "รอดำเนินการ",
  "Ready to register": "พร้อมลงทะเบียน",
  "Registration recommended": "แนะนำให้ลงทะเบียน",
  "Role Skill": "ทักษะตามบทบาท",
  "Soft Skill": "ทักษะด้านพฤติกรรม",
  "Waiting approval": "รออนุมัติ",
  "Waiting certification": "รอรับรองผล",
  "Waiting HRD approval": "รอ HRD อนุมัติ",
  "HRD Center review and approval": "HRD ส่วนกลางตรวจสอบและอนุมัติ",
  "Submit training need to HRD Center": "ส่งความต้องการฝึกอบรมให้ HRD ส่วนกลาง",
  "Submitted to HRD for verification": "ส่งให้ HRD ตรวจสอบแล้ว",
  "Training approval result published": "ประกาศผลการอนุมัติการอบรมแล้ว",
  "Bring employee ID card for on-site attendance confirmation.":
    "กรุณานำบัตรพนักงานมายืนยันการเข้าอบรม ณ สถานที่จัดอบรม",
  "Develop service, communication, and coordination skills for frontline teams.":
    "พัฒนาทักษะการบริการ การสื่อสาร และการประสานงานสำหรับทีมด่านหน้า",
  "Mandatory course for every employee to understand personal data handling.":
    "หลักสูตรบังคับสำหรับพนักงานทุกคนเพื่อทำความเข้าใจการจัดการข้อมูลส่วนบุคคล",
  "Personal data protection awareness for all employees.":
    "สร้างความตระหนักด้านการคุ้มครองข้อมูลส่วนบุคคลสำหรับพนักงานทุกคน",
  "Post-test score 80% or higher is required for completion.":
    "ต้องได้คะแนนแบบทดสอบหลังเรียนอย่างน้อย 80% จึงจะผ่านหลักสูตร",
  "Recommended course for Production employees to improve quality inspection skills.":
    "หลักสูตรแนะนำสำหรับพนักงานฝ่ายผลิตเพื่อพัฒนาทักษะการตรวจสอบคุณภาพ",
  "Recommended safety compliance refresh for operational employees.":
    "หลักสูตรทบทวนความปลอดภัยและข้อกำหนดสำหรับพนักงานปฏิบัติการ",
  "Review key safety standards and rules for operational areas.":
    "ทบทวนมาตรฐานและกฎความปลอดภัยสำคัญสำหรับพื้นที่ปฏิบัติงาน",
  "Workshop includes group practice and service scenario review.":
    "เวิร์กช็อปประกอบด้วยการฝึกกลุ่มและการทบทวนสถานการณ์ด้านบริการ",
  "5S Awareness": "ความรู้พื้นฐาน 5ส",
  "5S Refresher": "ทบทวน 5ส",
  "Add Attendee / เพิ่มผู้เข้าร่วม (ส่งคนเพิ่ม)":
    "เพิ่มผู้เข้าอบรม / ส่งรายชื่อเพิ่มเติม",
  "Add attendee to recorded course": "เพิ่มผู้เข้าอบรมในหลักสูตรที่บันทึกแล้ว",
  Annual: "ประจำปี",
  "AL Prod.": "ผลิตอะลูมิเนียม",
  "All years": "ทุกปี",
  "Annual Compliance Refresh": "ทบทวนข้อกำหนดประจำปี",
  "Annual OAP plans, training needs, company acceptance surveys, and monthly rolling schedules.":
    "จัดการแผน OAP ประจำปี คำขอฝึกอบรม แบบตอบรับจากบริษัท และแผนอบรมรายเดือน",
  "Basic Welding Skill": "ทักษะงานเชื่อมพื้นฐาน",
  "Budget and expense overview": "ภาพรวมงบประมาณและค่าใช้จ่าย",
  Casting: "งานหล่อ",
  "Check actual attendance, record real training expenses, and save the completed actual record.":
    "ตรวจรายชื่อผู้เข้าอบรมจริง บันทึกค่าใช้จ่ายที่เกิดขึ้น และปิดบันทึกผลการอบรมให้ครบ",
  "Companies, employees, instructors, levels, positions, and function master data.":
    "ข้อมูลหลักของบริษัท พนักงาน วิทยากร ระดับ ตำแหน่ง และหน่วยงาน",
  "Course budget breakdown": "รายละเอียดงบประมาณรายหลักสูตร",
  "Course financial status": "สถานะค่าใช้จ่ายของหลักสูตร",
  "COURSE MANAGEMENT": "จัดการหลักสูตร",
  "Course Standard setup": "ตั้งค่ามาตรฐานหลักสูตร",
  Cost: "ค่าใช้จ่าย",
  "Data Privacy Awareness": "ความเข้าใจเรื่องคุ้มครองข้อมูลส่วนบุคคล",
  "Data Privacy Refresh": "ทบทวนการคุ้มครองข้อมูลส่วนบุคคล",
  "Define the training target before saving the course.":
    "กำหนดกลุ่มเป้าหมายการอบรมก่อนบันทึกหลักสูตร",
  "Die Quenching": "ชุบแม่พิมพ์",
  "e.g. ATA / SNF": "เช่น ATA / SNF",
  "e.g. ATA-1001": "เช่น ATA-1001",
  "e.g. Mr. Somchai Promjai": "เช่น นายสมชาย พร้อมใจ",
  "e.g. Production": "เช่น ฝ่ายผลิต",
  "EMPLOYEE - Locked": "พนักงาน - ยังล็อกอยู่",
  "Employee preview is locked": "หน้าพนักงานถูกล็อกไว้",
  "Factory budget allocation for Center courses":
    "งบประมาณของโรงงานสำหรับหลักสูตรส่วนกลาง",
  "Forklift Safety Training": "ความปลอดภัยในการใช้รถโฟล์คลิฟท์",
  "IN-HOUSE": "ภายในบริษัท",
  Lead: "ภาวะผู้นำ",
  "Leadership Essentials": "พื้นฐานภาวะผู้นำ",
  Machining: "งานแมชชีน",
  "Main workspace menu": "เมนูหลักของระบบ",
  "Manage course master, target standards, course types, and pre/post evaluation forms.":
    "ดูแลฐานข้อมูลหลักสูตร มาตรฐานกลุ่มเป้าหมาย ประเภทหลักสูตร และแบบทดสอบก่อน-หลังอบรม",
  Maintenance: "งานซ่อมบำรุง",
  "MASTER DATA": "ข้อมูลหลัก",
  "Mock Employee": "ผู้ใช้พนักงานจำลอง",
  "Mock Factory User": "ผู้ใช้โรงงานจำลอง",
  "Mock HRD Center": "HRD ส่วนกลางจำลอง",
  "Mock HRD Factory": "HRD โรงงานจำลอง",
  Moral: "จริยธรรม",
  OJT: "ฝึกอบรมหน้างาน",
  "Open Workspace": "เปิดเมนูนี้",
  "Orientation Program": "ปฐมนิเทศพนักงาน",
  Other: "อื่น ๆ",
  "PLAN MANAGEMENT": "จัดการแผนอบรม",
  "Post-Record Registration": "เพิ่มรายชื่อหลังบันทึกผล",
  Production: "ฝ่ายผลิต",
  "Profile Overview": "ข้อมูลผู้ใช้งาน",
  "Promise": "สัญญา",
  Promotion: "การเลื่อนตำแหน่ง",
  PUBLIC: "อบรมภายนอก",
  Quality: "คุณภาพ",
  "Quality Control Basics": "พื้นฐานการควบคุมคุณภาพ",
  "Record actual attendance, post-training evaluations, expenses, and participant additions.":
    "บันทึกผู้เข้าอบรมจริง ผลประเมินหลังอบรม ค่าใช้จ่าย และรายชื่อที่เพิ่มภายหลัง",
  "RECORD MANAGEMENT": "บันทึกผลอบรม",
  "REPORT MANAGEMENT": "รายงาน",
  "Reports & Analytics": "รายงานและวิเคราะห์ผล",
  "Safety & Compliance Basics": "พื้นฐานความปลอดภัยและข้อกำหนด",
  "Safety Basics": "พื้นฐานความปลอดภัย",
  "Select Employee (Optional)": "เลือกพนักงาน (ถ้ามี)",
  "Select a Workspace Module": "เลือกโมดูลที่ต้องการใช้งาน",
  Service: "บริการ",
  "Service Mind for Frontline": "ใจบริการสำหรับทีมหน้างาน",
  Special: "หลักสูตรพิเศษ",
  System: "ระบบ",
  "Training schedule calendars, progress summaries, expense breakdowns, and email drafts.":
    "ดูปฏิทินอบรม สรุปความคืบหน้า ค่าใช้จ่าย และร่างอีเมลรายงาน",
  "Workspace Operations": "เมนูการทำงาน",
  "เปิดหน้าทดสอบโดยไม่สร้าง authenticated session":
    "เปิดหน้าทดสอบโดยไม่สร้างเซสชันผู้ใช้",
  "HRD Center dashboard": "แดชบอร์ด HRD ส่วนกลาง",
  "HRD Factory dashboard": "แดชบอร์ด HRD โรงงาน",
};

const thaiAttributeDictionary: Record<string, string> = {
  "Enter participants per group, e.g. 20":
    "ใส่จำนวนผู้เข้าอบรมต่อรุ่น เช่น 20 คน",
  "Enter total training hours, e.g. 6":
    "ใส่จำนวนชั่วโมงอบรมทั้งหมด เช่น 6 ชั่วโมง",
  "Enter budget amount, e.g. 15000":
    "ใส่งบประมาณ เช่น 15,000 บาท",
  "Enter provider, e.g. HRD Center or institute name":
    "ใส่หน่วยงานหรือชื่อสถาบัน เช่น HRD Center",
  "Saved Course Standard matrix": "ตารางมาตรฐานหลักสูตรที่บันทึกแล้ว",
  "Course Master and Course Standard workspace":
    "พื้นที่ทำงานฐานข้อมูลและมาตรฐานหลักสูตร",
  "Course setup workflow": "ขั้นตอนการจัดทำหลักสูตร",
  "Course workspace views": "มุมมองพื้นที่ทำงานหลักสูตร",
  "Actual attendees by company": "ผู้เข้าอบรมจริงแยกตามบริษัท",
  "Actual cost breakdown": "รายละเอียดค่าใช้จ่ายจริง",
  "Actual training expenses": "ค่าใช้จ่ายการอบรมจริง",
  "Assessment flow": "ลำดับการทำแบบทดสอบ",
  "Assessment management": "จัดการแบบทดสอบ",
  "Auto-generated when left blank": "เว้นว่างเพื่อสร้างรหัสอัตโนมัติ",
  "Completed course selector": "เลือกหลักสูตรที่เสร็จสิ้น",
  "Completed training list": "รายการอบรมที่เสร็จสิ้น",
  "Compose employee report": "เขียนรายงานพนักงาน",
  "Course actions": "การดำเนินการหลักสูตร",
  "Course name or leave blank for a reusable test":
    "ระบุชื่อหลักสูตร หรือเว้นว่างสำหรับแบบทดสอบที่ใช้ซ้ำได้",
  "Summary Dashboard module": "โมดูลแดชบอร์ดสรุปผล",
  "Training attendance summary": "สรุปผลการเข้าอบรม",
  "Attendance chart legend": "คำอธิบายกราฟการเข้าอบรม",
  "Course, company, location, status": "หลักสูตร บริษัท สถานที่ สถานะ",
  "Course, trainer, provider, status": "หลักสูตร วิทยากร ผู้ให้บริการ สถานะ",
  "Dashboard overview": "ภาพรวมแดชบอร์ด",
  "Document purpose": "วัตถุประสงค์ของเอกสาร",
  "Download completed training files": "ดาวน์โหลดไฟล์การอบรมที่เสร็จสิ้น",
  "Edit selected training schedule": "แก้ไขกำหนดการอบรมที่เลือก",
  "Employee dashboard overview": "ภาพรวมแดชบอร์ดพนักงาน",
  "Employee profile": "ข้อมูลพนักงาน",
  "Employee report history": "ประวัติรายงานพนักงาน",
  "Employee report preview": "ตัวอย่างรายงานพนักงาน",
  "Employee training calendar": "ปฏิทินการอบรมพนักงาน",
  "Enter course group": "ระบุกลุ่มหลักสูตร",
  "Enter course or skill topic": "ระบุหลักสูตรหรือทักษะที่ต้องการ",
  "Enter course type": "ระบุประเภทหลักสูตร",
  "Enter email subject": "ระบุหัวข้ออีเมล",
  "Enter the question shown to learners": "ระบุคำถามที่จะแสดงแก่ผู้เรียน",
  "Enter the question shown to respondents": "ระบุคำถามที่จะแสดงแก่ผู้ตอบ",
  "Explain why this training is needed": "อธิบายเหตุผลที่ต้องการการอบรม",
  "Filter company": "กรองบริษัท",
  "Filter company code": "กรองรหัสบริษัท",
  "Filter employee company": "กรองบริษัทของพนักงาน",
  "Filter status": "กรองสถานะ",
  "First name": "ชื่อ",
  "Function name in English": "ชื่อหน่วยงานภาษาอังกฤษ",
  "Generated automatically from the selected Course Group ID":
    "สร้างจากรหัสกลุ่มหลักสูตรที่เลือกโดยอัตโนมัติ",
  "Import completed courses from Excel": "นำเข้าหลักสูตรที่เสร็จสิ้นจาก Excel",
  "Last name": "นามสกุล",
  "Monthly course overview": "ภาพรวมหลักสูตรรายเดือน",
  "My employee information": "ข้อมูลพนักงานของฉัน",
  "My Target Courses": "หลักสูตรเป้าหมายของฉัน",
  "No selected actual course": "ยังไม่ได้เลือกหลักสูตรจริง",
  "No selected course": "ยังไม่ได้เลือกหลักสูตร",
  "No training record": "ไม่มีประวัติการอบรม",
  "Position name in English": "ชื่อตำแหน่งภาษาอังกฤษ",
  "Previous training records": "ประวัติการอบรมก่อนหน้า",
  Remark: "หมายเหตุ",
  "Report subject": "หัวข้อรายงาน",
  Search: "ค้นหา",
  "Search assessment": "ค้นหาแบบทดสอบ",
  "Search assessment, course, type, status":
    "ค้นหาแบบทดสอบ หลักสูตร ประเภท หรือสถานะ",
  "Search company data": "ค้นหาข้อมูลบริษัท",
  "Search company records": "ค้นหารายการบริษัท",
  "Search course": "ค้นหาหลักสูตร",
  "Search course code, course name, function":
    "ค้นหารหัสหลักสูตร ชื่อหลักสูตร หรือหน่วยงาน",
  "Search course code, name, type, group":
    "ค้นหารหัส ชื่อ ประเภท หรือกลุ่มหลักสูตร",
  "Search course standard": "ค้นหามาตรฐานหลักสูตร",
  "Search course type": "ค้นหาประเภทหลักสูตร",
  "Search course, provider, certificate...":
    "ค้นหาหลักสูตร ผู้ให้บริการ หรือใบรับรอง...",
  "Search employee code, name, function, position":
    "ค้นหารหัสพนักงาน ชื่อ หน่วยงาน หรือตำแหน่ง",
  "Search employee data": "ค้นหาข้อมูลพนักงาน",
  "Search employee reports": "ค้นหารายงานพนักงาน",
  "Search employee training requests": "ค้นหาคำขอฝึกอบรมของพนักงาน",
  "Search evaluation": "ค้นหาแบบประเมิน",
  "Search first name, last name, telephone, education":
    "ค้นหาชื่อ นามสกุล โทรศัพท์ หรือการศึกษา",
  "Search function code or name": "ค้นหารหัสหรือชื่อหน่วยงาน",
  "Search instructor records": "ค้นหาข้อมูลวิทยากร",
  "Search internal report history": "ค้นหาประวัติรายงานภายใน",
  "Search level code, name, PL, or key": "ค้นหารหัส ชื่อ PL หรือคีย์ระดับ",
  "Search name, timing, respondent, scope, company, status":
    "ค้นหาชื่อ ช่วงเวลา ผู้ตอบ ขอบเขต บริษัท หรือสถานะ",
  "Search position code or name": "ค้นหารหัสหรือชื่อตำแหน่ง",
  "Search records": "ค้นหารายการ",
  "Search report history": "ค้นหาประวัติรายงาน",
  "Search request, employee, course, reason":
    "ค้นหาคำขอ พนักงาน หลักสูตร หรือเหตุผล",
  "Select schedule month": "เลือกเดือนของกำหนดการ",
  "Select training actual course": "เลือกหลักสูตรสำหรับบันทึกผลจริง",
  "Selected report detail": "รายละเอียดรายงานที่เลือก",
  "Selected training record detail": "รายละเอียดประวัติการอบรมที่เลือก",
  "Telephone": "โทรศัพท์",
  "Training calendar": "ปฏิทินการอบรม",
  "Training record filters": "ตัวกรองประวัติการอบรม",
  "Training summary": "สรุปการอบรม",
  "Type a preview response": "ทดลองพิมพ์คำตอบ",
  "Upcoming training courses": "หลักสูตรที่กำลังจะมาถึง",
  "Write email message": "เขียนข้อความอีเมล",
  "Write message": "เขียนข้อความ",
};

const preserveWhitespace = (source: string, translated: string) => {
  const leadingWhitespace = source.match(/^\s*/)?.[0] ?? "";
  const trailingWhitespace = source.match(/\s*$/)?.[0] ?? "";
  return `${leadingWhitespace}${translated}${trailingWhitespace}`;
};

export const translateUiText = (source: string): string => {
  const normalizedSource = source.trim();

  if (!normalizedSource) {
    return source;
  }

  const exactTranslation = thaiUiDictionary[normalizedSource];

  if (exactTranslation) {
    return preserveWhitespace(source, exactTranslation);
  }

  if (normalizedSource.includes(" / ")) {
    const sourceParts = normalizedSource.split(" / ");
    const translatedParts: string[] = sourceParts.map((part) =>
      translateUiText(part),
    );

    if (translatedParts.some((part, index) => part !== sourceParts[index])) {
      return preserveWhitespace(source, translatedParts.join(" / "));
    }
  }

  if (normalizedSource.includes(" · ")) {
    const sourceParts = normalizedSource.split(" · ");
    const translatedParts: string[] = sourceParts.map((part) =>
      translateUiText(part),
    );

    if (translatedParts.some((part, index) => part !== sourceParts[index])) {
      return preserveWhitespace(source, translatedParts.join(" · "));
    }
  }

  const countPatterns: Array<[RegExp, (match: RegExpMatchArray) => string]> = [
    [/^(\d+) records?$/, (match) => `${match[1]} รายการ`],
    [/^(\d+) shown$/, (match) => `แสดง ${match[1]} รายการ`],
    [/^(\d+) questions?$/, (match) => `${match[1]} คำถาม`],
    [/^(\d+) courses?$/, (match) => `${match[1]} หลักสูตร`],
    [/^(\d+) positions?$/, (match) => `${match[1]} ตำแหน่ง`],
    [/^(\d+) levels?$/, (match) => `${match[1]} ระดับ`],
    [/^(\d+) modules?$/, (match) => `${match[1]} โมดูล`],
    [/^(\d+) schedules?$/, (match) => `${match[1]} กำหนดการ`],
    [/^(\d+) completed$/, (match) => `เสร็จสิ้น ${match[1]} รายการ`],
    [/^(\d+) registrations?$/, (match) => `${match[1]} การลงทะเบียน`],
    [/^(\d+) roadmaps?$/, (match) => `${match[1]} แผนพัฒนา`],
    [/^(\d+) rolling schedules?$/, (match) => `${match[1]} กำหนดการรายเดือน`],
    [/^(\d+) sessions?$/, (match) => `${match[1]} รอบอบรม`],
    [/^(\d+) available$/, (match) => `${match[1]} คนพร้อมเพิ่ม`],
    [/^(\d+) target$/, (match) => `${match[1]} คนในกลุ่มเป้าหมาย`],
    [/^(\d+) outside target$/, (match) => `${match[1]} คนนอกกลุ่มเป้าหมาย`],
    [/^(\d+) dates?$/, (match) => `${match[1]} วันอบรม`],
    [/^Session (\d+)$/, (match) => `รอบอบรมที่ ${match[1]}`],
    [/^Batch (\d+)$/, (match) => `รุ่นที่ ${match[1]}`],
    [
      /^(\d+) companies selected$/,
      (match) => `เลือกแล้ว ${match[1]} บริษัท`,
    ],
    [
      /^(\d+) published Pre Test options?$/,
      (match) => `แบบทดสอบก่อนเรียนที่เผยแพร่แล้ว ${match[1]} รายการ`,
    ],
    [
      /^(\d+) published Post Test options?$/,
      (match) => `แบบทดสอบหลังเรียนที่เผยแพร่แล้ว ${match[1]} รายการ`,
    ],
    [
      /^(\d+) published After Training options?$/,
      (match) => `แบบประเมินหลังอบรมที่เผยแพร่แล้ว ${match[1]} รายการ`,
    ],
    [
      /^(\d+) published 30-Day Follow-up options?$/,
      (match) => `แบบประเมินติดตามผล 30 วันที่เผยแพร่แล้ว ${match[1]} รายการ`,
    ],
    [
      /^Linked course: (.+)$/,
      (match) => `หลักสูตรที่เชื่อม: ${match[1]}`,
    ],
    [
      /^(.+) \(Unavailable\)$/,
      (match) => `${match[1]} (ไม่พร้อมใช้งาน)`,
    ],
    [
      /^(\d+) \/ (\d+) required fields$/,
      (match) => `${match[1]} / ${match[2]} ช่องที่จำเป็น`,
    ],
    [/^(\d+) evaluations?$/, (match) => `${match[1]} แบบประเมิน`],
    [/^(\d+) assessments?$/, (match) => `${match[1]} แบบทดสอบ`],
    [
      /^(\d{1,2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)$/,
      (match) => {
        const shortMonths: Record<string, string> = {
          Jan: "ม.ค.",
          Feb: "ก.พ.",
          Mar: "มี.ค.",
          Apr: "เม.ย.",
          May: "พ.ค.",
          Jun: "มิ.ย.",
          Jul: "ก.ค.",
          Aug: "ส.ค.",
          Sep: "ก.ย.",
          Oct: "ต.ค.",
          Nov: "พ.ย.",
          Dec: "ธ.ค.",
        };

        return `${match[1]} ${shortMonths[match[2]]}`;
      },
    ],
    [
      /^(\d+) \/ (\d+) assessments?$/,
      (match) => `${match[1]} / ${match[2]} แบบทดสอบ`,
    ],
    [
      /^(\d+) \/ (\d+) evaluations?$/,
      (match) => `${match[1]} / ${match[2]} แบบประเมิน`,
    ],
    [
      /^Exported (\d+) assessments? to CSV\.$/,
      (match) => `ส่งออกแบบทดสอบ ${match[1]} รายการเป็น CSV แล้ว`,
    ],
    [
      /^Exported (\d+) evaluations? to CSV\.$/,
      (match) => `ส่งออกแบบประเมิน ${match[1]} รายการเป็น CSV แล้ว`,
    ],
  ];

  for (const [pattern, translate] of countPatterns) {
    const match = normalizedSource.match(pattern);

    if (match) {
      return preserveWhitespace(source, translate(match));
    }
  }

  return source;
};

const isExcludedElement = (element: Element | null) =>
  !element ||
  Boolean(
    element.closest(
      "script, style, code, pre, [translate='no'], .notranslate",
    ),
  );

const isExcludedTextElement = (element: Element | null) =>
  isExcludedElement(element) || Boolean(element?.closest("textarea"));

const originalTextByNode = new WeakMap<Text, string>();
const originalAttributesByElement = new WeakMap<
  Element,
  Map<string, string>
>();

const localizeTextNode = (node: Text, language: UiLanguage) => {
  if (isExcludedTextElement(node.parentElement)) {
    return;
  }

  const parentElement = node.parentElement;
  let originalSource = originalTextByNode.get(node);

  if (originalSource === undefined) {
    originalSource = node.data;
    originalTextByNode.set(node, originalSource);
  } else {
    const translatedOriginal = translateUiText(originalSource);

    if (node.data !== originalSource && node.data !== translatedOriginal) {
      originalSource = node.data;
      originalTextByNode.set(node, originalSource);
    }
  }

  const normalizedSource = originalSource.trim();
  if (
    parentElement?.tagName === "OPTION" &&
    !parentElement.hasAttribute("value") &&
    normalizedSource
  ) {
    parentElement.setAttribute("value", normalizedSource);
  }

  const targetText =
    language === "th" ? translateUiText(originalSource) : originalSource;

  if (targetText !== node.data) {
    node.data = targetText;
  }
};

const localizeAttributes = (element: Element, language: UiLanguage) => {
  if (isExcludedElement(element)) {
    return;
  }

  ["placeholder", "aria-label", "title"].forEach((attributeName) => {
    const currentValue = element.getAttribute(attributeName);

    if (!currentValue) {
      return;
    }

    let originalAttributes = originalAttributesByElement.get(element);

    if (!originalAttributes) {
      originalAttributes = new Map<string, string>();
      originalAttributesByElement.set(element, originalAttributes);
    }

    let originalValue = originalAttributes.get(attributeName);

    if (originalValue === undefined) {
      originalValue = currentValue;
      originalAttributes.set(attributeName, originalValue);
    } else {
      const translatedOriginal =
        thaiAttributeDictionary[originalValue] ?? translateUiText(originalValue);

      if (
        currentValue !== originalValue &&
        currentValue !== translatedOriginal
      ) {
        originalValue = currentValue;
        originalAttributes.set(attributeName, originalValue);
      }
    }

    const targetValue =
      language === "th"
        ? (thaiAttributeDictionary[originalValue] ??
          translateUiText(originalValue))
        : originalValue;

    if (targetValue !== currentValue) {
      element.setAttribute(attributeName, targetValue);
    }
  });
};

const localizeTree = (root: Node, language: UiLanguage) => {
  if (root instanceof Text) {
    localizeTextNode(root, language);
    return;
  }

  if (!(root instanceof Element)) {
    return;
  }

  localizeAttributes(root, language);
  root
    .querySelectorAll("[placeholder], [aria-label], [title]")
    .forEach((element) => localizeAttributes(element, language));

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let currentNode = walker.nextNode();

  while (currentNode) {
    localizeTextNode(currentNode as Text, language);
    currentNode = walker.nextNode();
  }
};

export default function ThaiUiLocalization({
  children,
}: {
  children: ReactNode;
}) {
  const language = useSyncExternalStore(
    subscribeToUiLanguage,
    readUiLanguage,
    (): UiLanguage => "th",
  );

  const setLanguage = useCallback((nextLanguage: UiLanguage) => {
    inMemoryLanguage = nextLanguage;

    try {
      window.localStorage.setItem(UI_LANGUAGE_STORAGE_KEY, nextLanguage);
    } catch {
      // The preference remains active for this browser session.
    }

    window.dispatchEvent(new Event(UI_LANGUAGE_CHANGE_EVENT));
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
    localizeTree(document.body, language);

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === "characterData") {
          localizeTextNode(mutation.target as Text, language);
          return;
        }

        if (mutation.type === "attributes") {
          localizeAttributes(mutation.target as Element, language);
          return;
        }

        mutation.addedNodes.forEach((node) => localizeTree(node, language));
      });
    });

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["placeholder", "aria-label", "title"],
      characterData: true,
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, [language]);

  const contextValue = useMemo(
    () => ({ language, setLanguage }),
    [language, setLanguage],
  );

  return (
    <UiLanguageContext.Provider value={contextValue}>
      {children}
    </UiLanguageContext.Provider>
  );
}
