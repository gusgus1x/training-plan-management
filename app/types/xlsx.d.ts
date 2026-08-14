declare module "xlsx" {
  export const utils: {
    json_to_sheet: (data: any[], opts?: any) => any;
    book_new: () => any;
    book_append_sheet: (workbook: any, worksheet: any, name?: string) => void;
    sheet_to_json: <T = any>(sheet: any, opts?: any) => T[];
  };
  export const read: (data: any, opts?: any) => any;
  export const writeFile: (workbook: any, filename: string, opts?: any) => void;
}
