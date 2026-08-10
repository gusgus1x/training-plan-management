import {
  TRAINING_MASTER_KEYS,
  readMasterCollection,
  writeMasterCollection,
} from "./trainingWorkflow";

export type EmployeeCompanyCode = "ATA" | "TEP" | "ATFB" | "NIC" | "SATI" | "SNF";

export type EmployeeMasterRecord = {
  id: string;
  company: EmployeeCompanyCode;
  empCode: string;
  idCard: string;
  nameTh: string;
  surnameTh: string;
  titleEn: string;
  nameEn: string;
  surnameEn: string;
  birthday: string;
  workday: string;
  functionCode: string;
  functionName: string;
  department?: string;
  positionName: string;
  levelKey: string;
};

export type PositionLevelSlot = {
  positionName: string;
  levelKey: string;
  functionCode: string;
  functionName: string;
  department: string;
};

const createEmployee = (
  company: EmployeeCompanyCode,
  sequence: number,
  values: Omit<EmployeeMasterRecord, "id" | "company" | "empCode" | "idCard">,
): EmployeeMasterRecord => ({
  id: `emp-${company.toLowerCase()}-${String(sequence).padStart(3, "0")}`,
  company,
  empCode: `${company}-${String(sequence).padStart(4, "0")}`,
  idCard: `MOCK-${company}-${String(sequence).padStart(4, "0")}`,
  department: values.department ?? "",
  ...values,
});

