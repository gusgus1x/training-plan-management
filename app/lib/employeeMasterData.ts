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

const baseEmployeeRows: EmployeeMasterRecord[] = [
  createEmployee("ATA", 1001, { nameTh: "อนันต์", surnameTh: "ศรีสุข", titleEn: "Mr.", nameEn: "Anan", surnameEn: "Srisuk", birthday: "1991-04-12", workday: "2018-06-01", functionCode: "FNC0010", functionName: "Production", department: "Production / Assembly", positionName: "Operator", levelKey: "ป3" }),
  createEmployee("ATA", 1002, { nameTh: "มาลี", surnameTh: "เกษมสุข", titleEn: "Ms.", nameEn: "Mali", surnameEn: "Kasemsuk", birthday: "1989-09-18", workday: "2016-03-14", functionCode: "FNC0013", functionName: "Quality", department: "Quality Assurance", positionName: "Engineer", levelKey: "บ2" }),
  createEmployee("ATA", 1003, { nameTh: "ภัทรพล", surnameTh: "เลิศปัญญา", titleEn: "Mr.", nameEn: "Pattarapon", surnameEn: "Lertpanya", birthday: "1988-02-21", workday: "2014-05-12", functionCode: "FNC0010", functionName: "Production", department: "Assembly", positionName: "Section Head", levelKey: "บ4" }),
  createEmployee("ATA", 1004, { nameTh: "รัชชานนท์", surnameTh: "พรสวัสดิ์", titleEn: "Mr.", nameEn: "Ratchanon", surnameEn: "Pornsawat", birthday: "1994-06-08", workday: "2020-07-01", functionCode: "FNC0012", functionName: "Engineering and Maintenance", department: "Maintenance", positionName: "Foreman", levelKey: "บ1" }),
  createEmployee("ATA", 1005, { nameTh: "ศรัณย์", surnameTh: "มีชัย", titleEn: "Mr.", nameEn: "Saran", surnameEn: "Meechai", birthday: "1998-01-17", workday: "2023-04-03", functionCode: "FNC0010", functionName: "Production", department: "Production", positionName: "Operator", levelKey: "ป1" }),
  createEmployee("ATA", 1006, { nameTh: "วิชชุดา", surnameTh: "ทองสว่าง", titleEn: "Ms.", nameEn: "Witchuda", surnameEn: "Thongsawang", birthday: "1985-03-15", workday: "2012-08-01", functionCode: "FNC0004", functionName: "Human Resource", department: "Human Resource", positionName: "General Manager", levelKey: "จ3" }),
  createEmployee("ATA", 1007, { nameTh: "ธนพัฒน์", surnameTh: "วิริยะกุล", titleEn: "Mr.", nameEn: "Thanapat", surnameEn: "Wiriyakul", birthday: "1990-11-20", workday: "2017-05-10", functionCode: "FNC0010", functionName: "Production", department: "Machining", positionName: "Senior Foreman", levelKey: "บ3" }),
  createEmployee("ATA", 1008, { nameTh: "พิมพ์วดี", surnameTh: "สุขประเสริฐ", titleEn: "Ms.", nameEn: "Pimwadee", surnameEn: "Sukprasert", birthday: "1993-07-08", workday: "2019-03-18", functionCode: "FNC0013", functionName: "Quality", department: "Quality Control", positionName: "Officer", levelKey: "บ2" }),

  createEmployee("ATFB", 2101, { nameTh: "สมชาย", surnameTh: "พร้อมใจ", titleEn: "Mr.", nameEn: "Somchai", surnameEn: "Promjai", birthday: "1987-07-03", workday: "2013-05-16", functionCode: "FNC0010", functionName: "Production", department: "Casting", positionName: "General Manager", levelKey: "จ1" }),
  createEmployee("ATFB", 2102, { nameTh: "นรินทร์", surnameTh: "ทองชัย", titleEn: "Mr.", nameEn: "Narin", surnameEn: "Thongchai", birthday: "1992-11-14", workday: "2019-01-07", functionCode: "FNC0012", functionName: "Engineering and Maintenance", department: "Maintenance", positionName: "Foreman", levelKey: "บ2" }),
  createEmployee("ATFB", 2103, { nameTh: "อรสา", surnameTh: "จันทร์ดี", titleEn: "Ms.", nameEn: "Orasa", surnameEn: "Jandee", birthday: "1990-10-27", workday: "2017-08-21", functionCode: "FNC0010", functionName: "Production", department: "Production", positionName: "Officer", levelKey: "บ3" }),
  createEmployee("ATFB", 2104, { nameTh: "ภาวิณี", surnameTh: "ศรีสุวรรณ", titleEn: "Ms.", nameEn: "Pawinee", surnameEn: "Srisuwan", birthday: "1993-03-09", workday: "2020-02-10", functionCode: "FNC0013", functionName: "Quality", department: "Quality Control", positionName: "Engineer", levelKey: "บ1" }),
  createEmployee("ATFB", 2105, { nameTh: "ดวงกมล", surnameTh: "เรืองฤทธิ์", titleEn: "Ms.", nameEn: "Duangkamol", surnameEn: "Ruangrit", birthday: "1997-12-05", workday: "2022-09-01", functionCode: "FNC0004", functionName: "Human Resource", department: "Recruitment", positionName: "Staff", levelKey: "ป2" }),
  createEmployee("ATFB", 2106, { nameTh: "ปิยะวัฒน์", surnameTh: "เดชาวุธ", titleEn: "Mr.", nameEn: "Piyawat", surnameEn: "Dechawut", birthday: "1983-09-25", workday: "2011-04-01", functionCode: "FNC0010", functionName: "Production", department: "Plant Management", positionName: "Plant Manager", levelKey: "จ2" }),
  createEmployee("ATFB", 2107, { nameTh: "ชลธิชา", surnameTh: "บุณยนิตย์", titleEn: "Ms.", nameEn: "Chonthicha", surnameEn: "Boonyanit", birthday: "1995-04-14", workday: "2021-02-22", functionCode: "FNC0008", functionName: "IT Promotion", department: "IT Promotion", positionName: "Staff", levelKey: "ป3" }),

  createEmployee("NIC", 3201, { nameTh: "กานดา", surnameTh: "รุ่งเรือง", titleEn: "Ms.", nameEn: "Kanda", surnameEn: "Rungrueang", birthday: "1992-05-30", workday: "2020-04-01", functionCode: "FNC0013", functionName: "Quality", department: "Quality Control", positionName: "Officer", levelKey: "บ3" }),
  createEmployee("NIC", 3202, { nameTh: "ปรีชา", surnameTh: "วงศ์สว่าง", titleEn: "Mr.", nameEn: "Preecha", surnameEn: "Wongsawang", birthday: "1988-01-14", workday: "2015-09-07", functionCode: "FNC0010", functionName: "Production", department: "Production", positionName: "Operator", levelKey: "ป1" }),
  createEmployee("NIC", 3203, { nameTh: "ศิริลักษณ์", surnameTh: "เดชาพงศ์", titleEn: "Ms.", nameEn: "Sirilak", surnameEn: "Dechapong", birthday: "1986-09-23", workday: "2012-11-05", functionCode: "FNC0009", functionName: "Warehouse", department: "Logistics", positionName: "Senior General Manager", levelKey: "จ3" }),
  createEmployee("NIC", 3204, { nameTh: "ฐิติวัฒน์", surnameTh: "คงแก้ว", titleEn: "Mr.", nameEn: "Thitiwat", surnameEn: "Kongkaew", birthday: "1996-04-19", workday: "2021-06-14", functionCode: "FNC0010", functionName: "Production", department: "Production", positionName: "Operator", levelKey: "ป2" }),
  createEmployee("NIC", 3205, { nameTh: "พงศกร", surnameTh: "อินทรพร", titleEn: "Mr.", nameEn: "Pongsakorn", surnameEn: "Intaraporn", birthday: "1991-08-12", workday: "2018-10-01", functionCode: "FNC0014", functionName: "Safety and Environment", department: "Safety", positionName: "Staff", levelKey: "ป4" }),
  createEmployee("NIC", 3206, { nameTh: "รัตนาภรณ์", surnameTh: "พรมมินทร์", titleEn: "Ms.", nameEn: "Rattanaporn", surnameEn: "Phrommint", birthday: "1989-12-01", workday: "2016-07-15", functionCode: "FNC0012", functionName: "Engineering and Maintenance", department: "Maintenance", positionName: "Senior Foreman", levelKey: "บ3" }),
  createEmployee("NIC", 3207, { nameTh: "วรากร", surnameTh: "สมบัติ", titleEn: "Mr.", nameEn: "Warakorn", surnameEn: "Sombat", birthday: "1984-06-17", workday: "2010-11-01", functionCode: "FNC0010", functionName: "Production", department: "Operations", positionName: "Vice President", levelKey: "จ3" }),

  createEmployee("SATI", 4301, { nameTh: "วิภาดา", surnameTh: "ชัยพร", titleEn: "Ms.", nameEn: "Wipada", surnameEn: "Chaiporn", birthday: "1994-08-11", workday: "2022-02-15", functionCode: "FNC0012", functionName: "Engineering and Maintenance", department: "Engineering", positionName: "Engineer", levelKey: "บ1" }),
  createEmployee("SATI", 4302, { nameTh: "ชัยวัฒน์", surnameTh: "นิลประภา", titleEn: "Mr.", nameEn: "Chaiwat", surnameEn: "Nilprapa", birthday: "1986-11-04", workday: "2014-12-01", functionCode: "FNC0010", functionName: "Production", department: "Production", positionName: "Manager", levelKey: "จ2" }),
  createEmployee("SATI", 4303, { nameTh: "ณัฐธิดา", surnameTh: "วิชัย", titleEn: "Ms.", nameEn: "Nattida", surnameEn: "Vichai", birthday: "1990-02-26", workday: "2017-01-09", functionCode: "FNC0013", functionName: "Quality", department: "Quality Assurance", positionName: "Officer", levelKey: "บ3" }),
  createEmployee("SATI", 4304, { nameTh: "อารีวรรณ", surnameTh: "เฟื่องฟ้า", titleEn: "Ms.", nameEn: "Areewan", surnameEn: "Fuangfa", birthday: "1989-06-15", workday: "2015-07-20", functionCode: "FNC0010", functionName: "Production", department: "Casting", positionName: "Section Head", levelKey: "บ4" }),
  createEmployee("SATI", 4305, { nameTh: "ธีรภัทร", surnameTh: "พูนผล", titleEn: "Mr.", nameEn: "Teerapat", surnameEn: "Poonpol", birthday: "1997-10-02", workday: "2023-03-01", functionCode: "FNC0008", functionName: "IT Promotion", department: "IT Support", positionName: "Staff", levelKey: "ป3" }),
  createEmployee("SATI", 4306, { nameTh: "ธนาพร", surnameTh: "สายสมุทร", titleEn: "Ms.", nameEn: "Thanaporn", surnameEn: "Saisamut", birthday: "1982-04-28", workday: "2009-10-01", functionCode: "FNC0010", functionName: "Production", department: "Executive Office", positionName: "Executive Vice President", levelKey: "จ3" }),
  createEmployee("SATI", 4307, { nameTh: "สรวิชญ์", surnameTh: "พรมบุตร", titleEn: "Mr.", nameEn: "Sorawich", surnameEn: "Prombut", birthday: "1996-01-09", workday: "2022-06-15", functionCode: "FNC0014", functionName: "Safety and Environment", department: "Safety", positionName: "Leader", levelKey: "ป5" }),

  createEmployee("SNF", 5401, { nameTh: "สุดา", surnameTh: "มั่นคง", titleEn: "Ms.", nameEn: "Suda", surnameEn: "Mankong", birthday: "1996-03-19", workday: "2023-06-05", functionCode: "FNC0014", functionName: "Safety and Environment", department: "Safety", positionName: "Staff", levelKey: "ป3" }),
  createEmployee("SNF", 5402, { nameTh: "กฤต", surnameTh: "อรุณรุ่ง", titleEn: "Mr.", nameEn: "Krit", surnameEn: "Aroonrung", birthday: "1991-06-25", workday: "2018-10-10", functionCode: "FNC0010", functionName: "Production", department: "Production", positionName: "Operator", levelKey: "ป2" }),
  createEmployee("SNF", 5403, { nameTh: "วริศ", surnameTh: "หิรัญศักดิ์", titleEn: "Mr.", nameEn: "Warit", surnameEn: "Hiranyasak", birthday: "1988-12-18", workday: "2015-03-02", functionCode: "FNC0010", functionName: "Production", department: "Production", positionName: "Officer", levelKey: "บ3" }),
  createEmployee("SNF", 5404, { nameTh: "จิรวัฒน์", surnameTh: "องอาจ", titleEn: "Mr.", nameEn: "Jirawat", surnameEn: "Ongart", birthday: "1993-09-07", workday: "2019-08-05", functionCode: "FNC0012", functionName: "Engineering and Maintenance", department: "Engineering", positionName: "Engineer", levelKey: "บ2" }),
  createEmployee("SNF", 5405, { nameTh: "ณิชา", surnameTh: "ลิ้มสกุล", titleEn: "Ms.", nameEn: "Nicha", surnameEn: "Limsakul", birthday: "1995-05-28", workday: "2021-11-15", functionCode: "FNC0010", functionName: "Production", department: "Assembly", positionName: "Leader", levelKey: "ป5" }),
  createEmployee("SNF", 5406, { nameTh: "ประภาพร", surnameTh: "หาญสมุทร", titleEn: "Ms.", nameEn: "Prapaporn", surnameEn: "Hansamut", birthday: "1984-02-11", workday: "2011-06-01", functionCode: "FNC0004", functionName: "Human Resource", department: "HR & Admin", positionName: "Executive General Manager", levelKey: "จ3" }),
  createEmployee("SNF", 5407, { nameTh: "วุฒิพงศ์", surnameTh: "เทพรักษ์", titleEn: "Mr.", nameEn: "Wuttipong", surnameEn: "Thepprak", birthday: "1992-08-30", workday: "2020-01-20", functionCode: "FNC0009", functionName: "Warehouse", department: "Warehouse", positionName: "Senior Foreman", levelKey: "บ3" }),

  createEmployee("TEP", 6501, { nameTh: "เบญจมาศ", surnameTh: "ยอดมณี", titleEn: "Ms.", nameEn: "Benjamas", surnameEn: "Yodmanee", birthday: "1995-12-22", workday: "2021-01-08", functionCode: "FNC0010", functionName: "Production", department: "Production", positionName: "Operator", levelKey: "ป2" }),
  createEmployee("TEP", 6502, { nameTh: "ธนกร", surnameTh: "บุญมี", titleEn: "Mr.", nameEn: "Thanakorn", surnameEn: "Boonmee", birthday: "1993-02-07", workday: "2019-11-20", functionCode: "FNC0012", functionName: "Engineering and Maintenance", department: "Engineering", positionName: "Foreman", levelKey: "บ3" }),
  createEmployee("TEP", 6503, { nameTh: "พิมพ์ชนก", surnameTh: "เอกรัตน์", titleEn: "Ms.", nameEn: "Phimchanok", surnameEn: "Ekkarat", birthday: "1987-04-30", workday: "2013-08-19", functionCode: "FNC0010", functionName: "Production", department: "Process", positionName: "Section Head", levelKey: "บ4" }),
  createEmployee("TEP", 6504, { nameTh: "กนกวรรณ", surnameTh: "อุดมสิน", titleEn: "Ms.", nameEn: "Kanokwan", surnameEn: "Udomsin", birthday: "1992-07-16", workday: "2018-09-03", functionCode: "FNC0013", functionName: "Quality", department: "Quality Control", positionName: "Officer", levelKey: "บ2" }),
  createEmployee("TEP", 6505, { nameTh: "ณัฐพล", surnameTh: "วงศ์ดี", titleEn: "Mr.", nameEn: "Nattapol", surnameEn: "Wongdee", birthday: "1998-11-09", workday: "2024-01-08", functionCode: "FNC0009", functionName: "Warehouse", department: "Warehouse", positionName: "Staff", levelKey: "ป1" }),
  createEmployee("TEP", 6506, { nameTh: "อรรถพร", surnameTh: "เชิดชูไทย", titleEn: "Mr.", nameEn: "Arthaporn", surnameEn: "Cherdchoonthai", birthday: "1980-07-04", workday: "2008-03-01", functionCode: "FNC0010", functionName: "Production", department: "Operations", positionName: "Vice President", levelKey: "จ3" }),
  createEmployee("TEP", 6507, { nameTh: "ศุภลักษณ์", surnameTh: "ไชยมงคล", titleEn: "Ms.", nameEn: "Supalak", surnameEn: "Chaimongkol", birthday: "1994-09-19", workday: "2020-11-05", functionCode: "FNC0013", functionName: "Quality", department: "Quality Assurance", positionName: "Engineer", levelKey: "บ1" }),
];

