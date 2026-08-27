export type ImportType="PRODUCTS"|"CUSTOMERS"|"SALES";
export interface ImportError {row_number:number;row_data:Record<string,string>;error_type:string;message:string}
export interface ImportJob {id:number;import_type:ImportType;filename:string;status:string;total_records:number;valid_records:number;successful_records:number;failed_records:number;duplicate_records:number;columns:string[];preview:Record<string,string>[];errors:ImportError[];created_at:string|null;completed_at:string|null;uploaded_by_name:string|null}
