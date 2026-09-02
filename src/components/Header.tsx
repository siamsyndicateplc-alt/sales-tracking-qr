import React from 'react';

export default function Header() {
  return (
    <div className="flex items-start gap-4 mb-8">
      {/* Logo Placeholder - Matches the ST green styling */}
      <div className="w-14 h-12 flex flex-col items-center justify-center flex-shrink-0">
        <span className="text-green-700 font-extrabold text-3xl tracking-tighter leading-none italic -skew-x-12 relative">
          ST
          {/* Decorative lines to mimic the logo */}
          <div className="absolute -top-1 -left-2 w-10 h-0.5 bg-green-700"></div>
          <div className="absolute -bottom-1 -left-1 w-12 h-0.5 bg-green-700"></div>
        </span>
      </div>
      {/* Text Content */}
      <div className="flex flex-col justify-center">
        <h1 className="text-gray-900 font-bold text-[13px] sm:text-sm leading-snug">
          แบบสอบถามความพึงพอใจต่อการขายและบริการ
        </h1>
        <p className="text-gray-600 text-[10px] mt-1 font-medium">
          บริษัทสยามซินดิเคทเทคโนโลยี จำกัด (มหาชน)
        </p>
      </div>
    </div>
  );
}