const additionalGivenNames = [
  { nameTh: "กิตติ", nameEn: "Kitti" },
  { nameTh: "ชนาธิป", nameEn: "Chanathip" },
  { nameTh: "ณรงค์", nameEn: "Narong" },
  { nameTh: "ธนภัทร", nameEn: "Thanapat" },
  { nameTh: "นพดล", nameEn: "Noppadon" },
  { nameTh: "ปกรณ์", nameEn: "Pakorn" },
  { nameTh: "พีรพัฒน์", nameEn: "Peerapat" },
  { nameTh: "ภูริณัฐ", nameEn: "Purinat" },
  { nameTh: "วรชัย", nameEn: "Worachai" },
  { nameTh: "สิทธิชัย", nameEn: "Sittichai" },
  { nameTh: "อัครพล", nameEn: "Akarapol" },
  { nameTh: "กัญญารัตน์", nameEn: "Kanyarat" },
  { nameTh: "จิราภา", nameEn: "Jirapa" },
  { nameTh: "ชลธิชา", nameEn: "Chonthicha" },
  { nameTh: "ณัฐชา", nameEn: "Natcha" },
  { nameTh: "ปวีณา", nameEn: "Paweena" },
  { nameTh: "พัชรินทร์", nameEn: "Patcharin" },
  { nameTh: "รัตนา", nameEn: "Rattana" },
  { nameTh: "วรรณวิสา", nameEn: "Wanvisa" },
  { nameTh: "ศศิธร", nameEn: "Sasithorn" },
  { nameTh: "สุภาวดี", nameEn: "Supawadee" },
  { nameTh: "อรทัย", nameEn: "Orathai" },
  { nameTh: "อัญชลี", nameEn: "Anchalee" },
] as const;

