import React, { useState } from 'react';
import apiClient from '../api/client';

interface CsvRow {
  fullName: string;
  indexNumber: string;
}

interface CsvImportModalProps {
  title?: string;
  classId?: string; // If undefined, modal displays a class selection dropdown
  classes?: Array<{ id: string; name: string }>;
  apiEndpoint: string; // e.g. '/admins/students/import-csv' or '/course-rep/my-class/students/import-csv'
  onClose: () => void;
  onSuccess: () => void;
}

export default function CsvImportModal({
  title = 'Import Students via CSV',
  classId: fixedClassId,
  classes = [],
  apiEndpoint,
  onClose,
  onSuccess,
}: CsvImportModalProps) {
  const [selectedClassId, setSelectedClassId] = useState(fixedClassId || (classes[0]?.id ?? ''));
  const [parsedRows, setParsedRows] = useState<CsvRow[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resultMessage, setResultMessage] = useState<string>('');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setError('');
    setResultMessage('');

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) throw new Error('File appears to be empty.');

        const lines = text
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter((l) => l.length > 0);

        if (lines.length < 2) {
          throw new Error('CSV must contain a header row and at least one student row.');
        }

        // Parse header
        const rawHeaders = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/['"]/g, ''));
        let nameIdx = rawHeaders.findIndex((h) =>
          ['fullname', 'full_name', 'name', 'student_name', 'studentname'].includes(h),
        );
        let indexIdx = rawHeaders.findIndex((h) =>
          ['indexnumber', 'index_number', 'index', 'id', 'student_id', 'studentid', 'roll_no'].includes(h),
        );

        // Fallback: if header not explicitly recognized, default col 0 to name, col 1 to index
        if (nameIdx === -1 && indexIdx === -1 && rawHeaders.length >= 2) {
          nameIdx = 0;
          indexIdx = 1;
        } else if (nameIdx === -1) {
          nameIdx = rawHeaders.length > 1 && indexIdx === 0 ? 1 : 0;
        } else if (indexIdx === -1) {
          indexIdx = nameIdx === 0 ? 1 : 0;
        }

        const rows: CsvRow[] = [];
        for (let i = 1; i < lines.length; i++) {
          // basic csv split respecting unescaped commas
          const parts = lines[i].split(',').map((p) => p.trim().replace(/^["']|["']$/g, ''));
          const fullName = parts[nameIdx] || '';
          const indexNumber = parts[indexIdx] || '';

          if (fullName && indexNumber) {
            rows.push({ fullName, indexNumber });
          }
        }

        if (rows.length === 0) {
          throw new Error('No valid student rows found. Please check column format (fullName, indexNumber).');
        }

        setParsedRows(rows);
      } catch (err: any) {
        setError(err.message || 'Failed to parse CSV file');
        setParsedRows([]);
      }
    };
    reader.readAsText(file);
  };

  const handleDownloadTemplate = () => {
    const csvContent = 'data:text/csv;charset=utf-8,fullName,indexNumber\nKwame Mensah,10293847\nAbena Osei,10293848\nKofi Boateng,10293849';
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'trumark_roster_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedRows.length === 0) {
      setError('Please choose a valid CSV file first.');
      return;
    }
    if (!fixedClassId && !selectedClassId) {
      setError('Please select an enrolled class.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const payload: any = { rows: parsedRows };
      if (!fixedClassId) {
        payload.classId = selectedClassId;
      }

      const res = await apiClient.post(apiEndpoint, payload);
      const { importedCount, duplicatesSkipped, errors = [] } = res.data;

      setResultMessage(
        `Successfully imported ${importedCount} student(s). ${
          duplicatesSkipped ? `Skipped ${duplicatesSkipped} duplicate index number(s).` : ''
        }`,
      );

      setTimeout(() => {
        onSuccess();
      }, 1200);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to import student roster.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white border border-[#D0D7DE] rounded-md shadow-lg p-6 w-full max-w-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-[#1F2328]">{title}</h3>
          <button
            onClick={onClose}
            className="text-[#656D76] hover:text-[#1F2328] text-xl leading-none"
          >
            &times;
          </button>
        </div>

        {error && (
          <div className="bg-[#FFEBE9] border border-[#FF8182] text-[#D73A49] px-3 py-2 rounded-md text-xs mb-3">
            {error}
          </div>
        )}

        {resultMessage && (
          <div className="bg-[#E6FFED] border border-[#34D058] text-[#1F883D] px-3 py-2 rounded-md text-xs mb-3 font-medium">
            {resultMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Target class picker if not fixed */}
          {!fixedClassId && (
            <div>
              <label className="block text-xs font-medium text-[#656D76] mb-1">Target Class</label>
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="border border-[#D0D7DE] rounded-md px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#0969DA] shadow-sm"
                required
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* File input and sample download */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-[#656D76]">CSV File</label>
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="text-xs text-[#0969DA] hover:underline"
              >
                Download CSV Sample Template
              </button>
            </div>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileUpload}
              className="border border-[#D0D7DE] rounded-md px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#0969DA] file:mr-3 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-medium file:bg-[#F6F8FA] file:text-[#1F2328] hover:file:bg-[#F3F4F6] cursor-pointer"
            />
            <p className="text-[11px] text-[#656D76] mt-1">
              File must have <code>fullName</code> and <code>indexNumber</code> columns.
            </p>
          </div>

          {/* Parsed Preview */}
          {parsedRows.length > 0 && (
            <div className="border border-[#D0D7DE] rounded-md p-3 bg-[#F6F8FA] max-h-48 overflow-y-auto">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-semibold text-[#1F2328]">
                  Detected {parsedRows.length} Student{parsedRows.length !== 1 ? 's' : ''} ({fileName})
                </span>
                <span className="text-[11px] text-[#656D76]">Showing top 5</span>
              </div>
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-[#D0D7DE] text-[#656D76]">
                    <th className="py-1">#</th>
                    <th className="py-1">Full Name</th>
                    <th className="py-1">Index Number</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedRows.slice(0, 5).map((r, i) => (
                    <tr key={i} className="border-b border-[#E1E4E8] last:border-0">
                      <td className="py-1 text-[#656D76]">{i + 1}</td>
                      <td className="py-1 font-medium text-[#1F2328]">{r.fullName}</td>
                      <td className="py-1 text-[#656D76]">{r.indexNumber}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="bg-[#F6F8FA] border border-[#D0D7DE] text-[#24292F] px-3 py-1.5 rounded-md text-sm font-medium hover:bg-[#F3F4F6] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || parsedRows.length === 0}
              className="bg-[#0969DA] text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-[#0353A4] transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Importing…' : `Import ${parsedRows.length > 0 ? `(${parsedRows.length})` : ''} Students`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
