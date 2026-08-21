import React from 'react';
import { Download, Share2, Copy, QrCode } from 'lucide-react';
import Header from './Header';
// import { db } from '../firebase.js';

export default function QRDisplay({ qrData }) {
  // Sample data fallback for preview
  const data = qrData || {
    empId: '',
    empName: '',
    jobNumber: '',
    customerName: ''
  };

  return (
    <div className="min-h-screen bg-gray-50 flex font-sans text-gray-800">
      <div className="max-w-md w-full mx-auto min-h-screen bg-white relative px-4 py-8 flex flex-col">
        
        <Header />

        {/* The Card Box */}
        <div className="border border-gray-200 rounded-[20px] p-5 shadow-sm bg-white flex flex-col">
          
          {/* Inner Header */}
          <div className="flex items-center justify-center gap-3 mb-6 pb-4 border-b border-gray-100">
             <div className="w-10 h-8 flex flex-col items-center justify-center flex-shrink-0">
              <span className="text-green-700 font-extrabold text-xl tracking-tighter leading-none italic -skew-x-12 relative">
                ST
                <div className="absolute -top-0.5 -left-1 w-6 h-[1.5px] bg-green-700"></div>
                <div className="absolute -bottom-0.5 -left-1 w-8 h-[1.5px] bg-green-700"></div>
              </span>
            </div>
            <h2 className="text-xs font-semibold text-gray-700 text-center">
              แบบสอบถามความพึงพอใจต่อการขายและบริการ
            </h2>
          </div>

          {/* QR Code Placeholder */}
          <div className="w-full aspect-square bg-white border border-gray-100 rounded-xl flex items-center justify-center p-4 mb-8 shadow-sm">
            <div className="w-full h-full bg-green-50 rounded-lg flex flex-col items-center justify-center border-2 border-dashed border-green-300 relative overflow-hidden">
              <QrCode className="w-24 h-24 text-green-700 opacity-80" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent_20%,_rgba(255,255,255,0.8)_100%)] mix-blend-overlay"></div>
            </div>
          </div>

          {/* Data Summary (Stacked exactly like the mockup) */}
          <div className="flex flex-col gap-5 mb-8 text-xs text-gray-700 px-2">
            <div>
              <span className="font-medium">รหัสพนักงาน: </span>
              <span className="text-gray-900">{data.empId}</span>
            </div>
            <div>
              <span className="font-medium">ชื่อพนักงาน: </span>
              <span className="text-gray-900">{data.empName}</span>
            </div>
            <div>
              <span className="font-medium">JOB/SO-Number: </span>
              <span className="text-gray-900">{data.jobNumber}</span>
            </div>
            <div>
              <span className="font-medium">ชื่อลูกค้า/โครงการ: </span>
              <span className="text-gray-900">{data.customerName}</span>
            </div>
          </div>

          {/* Outlined Action Buttons */}
          <div className="flex flex-col gap-3">
            <div className="flex gap-3">
              <button className="flex-1 flex justify-center items-center py-3 rounded-xl text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 active:scale-95 transition-all">
                <Download className="w-4 h-4 mr-2" />
                บันทึกรูป
              </button>
              <button className="flex-1 flex justify-center items-center py-3 rounded-xl text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 active:scale-95 transition-all">
                <Share2 className="w-4 h-4 mr-2" />
                แชร์
              </button>
            </div>
            <button className="w-full flex justify-center items-center py-3 rounded-xl text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 active:scale-95 transition-all">
              <Copy className="w-4 h-4 mr-2" />
              คัดลอกลิ้งค์
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}