const additionalSurnames = [
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
  { surnameTh: "ชัยมงคล", surnameEn: "Chaimongkol" },
  { surnameTh: "ศรีสวัสดิ์", surnameEn: "Srisawat" },
  { surnameTh: "วงศ์เจริญ", surnameEn: "Wongcharoen" },
  { surnameTh: "เลิศวิทยา", surnameEn: "Lertwitthaya" },
  { surnameTh: "ธรรมรักษ์", surnameEn: "Thammarak" },
  { surnameTh: "เกียรติคุณ", surnameEn: "Kiatkhun" },
  { surnameTh: "พิพัฒน์ชัย", surnameEn: "Pipatchai" },
  { surnameTh: "อุดมทรัพย์", surnameEn: "Udomsap" },
] as const;

const functionProfiles = [
  { functionCode: "FNC0010", functionName: "Production", department: "Production / Assembly" },
  { functionCode: "FNC0013", functionName: "Quality", department: "Quality Assurance" },
  { functionCode: "FNC0012", functionName: "Engineering and Maintenance", department: "Maintenance" },
  { functionCode: "FNC0014", functionName: "Safety and Environment", department: "Safety & Environment" },
  { functionCode: "FNC0009", functionName: "คลังสินค้า", department: "Warehouse" },
  { functionCode: "FNC0004", functionName: "Human Resource", department: "Human Resource" },
  { functionCode: "FNC0008", functionName: "IT Promotion", department: "IT Promotion" },
  { functionCode: "FNC0011", functionName: "Production Planing", department: "Planning" },
] as const;