const companySlots: PositionLevelSlot[] = [
  // 1. President / จ4 / FNC0016 President Office
  { positionName: "President", levelKey: "จ4", functionCode: "FNC0016", functionName: "President Office", department: "Executive Office" },
  // 2. Executive Vice President / จ4 / FNC0010 Production
  { positionName: "Executive Vice President", levelKey: "จ4", functionCode: "FNC0010", functionName: "Production", department: "Executive Office" },
  // 3. Vice President / จ4 / FNC0012 Engineering and Maintenance
  { positionName: "Vice President", levelKey: "จ4", functionCode: "FNC0012", functionName: "Engineering and Maintenance", department: "Operations" },
  // 4. Senior Advisor / จ4 / FNC0004 Human Resource
  { positionName: "Senior Advisor", levelKey: "จ4", functionCode: "FNC0004", functionName: "Human Resource", department: "Advisory" },
  // 5. Advisor / จ3 / FNC0013 Quality
  { positionName: "Advisor", levelKey: "จ3", functionCode: "FNC0013", functionName: "Quality", department: "Quality Advisory" },
  // 6. Executive General Manager / จ3 / FNC0004 Human Resource
  { positionName: "Executive General Manager", levelKey: "จ3", functionCode: "FNC0004", functionName: "Human Resource", department: "HR & Admin" },
  // 7. Senior General Manager / จ3 / FNC0009 Warehouse
  { positionName: "Senior General Manager", levelKey: "จ3", functionCode: "FNC0009", functionName: "คลังสินค้า", department: "Logistics" },
  // 8. Plant Manager / จ3 / FNC0010 Production
  { positionName: "Plant Manager", levelKey: "จ3", functionCode: "FNC0010", functionName: "Production", department: "Plant Operations" },
  // 9. Senior Executive Coordinator / จ2 / FNC0008 IT Promotion
  { positionName: "Senior Executive Coordinator", levelKey: "จ2", functionCode: "FNC0008", functionName: "IT Promotion", department: "Executive Coordination" },
  // 10. General Manager / จ2 / FNC0010 Production
  { positionName: "General Manager", levelKey: "จ2", functionCode: "FNC0010", functionName: "Production", department: "Manufacturing" },
  // 11. General Manager / จ2 / FNC0001 Sales
  { positionName: "General Manager", levelKey: "จ2", functionCode: "FNC0001", functionName: "การขาย", department: "Sales & Marketing" },
  // 12. Manager / จ1 / FNC0010 Production
  { positionName: "Manager", levelKey: "จ1", functionCode: "FNC0010", functionName: "Production", department: "Production" },
  // 13. Manager / จ1 / FNC0013 Quality
  { positionName: "Manager", levelKey: "จ1", functionCode: "FNC0013", functionName: "Quality", department: "Quality Assurance" },
  // 14. Manager / จ1 / FNC0003 Account and Financial
  { positionName: "Manager", levelKey: "จ1", functionCode: "FNC0003", functionName: "Account and Financial", department: "Finance & Accounting" },
  // 15. Manager / จ1 / FNC0007 Purchase
  { positionName: "Manager", levelKey: "จ1", functionCode: "FNC0007", functionName: "Purchase", department: "Procurement" },
  // 16. Section Head / บ4 / FNC0010 Production
  { positionName: "Section Head", levelKey: "บ4", functionCode: "FNC0010", functionName: "Production", department: "Assembly" },
  // 17. Section Head / บ4 / FNC0012 Engineering and Maintenance
  { positionName: "Section Head", levelKey: "บ4", functionCode: "FNC0012", functionName: "Engineering and Maintenance", department: "Maintenance" },
  // 18. Section Head / บ4 / FNC0002 Sale Planing
  { positionName: "Section Head", levelKey: "บ4", functionCode: "FNC0002", functionName: "Sale Planing", department: "Sales Planning" },
  // 19. Section Head / บ4 / FNC0011 Production Planing
  { positionName: "Section Head", levelKey: "บ4", functionCode: "FNC0011", functionName: "Production Planing", department: "Planning" },
  // 20. Senior Foreman / บ3 / FNC0010 Production
  { positionName: "Senior Foreman", levelKey: "บ3", functionCode: "FNC0010", functionName: "Production", department: "Machining" },
  // 21. Officer / บ3 / FNC0013 Quality
  { positionName: "Officer", levelKey: "บ3", functionCode: "FNC0013", functionName: "Quality", department: "Quality Control" },
  // 22. Officer / บ3 / FNC0014 Safety and Environment
  { positionName: "Officer", levelKey: "บ3", functionCode: "FNC0014", functionName: "Safety and Environment", department: "Safety" },
  // 23. Officer / บ2 / FNC0004 Human Resource
  { positionName: "Officer", levelKey: "บ2", functionCode: "FNC0004", functionName: "Human Resource", department: "Training" },
  // 24. Foreman / บ2 / FNC0010 Production
  { positionName: "Foreman", levelKey: "บ2", functionCode: "FNC0010", functionName: "Production", department: "Casting" },
  // 25. Foreman / บ2 / FNC0012 Engineering and Maintenance
  { positionName: "Foreman", levelKey: "บ2", functionCode: "FNC0012", functionName: "Engineering and Maintenance", department: "Tooling" },
  // 26. Engineer / บ1 / FNC0012 Engineering and Maintenance
  { positionName: "Engineer", levelKey: "บ1", functionCode: "FNC0012", functionName: "Engineering and Maintenance", department: "Engineering" },
  // 27. Engineer / บ1 / FNC0013 Quality
  { positionName: "Engineer", levelKey: "บ1", functionCode: "FNC0013", functionName: "Quality", department: "QA/QC" },
  // 28. Engineer / บ1 / FNC0015 Project Engineering
  { positionName: "Engineer", levelKey: "บ1", functionCode: "FNC0015", functionName: "Project Engineering", department: "Project Engineering" },
  // 29. Engineer / บ1 / FNC0008 IT Promotion
  { positionName: "Engineer", levelKey: "บ1", functionCode: "FNC0008", functionName: "IT Promotion", department: "System Development" },
  // 30. Leader / ป5 / FNC0010 Production
  { positionName: "Leader", levelKey: "ป5", functionCode: "FNC0010", functionName: "Production", department: "Assembly Line 1" },
  // 31. Leader / ป5 / FNC0014 Safety and Environment
  { positionName: "Leader", levelKey: "ป5", functionCode: "FNC0014", functionName: "Safety and Environment", department: "Safety Operations" },
  // 32. Leader / ป4 / FNC0010 Production
  { positionName: "Leader", levelKey: "ป4", functionCode: "FNC0010", functionName: "Production", department: "Machining Line" },
  // 33. Leader / ป4 / FNC0009 Warehouse
  { positionName: "Leader", levelKey: "ป4", functionCode: "FNC0009", functionName: "คลังสินค้า", department: "Warehouse Store" },
  // 34. Staff / ป3 / FNC0008 IT Promotion
  { positionName: "Staff", levelKey: "ป3", functionCode: "FNC0008", functionName: "IT Promotion", department: "IT Support" },
  // 35. Staff / ป3 / FNC0011 Production Planing
  { positionName: "Staff", levelKey: "ป3", functionCode: "FNC0011", functionName: "Production Planing", department: "Production Control" },
  // 36. Staff / ป3 / FNC0004 Human Resource
  { positionName: "Staff", levelKey: "ป3", functionCode: "FNC0004", functionName: "Human Resource", department: "HR & Welfare" },
  // 37. Staff / ป3 / FNC0005 General Affairs
  { positionName: "Staff", levelKey: "ป3", functionCode: "FNC0005", functionName: "ธุรการ", department: "General Affairs" },
  // 38. Staff / ป2 / FNC0006 Interpreter & Secretary
  { positionName: "Staff", levelKey: "ป2", functionCode: "FNC0006", functionName: "ล่ามและเลขานุการ", department: "Translation & Secretary" },
  // 39. Staff / ป2 / FNC0007 Purchase
  { positionName: "Staff", levelKey: "ป2", functionCode: "FNC0007", functionName: "Purchase", department: "Purchasing" },
  // 40. Operator / ป2 / FNC0010 Production
  { positionName: "Operator", levelKey: "ป2", functionCode: "FNC0010", functionName: "Production", department: "Casting Section" },
  // 41. Operator / ป1 / FNC0010 Production
  { positionName: "Operator", levelKey: "ป1", functionCode: "FNC0010", functionName: "Production", department: "Assembly Line A" },
  // 42. Operator / ป1 / FNC0010 Production
  { positionName: "Operator", levelKey: "ป1", functionCode: "FNC0010", functionName: "Production", department: "Assembly Line B" },
  // 43. Operator / ป1 / FNC0012 Engineering and Maintenance
  { positionName: "Operator", levelKey: "ป1", functionCode: "FNC0012", functionName: "Engineering and Maintenance", department: "Maintenance Support" },
];

