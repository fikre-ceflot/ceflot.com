import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

interface RequisitionData {
  projectName: string;
  projectCode: string;
  location: string;
  clientName: string;
  expectedDelivery: string;
  projectStatus: string;
  resourceDetail: string;
  refNo: string;
  date: string;
  items: {
    description: string;
    unit: string;
    quantity: number;
    rate: number;
    remark?: string;
  }[];
}

export const exportMaterialRequisition = async (data: RequisitionData) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Requisition');

  // Set column widths
  worksheet.columns = [
    { width: 5 },  // No
    { width: 35 }, // Item Description
    { width: 10 }, // Unit
    { width: 10 }, // QTY
    { width: 12 }, // Rate
    { width: 15 }, // Amount
    { width: 20 }, // Remark
    { width: 10 }, // CHECK BOX
  ];

  // Title Section
  worksheet.mergeCells('A1', 'H1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = 'SUNSHINE TE. CO. LTD';
  titleCell.font = { size: 16, bold: true };
  titleCell.alignment = { horizontal: 'center' };

  worksheet.mergeCells('A3', 'H3');
  const subtitleCell = worksheet.getCell('A3');
  subtitleCell.value = 'MATERIAL REQUISITION REQUEST';
  subtitleCell.font = { size: 14, bold: true, underline: true };
  subtitleCell.alignment = { horizontal: 'center' };

  // Info Section
  const setInfoRow = (row: number, label1: string, val1: string, label2: string, val2: string) => {
    worksheet.getCell(`A${row}`).value = label1;
    worksheet.getCell(`A${row}`).font = { bold: true };
    worksheet.getCell(`B${row}`).value = val1;
    
    worksheet.getCell(`E${row}`).value = label2;
    worksheet.getCell(`E${row}`).font = { bold: true };
    worksheet.getCell(`F${row}`).value = val2;
  };

  setInfoRow(5, 'Date:', data.date, 'Ref No:', data.refNo);
  setInfoRow(7, 'Projects Name:', data.projectName, 'Project Code:', data.projectCode);
  setInfoRow(9, 'Location:', data.location, 'Client Name:', data.clientName);
  
  worksheet.getCell('A11').value = 'Expected Delivery Date:';
  worksheet.getCell('A11').font = { bold: true };
  worksheet.getCell('B11').value = data.expectedDelivery;

  worksheet.getCell('A13').value = 'Project Status:';
  worksheet.getCell('A13').font = { bold: true };
  worksheet.getCell('B13').value = data.projectStatus;

  worksheet.getCell('E13').value = 'Resource Detail:';
  worksheet.getCell('E13').font = { bold: true };
  worksheet.getCell('F13').value = data.resourceDetail;

  // Table Header
  const headerRow = worksheet.getRow(15);
  headerRow.values = ['No', 'Item Description', 'Unit', 'QTY', 'Rate', 'Amount', 'Remark', 'CHECK BOX'];
  headerRow.font = { bold: true };
  headerRow.eachCell((cell) => {
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };
  });

  // Table Body
  let currentRow = 16;
  data.items.forEach((item, index) => {
    const row = worksheet.getRow(currentRow);
    row.values = [
      index + 1,
      item.description,
      item.unit,
      item.quantity,
      item.rate,
      item.quantity * item.rate,
      item.remark || '',
      ''
    ];
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });
    // Format currency columns
    row.getCell(5).numFmt = '#,##0.00';
    row.getCell(6).numFmt = '#,##0.00';
    currentRow++;
  });

  // Footer Section
  const footerStart = currentRow + 2;
  worksheet.getCell(`A${footerStart}`).value = 'Declaration: I hereby declare that the above mentioned materials are required for the project and will be used solely for the project purpose.';
  worksheet.getCell(`A${footerStart}`).font = { italic: true, size: 10 };
  worksheet.mergeCells(`A${footerStart}`, `H${footerStart}`);

  const signRow = footerStart + 4;
  worksheet.getCell(`A${signRow}`).value = 'Requested By:';
  worksheet.getCell(`A${signRow}`).font = { bold: true };
  
  worksheet.getCell(`D${signRow}`).value = 'Authorized By:';
  worksheet.getCell(`D${signRow}`).font = { bold: true };

  worksheet.getCell(`G${signRow}`).value = 'Received By:';
  worksheet.getCell(`G${signRow}`).font = { bold: true };

  const signLineRow = signRow + 2;
  worksheet.getCell(`A${signLineRow}`).value = '____________________';
  worksheet.getCell(`D${signLineRow}`).value = '____________________';
  worksheet.getCell(`G${signLineRow}`).value = '____________________';

  worksheet.getCell(`A${signLineRow + 1}`).value = '(Project Manager / Site Engineer)';
  worksheet.getCell(`A${signLineRow+1}`).font = { size: 8 };
  worksheet.getCell(`D${signLineRow + 1}`).value = '(Procurement / Director)';
  worksheet.getCell(`D${signLineRow+1}`).font = { size: 8 };
  worksheet.getCell(`G${signLineRow + 1}`).value = '(Store Keeper / Site Clerk)';
  worksheet.getCell(`G${signLineRow+1}`).font = { size: 8 };

  // Write and Save
  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), `Material_Requisition_${data.refNo}.xlsx`);
};

export const exportMaterialList = async (projectName: string, items: any[]) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Material List');

  // Very similar format but slightly different headers maybe?
  // User said "material list and resource requisition"
  // I'll use a similar professional format for both.

  worksheet.columns = [
    { width: 5 },  // No
    { width: 15 }, // Code
    { width: 35 }, // Description
    { width: 10 }, // Unit
    { width: 12 }, // Rate
    { width: 20 }, // Category
  ];

  worksheet.mergeCells('A1', 'F1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = 'SUNSHINE TE. CO. LTD';
  titleCell.font = { size: 16, bold: true };
  titleCell.alignment = { horizontal: 'center' };

  worksheet.mergeCells('A2', 'F2');
  const subtitleCell = worksheet.getCell('A2');
  subtitleCell.value = `MATERIAL LIST - ${projectName.toUpperCase()}`;
  subtitleCell.font = { size: 12, bold: true };
  subtitleCell.alignment = { horizontal: 'center' };

  const headerRow = worksheet.getRow(4);
  headerRow.values = ['No', 'Code', 'Description', 'Unit', 'Rate', 'Category'];
  headerRow.font = { bold: true };
  headerRow.eachCell(cell => {
     cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
     cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
  });

  items.forEach((item, idx) => {
    const row = worksheet.addRow([
      idx + 1,
      item.code || item.material_code || '',
      item.name || item.material_name || item.description || '',
      item.unit || '',
      item.base_rate || item.unit_rate || 0,
      item.category || ''
    ]);
    row.eachCell(cell => {
      cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
    });
    row.getCell(5).numFmt = '#,##0.00';
  });

  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), `Material_List_${projectName.replace(/\s+/g, '_')}.xlsx`);
};