const positionLevelProfiles = [
  { positionName: "Operator", levelKey: "ป1" },
  { positionName: "Operator", levelKey: "ป2" },
  { positionName: "Staff", levelKey: "ป3" },
  { positionName: "Leader", levelKey: "ป4" },
  { positionName: "Leader", levelKey: "ป5" },
  { positionName: "Engineer", levelKey: "บ1" },
  { positionName: "Foreman", levelKey: "บ2" },
  { positionName: "Senior Foreman", levelKey: "บ2" },
  { positionName: "Officer", levelKey: "บ3" },
  { positionName: "Section Head", levelKey: "บ4" },
  { positionName: "Manager", levelKey: "จ1" },
  { positionName: "General Manager", levelKey: "จ2" },
  { positionName: "Senior General Manager", levelKey: "จ3" },
  { positionName: "Executive General Manager", levelKey: "จ3" },
  { positionName: "Plant Manager", levelKey: "จ3" },
  { positionName: "Senior Executive Coordinator", levelKey: "จ3" },
  { positionName: "Advisor", levelKey: "จ3" },
  { positionName: "Senior Advisor", levelKey: "จ4" },
  { positionName: "Vice President", levelKey: "จ4" },
  { positionName: "Executive Vice President", levelKey: "จ4" },
  { positionName: "President", levelKey: "จ4" },
] as const;