const thaiGivenNames = [
  { nameTh: "อนันต์", nameEn: "Anan", title: "Mr." },
  { nameTh: "มาลี", nameEn: "Mali", title: "Ms." },
  { nameTh: "ภัทรพล", nameEn: "Pattarapon", title: "Mr." },
  { nameTh: "รัชชานนท์", nameEn: "Ratchanon", title: "Mr." },
  { nameTh: "ศรัณย์", nameEn: "Saran", title: "Mr." },
  { nameTh: "วิชชุดา", nameEn: "Witchuda", title: "Ms." },
  { nameTh: "ธนพัฒน์", nameEn: "Thanapat", title: "Mr." },
  { nameTh: "พิมพ์วดี", nameEn: "Pimwadee", title: "Ms." },
  { nameTh: "สมชาย", nameEn: "Somchai", title: "Mr." },
  { nameTh: "นรินทร์", nameEn: "Narin", title: "Mr." },
  { nameTh: "อรสา", nameEn: "Orasa", title: "Ms." },
  { nameTh: "ภาวิณี", nameEn: "Pawinee", title: "Ms." },
  { nameTh: "ดวงกมล", nameEn: "Duangkamol", title: "Ms." },
  { nameTh: "ปิยะวัฒน์", nameEn: "Piyawat", title: "Mr." },
  { nameTh: "ชลธิชา", nameEn: "Chonthicha", title: "Ms." },
  { nameTh: "กานดา", nameEn: "Kanda", title: "Ms." },
  { nameTh: "ปรีชา", nameEn: "Preecha", title: "Mr." },
  { nameTh: "ศิริลักษณ์", nameEn: "Sirilak", title: "Ms." },
  { nameTh: "ฐิติวัฒน์", nameEn: "Thitiwat", title: "Mr." },
  { nameTh: "พงศกร", nameEn: "Pongsakorn", title: "Mr." },
  { nameTh: "รัตนาภรณ์", nameEn: "Rattanaporn", title: "Ms." },
  { nameTh: "วรากร", nameEn: "Warakorn", title: "Mr." },
  { nameTh: "วิภาดา", nameEn: "Wipada", title: "Ms." },
  { nameTh: "ชัยวัฒน์", nameEn: "Chaiwat", title: "Mr." },
  { nameTh: "ณัฐธิดา", nameEn: "Nattida", title: "Ms." },
  { nameTh: "อารีวรรณ", nameEn: "Areewan", title: "Ms." },
  { nameTh: "ธีรภัทร", nameEn: "Teerapat", title: "Mr." },
  { nameTh: "ธนาพร", nameEn: "Thanaporn", title: "Ms." },
  { nameTh: "สรวิชญ์", nameEn: "Sorawich", title: "Mr." },
  { nameTh: "สุดา", nameEn: "Suda", title: "Ms." },
  { nameTh: "กฤต", nameEn: "Krit", title: "Mr." },
  { nameTh: "วริศ", nameEn: "Warit", title: "Mr." },
  { nameTh: "จิรวัฒน์", nameEn: "Jirawat", title: "Mr." },
  { nameTh: "ณิชา", nameEn: "Nicha", title: "Ms." },
  { nameTh: "ประภาพร", nameEn: "Prapaporn", title: "Ms." },
  { nameTh: "วุฒิพงศ์", nameEn: "Wuttipong", title: "Mr." },
  { nameTh: "เบญจมาศ", nameEn: "Benjamas", title: "Ms." },
  { nameTh: "ธนกร", nameEn: "Thanakorn", title: "Mr." },
  { nameTh: "พิมพ์ชนก", nameEn: "Phimchanok", title: "Ms." },
  { nameTh: "กนกวรรณ", nameEn: "Kanokwan", title: "Ms." },
  { nameTh: "ณัฐพล", nameEn: "Nattapol", title: "Mr." },
  { nameTh: "อรรถพร", nameEn: "Arthaporn", title: "Mr." },
  { nameTh: "ศุภลักษณ์", nameEn: "Supalak", title: "Ms." },
  { nameTh: "กิตติ", nameEn: "Kitti", title: "Mr." },
  { nameTh: "ชนาธิป", nameEn: "Chanathip", title: "Mr." },
  { nameTh: "ณรงค์", nameEn: "Narong", title: "Mr." },
  { nameTh: "ธนภัทร", nameEn: "Thanapat", title: "Mr." },
  { nameTh: "นพดล", nameEn: "Noppadon", title: "Mr." },
  { nameTh: "ปกรณ์", nameEn: "Pakorn", title: "Mr." },
  { nameTh: "พีรพัฒน์", nameEn: "Peerapat", title: "Mr." },
  { nameTh: "ภูริณัฐ", nameEn: "Purinat", title: "Mr." },
  { nameTh: "วรชัย", nameEn: "Worachai", title: "Mr." },
  { nameTh: "สิทธิชัย", nameEn: "Sittichai", title: "Mr." },
  { nameTh: "อัครพล", nameEn: "Akarapol", title: "Mr." },
  { nameTh: "กัญญารัตน์", nameEn: "Kanyarat", title: "Ms." },
  { nameTh: "จิราภา", nameEn: "Jirapa", title: "Ms." },
  { nameTh: "ณัฐชา", nameEn: "Natcha", title: "Ms." },
  { nameTh: "ปวีณา", nameEn: "Paweena", title: "Ms." },
  { nameTh: "พัชรินทร์", nameEn: "Patcharin", title: "Ms." },
  { nameTh: "รัตนา", nameEn: "Rattana", title: "Ms." },
  { nameTh: "วรรณวิสา", nameEn: "Wanvisa", title: "Ms." },
  { nameTh: "ศศิธร", nameEn: "Sasithorn", title: "Ms." },
  { nameTh: "สุภาวดี", nameEn: "Supawadee", title: "Ms." },
  { nameTh: "อรทัย", nameEn: "Orathai", title: "Ms." },
  { nameTh: "อัญชลี", nameEn: "Anchalee", title: "Ms." },
];

