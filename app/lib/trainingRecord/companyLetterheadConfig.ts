export type CompanyLetterheadCode = "ATA" | "ATFB" | "NIC" | "SATI" | "SNF" | "TEP";

export type CompanyLetterheadInfo = {
  code: CompanyLetterheadCode;
  nameTh: string;
  nameEn: string;
  logoUrl: string;
  addressTh: string;
  addressEn: string;
  tel: string;
  fax: string;
  standardNote?: string;
  templateFileName: string;
};

export const COMPANY_LETTERHEADS: Record<CompanyLetterheadCode, CompanyLetterheadInfo> = {
  ATA: {
    code: "ATA",
    nameTh: "บริษัท ไอชิน ทากาโอกะ เอเชีย จำกัด",
    nameEn: "AISIN TAKAOKA ASIA CO., LTD.",
    logoUrl: "/images/company-letterheads/ata-logo.png",
    addressTh: "สำนักงานใหญ่ : 700/89 หมู่ 1 นิคมอุตสาหกรรมอมตะนคร ต.บ้านเก่า อ.พานทอง จ.ชลบุรี 20160",
    addressEn: "HEAD OFFICE : 700/89 Moo 1, Amatanakorn Industrial Estate, T. Bankao, A. Phanthong, Chonburi 20160",
    tel: "(66-38) 454-983-7",
    fax: "(66-38) 454-988",
    standardNote: "human resource development",
    templateFileName: "AT-A กระดาษหัว.docx",
  },
  ATFB: {
    code: "ATFB",
    nameTh: "บริษัท ไอซิน ทาคาโอก้า ฟาวน์ดริ บางปะกง จำกัด",
    nameEn: "AISIN TAKAOKA FOUNDRY BANGPAKONG CO., LTD.",
    logoUrl: "/images/company-letterheads/atfb-logo.png",
    addressTh: "700/89 หมู่ 1 ต.บ้านเก่า อ.พานทอง จ.ชลบุรี 20160",
    addressEn: "700/89 Moo 1, Bankao, Phanthong, Chonburi 20160",
    tel: "(66-38) 454-671-3",
    fax: "(66-38) 454-670",
    standardNote: "IATF 16949 : 2016 | ISO 45001 : 2018 | ISO 14001 : 2015",
    templateFileName: "ATFB กระดาษหัว.docx",
  },
  NIC: {
    code: "NIC",
    nameTh: "บริษัท นวโลหะอุตสาหกรรม จำกัด",
    nameEn: "THE NAWALOHA INDUSTRY CO., LTD.",
    logoUrl: "/images/company-letterheads/nic-logo.png",
    addressTh: "19 หมู่ 3 ถนนสุวรรณศร ต.บัวลอย อ.หนองแค จ.สระบุรี 18230",
    addressEn: "19 Moo 3 Suwannasorn Rd., Tamboon Bualoy, Amphur Nongkhae, Saraburi 18230",
    tel: "(036) 383561, (085) 4846450-4",
    fax: "(036) 383564, 336534",
    templateFileName: "NIC กระดาษหัว.docx",
  },
  SATI: {
    code: "SATI",
    nameTh: "บริษัท สยามเอทีอุตสาหกรรม จำกัด",
    nameEn: "Siam AT Industry Co., Ltd.",
    logoUrl: "/images/company-letterheads/sati-logo.png",
    addressTh: "นิคมอุตสาหกรรมอมตะนคร 700/463 หมู่ 7 ต.ดอนหัวฬ่อ อ.เมือง จ.ชลบุรี 20000",
    addressEn: "Amata Nakorn Industrial Estate 700/463 Moo 7, Donhuaroh, Amphur Muang, Chonburi 20000",
    tel: "(038) 454-266",
    fax: "(038) 454-259-60",
    templateFileName: "SATI new กระดาษหัว.docx",
  },
  SNF: {
    code: "SNF",
    nameTh: "บริษัท นวโลหะไทย จำกัด",
    nameEn: "THE SIAM NAWALOHA FOUNDRY CO., LTD.",
    logoUrl: "/images/company-letterheads/snf-logo.png",
    addressTh: "1 หมู่ 9 ต.บ้านครัว อ.บ้านหมอ จ.สระบุรี 18270",
    addressEn: "1 Moo 9, Bankrua, Banmhor, Saraburi 18270, Thailand",
    tel: "66-3628-8300, 66-3628-8319",
    fax: "66-3628-8308, 66-3628-8309",
    standardNote: "ISO/TS16949 | ISO9001 | ISO14001 | OHSAS18001",
    templateFileName: "SNF กระดาษหัว.docx",
  },
  TEP: {
    code: "TEP",
    nameTh: "บริษัท ผลิตภัณฑ์วิศวไทย จำกัด",
    nameEn: "THAI ENGINEERING PRODUCTS CO., LTD.",
    logoUrl: "/images/company-letterheads/tep-logo.png",
    addressTh: "101/90 ม.20 นิคมอุตสาหกรรมนวนคร ถ.พหลโยธิน ต.คลองหนึ่ง อ.คลองหลวง จ.ปทุมธานี 12120",
    addressEn: "101/90 Moo 20 Navanakorn Industrial Estate, Phaholyothin Rd., Khlong Nueng, Khlong Luang, Pathum Thani 12120",
    tel: "+66 (0) 2909-1724~33",
    fax: "+66 (0) 2529-1676, 2529-3488",
    templateFileName: "TEP กระดาษหัว.docx",
  },
};

export const resolveCompanyLetterhead = (rawCode?: string | null): CompanyLetterheadInfo => {
  if (!rawCode) return COMPANY_LETTERHEADS.ATA;
  const clean = rawCode.trim().toUpperCase();
  if (clean.includes("ATFB")) return COMPANY_LETTERHEADS.ATFB;
  if (clean.includes("ATA") || clean.includes("AT-A")) return COMPANY_LETTERHEADS.ATA;
  if (clean.includes("NIC")) return COMPANY_LETTERHEADS.NIC;
  if (clean.includes("SATI")) return COMPANY_LETTERHEADS.SATI;
  if (clean.includes("SNF")) return COMPANY_LETTERHEADS.SNF;
  if (clean.includes("TEP")) return COMPANY_LETTERHEADS.TEP;
  return COMPANY_LETTERHEADS.ATA;
};