const companyGenerationProfiles: Array<{
  company: EmployeeCompanyCode;
  firstSequence: number;
}> = [
  { company: "ATA", firstSequence: 1009 },
  { company: "ATFB", firstSequence: 2108 },
  { company: "NIC", firstSequence: 3208 },
  { company: "SATI", firstSequence: 4308 },
  { company: "SNF", firstSequence: 5408 },
  { company: "TEP", firstSequence: 6508 },
];

const padDatePart = (value: number) => String(value).padStart(2, "0");

const generatedEmployeeRows = companyGenerationProfiles.flatMap(
  ({ company, firstSequence }, companyIndex) =>
    additionalGivenNames.map((givenName, employeeIndex) => {
      const surname =
        additionalSurnames[
          (employeeIndex + companyIndex * 4) % additionalSurnames.length
        ];
      const employeeOffset = employeeIndex + companyIndex * 3;
      const functionProfile =
        functionProfiles[employeeOffset % functionProfiles.length];
      const positionLevel =
        positionLevelProfiles[employeeOffset % positionLevelProfiles.length];
      const birthdayYear = 1985 + (employeeOffset % 15);
      const birthdayMonth = (employeeOffset % 12) + 1;
      const birthdayDay = (employeeOffset % 27) + 1;
      const workdayYear = 2012 + (employeeOffset % 13);
      const workdayMonth = ((employeeOffset + 4) % 12) + 1;
      const workdayDay = ((employeeOffset + 8) % 27) + 1;

      return createEmployee(company, firstSequence + employeeIndex, {
        nameTh: givenName.nameTh,
        surnameTh: surname.surnameTh,
        titleEn: (employeeIndex + companyIndex) % 2 === 0 ? "Mr." : "Ms.",
        nameEn: givenName.nameEn,
        surnameEn: surname.surnameEn,
        birthday: `${birthdayYear}-${padDatePart(birthdayMonth)}-${padDatePart(birthdayDay)}`,
        workday: `${workdayYear}-${padDatePart(workdayMonth)}-${padDatePart(workdayDay)}`,
        ...functionProfile,
        ...positionLevel,
      });
    }),
);