const thaiSurnames = [
  { surnameTh: "ศรีสุข", surnameEn: "Srisuk" },
  { surnameTh: "เกษมสุข", surnameEn: "Kasemsuk" },
  { surnameTh: "เลิศปัญญา", surnameEn: "Lertpanya" },
  { surnameTh: "พรสวัสดิ์", surnameEn: "Pornsawat" },
  { surnameTh: "มีชัย", surnameEn: "Meechai" },
  { surnameTh: "ทองสว่าง", surnameEn: "Thongsawang" },
  { surnameTh: "วิริยะกุล", surnameEn: "Wiriyakul" },
  { surnameTh: "สุขประเสริฐ", surnameEn: "Sukprasert" },
  { surnameTh: "พร้อมใจ", surnameEn: "Promjai" },
  { surnameTh: "ทองชัย", surnameEn: "Thongchai" },
  { surnameTh: "จันทร์ดี", surnameEn: "Jandee" },
  { surnameTh: "ศรีสุวรรณ", surnameEn: "Srisuwan" },
  { surnameTh: "เรืองฤทธิ์", surnameEn: "Ruangrit" },
  { surnameTh: "เดชาวุธ", surnameEn: "Dechawut" },
  { surnameTh: "บุณยนิตย์", surnameEn: "Boonyanit" },
  { surnameTh: "รุ่งเรือง", surnameEn: "Rungrueang" },
  { surnameTh: "วงศ์สว่าง", surnameEn: "Wongsawang" },
  { surnameTh: "เดชาพงศ์", surnameEn: "Dechapong" },
  { surnameTh: "คงแก้ว", surnameEn: "Kongkaew" },
  { surnameTh: "อินทรพร", surnameEn: "Intaraporn" },
  { surnameTh: "พรมมินทร์", surnameEn: "Phrommint" },
  { surnameTh: "สมบัติ", surnameEn: "Sombat" },
  { surnameTh: "ชัยพร", surnameEn: "Chaiporn" },
  { surnameTh: "นิลประภา", surnameEn: "Nilprapa" },
  { surnameTh: "วิชัย", surnameEn: "Vichai" },
  { surnameTh: "เฟื่องฟ้า", surnameEn: "Fuangfa" },
  { surnameTh: "พูนผล", surnameEn: "Poonpol" },
  { surnameTh: "สายสมุทร", surnameEn: "Saisamut" },
  { surnameTh: "พรมบุตร", surnameEn: "Prombut" },
  { surnameTh: "มั่นคง", surnameEn: "Mankong" },
  { surnameTh: "อรุณรุ่ง", surnameEn: "Aroonrung" },
  { surnameTh: "หิรัญศักดิ์", surnameEn: "Hiranyasak" },
  { surnameTh: "องอาจ", surnameEn: "Ongart" },
  { surnameTh: "ลิ้มสกุล", surnameEn: "Limsakul" },
  { surnameTh: "หาญสมุทร", surnameEn: "Hansamut" },
  { surnameTh: "เทพรักษ์", surnameEn: "Thepprak" },
  { surnameTh: "ยอดมณี", surnameEn: "Yodmanee" },
  { surnameTh: "บุญมี", surnameEn: "Boonmee" },
  { surnameTh: "เอกรัตน์", surnameEn: "Ekkarat" },
  { surnameTh: "อุดมสิน", surnameEn: "Udomsin" },
  { surnameTh: "วงศ์ดี", surnameEn: "Wongdee" },
  { surnameTh: "เชิดชูไทย", surnameEn: "Cherdchoonthai" },
  { surnameTh: "ไชยมงคล", surnameEn: "Chaimongkol" },
  { surnameTh: "แสงทอง", surnameEn: "Saengthong" },
  { surnameTh: "บุญส่ง", surnameEn: "Boonsong" },
  { surnameTh: "ตั้งมั่น", surnameEn: "Tangman" },
  { surnameTh: "วัฒนา", surnameEn: "Wattana" },
  { surnameTh: "สุขใจ", surnameEn: "Sukjai" },
  { surnameTh: "เจริญผล", surnameEn: "Charoenphon" },
  { surnameTh: "พูลทรัพย์", surnameEn: "Poonsap" },
  { surnameTh: "แก้วประเสริฐ", surnameEn: "Kaewprasert" },
  { surnameTh: "ทองมาก", surnameEn: "Thongmak" },
  { surnameTh: "อินทร์แก้ว", surnameEn: "Inkaew" },
  { surnameTh: "สวัสดิ์ดี", surnameEn: "Sawasdee" },
  { surnameTh: "คงมั่น", surnameEn: "Kongman" },
  { surnameTh: "พงษ์ไพบูลย์", surnameEn: "Pongpaiboon" },
  { surnameTh: "มณีวงศ์", surnameEn: "Maneewong" },
  { surnameTh: "รุ่งวิไล", surnameEn: "Rungwilai" },
  { surnameTh: "ศรีสวัสดิ์", surnameEn: "Srisawat" },
  { surnameTh: "วงศ์เจริญ", surnameEn: "Wongcharoen" },
  { surnameTh: "เลิศวิทยา", surnameEn: "Lertwitthaya" },
  { surnameTh: "ธรรมรักษ์", surnameEn: "Thammarak" },
  { surnameTh: "เกียรติคุณ", surnameEn: "Kiatkhun" },
  { surnameTh: "พิพัฒน์ชัย", surnameEn: "Pipatchai" },
  { surnameTh: "อุดมทรัพย์", surnameEn: "Udomsap" },
];