export const defaultEmployeeRows: EmployeeMasterRecord[] = [
  ...baseEmployeeRows,
  ...generatedEmployeeRows,
];

export const normalizeEmployeeLevel = (levelKey: string) => {
  const normalized = levelKey.trim().toUpperCase();
  return normalized
    .replace(/^จ/, "M")
    .replace(/^บ/, "S")
    .replace(/^ป/, "O")
    .replace(/^L(?=\d)/, "O");
};

const EMPLOYEE_MASTER_SEED_VERSION_KEY = "tpm_master_employees_seed_version";
const EMPLOYEE_MASTER_SEED_VERSION = "2026-08-10-position-v4";

export const readEmployeeMasterData = () => {
  const storedRows = readMasterCollection<EmployeeMasterRecord>(
    TRAINING_MASTER_KEYS.employees,
    defaultEmployeeRows,
  );

  if (
    typeof window === "undefined" ||
    window.localStorage.getItem(EMPLOYEE_MASTER_SEED_VERSION_KEY) ===
      EMPLOYEE_MASTER_SEED_VERSION
  ) {
    return storedRows;
  }

  const storedEmployeeCodes = new Set(storedRows.map((row) => row.empCode));
  const migratedRows = [
    ...storedRows.map((storedRow) => {
      if (!storedRow.department) {
        const defaultMatch = defaultEmployeeRows.find(
          (d) => d.empCode === storedRow.empCode,
        );
        return {
          ...storedRow,
          department: defaultMatch?.department || storedRow.functionName || "",
        };
      }
      return storedRow;
    }),
    ...defaultEmployeeRows.filter(
      (defaultRow) => !storedEmployeeCodes.has(defaultRow.empCode),
    ),
  ];
  window.localStorage.setItem(
    TRAINING_MASTER_KEYS.employees,
    JSON.stringify(migratedRows),
  );
  window.localStorage.setItem(
    EMPLOYEE_MASTER_SEED_VERSION_KEY,
    EMPLOYEE_MASTER_SEED_VERSION,
  );
  return migratedRows;
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