const companyConfigs: Array<{
  company: EmployeeCompanyCode;
  baseCode: number;
}> = [
  { company: "ATA", baseCode: 1001 },
  { company: "ATFB", baseCode: 2101 },
  { company: "NIC", baseCode: 3201 },
  { company: "SATI", baseCode: 4301 },
  { company: "SNF", baseCode: 5401 },
  { company: "TEP", baseCode: 6501 },
];

const padDatePart = (value: number) => String(value).padStart(2, "0");

export const defaultEmployeeRows: EmployeeMasterRecord[] = companyConfigs.flatMap(
  ({ company, baseCode }, companyIndex) =>
    companySlots.map((slot, slotIndex) => {
      const nameIndex = (companyIndex * 7 + slotIndex) % thaiGivenNames.length;
      const surnameIndex = (companyIndex * 11 + slotIndex) % thaiSurnames.length;
      const given = thaiGivenNames[nameIndex];
      const surname = thaiSurnames[surnameIndex];

      const birthdayYear = 1978 + (slotIndex % 20);
      const birthdayMonth = (slotIndex % 12) + 1;
      const birthdayDay = (slotIndex % 27) + 1;

      const workdayYear = 2008 + (slotIndex % 16);
      const workdayMonth = ((slotIndex + 3) % 12) + 1;
      const workdayDay = ((slotIndex + 7) % 27) + 1;

      return createEmployee(company, baseCode + slotIndex, {
        nameTh: given.nameTh,
        surnameTh: surname.surnameTh,
        titleEn: given.title,
        nameEn: given.nameEn,
        surnameEn: surname.surnameEn,
        birthday: `${birthdayYear}-${padDatePart(birthdayMonth)}-${padDatePart(birthdayDay)}`,
        workday: `${workdayYear}-${padDatePart(workdayMonth)}-${padDatePart(workdayDay)}`,
        functionCode: slot.functionCode,
        functionName: slot.functionName,
        department: slot.department,
        positionName: slot.positionName,
        levelKey: slot.levelKey,
      });
    }),
);

export const normalizeEmployeeLevel = (levelKey: string) => {
  const normalized = levelKey.trim().toUpperCase();
  return normalized
    .replace(/^จ/, "M")
    .replace(/^บ/, "S")
    .replace(/^ป/, "O")
    .replace(/^L(?=\d)/, "O");
};

export const getLevelRank = (levelKey: string): number => {
  const raw = levelKey.trim();
  const thaiMatch = raw.match(/^([จจบป])(\d)$/);
  if (thaiMatch) {
    const code = thaiMatch[1];
    const num = parseInt(thaiMatch[2], 10);
    if (code === "จ") return 9 + num; // จ1=10, จ2=11, จ3=12, จ4=13
    if (code === "บ") return 5 + num; // บ1=6, บ2=7, บ3=8, บ4=9
    if (code === "ป") return num;     // ป1=1, ป2=2, ป3=3, ป4=4, ป5=5
  }

  const norm = normalizeEmployeeLevel(raw).toUpperCase();
  const engMatch = norm.match(/^([MSOL])(\d)$/);
  if (engMatch) {
    const code = engMatch[1];
    const num = parseInt(engMatch[2], 10);
    if (code === "M") return 9 + num; // M1=10..M4=13
    if (code === "S") return 5 + num; // S1=6..S4=9
    if (code === "O" || code === "L") return num; // O1=1..O5=5
  }
  return 0;
};

const EMPLOYEE_MASTER_SEED_VERSION_KEY = "tpm_master_employees_seed_version";
const EMPLOYEE_MASTER_SEED_VERSION = "2026-08-10-full-position-levels-v5";

export const readEmployeeMasterData = () => {
  if (typeof window === "undefined") {
    return defaultEmployeeRows;
  }

  const currentSeed = window.localStorage.getItem(EMPLOYEE_MASTER_SEED_VERSION_KEY);
  if (currentSeed !== EMPLOYEE_MASTER_SEED_VERSION) {
    window.localStorage.setItem(
      TRAINING_MASTER_KEYS.employees,
      JSON.stringify(defaultEmployeeRows),
    );
    window.localStorage.setItem(
      EMPLOYEE_MASTER_SEED_VERSION_KEY,
      EMPLOYEE_MASTER_SEED_VERSION,
    );
    return defaultEmployeeRows;
  }

  return readMasterCollection<EmployeeMasterRecord>(
    TRAINING_MASTER_KEYS.employees,
    defaultEmployeeRows,
  );
};

export const writeEmployeeMasterData = (records: EmployeeMasterRecord[]) => {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(
      EMPLOYEE_MASTER_SEED_VERSION_KEY,
      EMPLOYEE_MASTER_SEED_VERSION,
    );
  }

  writeMasterCollection(TRAINING_MASTER_KEYS.employees, records);
};
