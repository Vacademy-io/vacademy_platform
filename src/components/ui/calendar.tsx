import * as React from 'react';
import { DateRange, RangeKeyDict } from 'react-date-range';
import 'react-date-range/dist/styles.css';
import 'react-date-range/dist/theme/default.css';

// Keep same external API used in Attendance page
export interface CalendarRange {
  from?: Date;
  to?: Date;
}

type CalendarProps = {
  mode: 'range';
  selected: CalendarRange;
  onSelect: (range: CalendarRange | undefined) => void;
  className?: string;
};

export function Calendar({ selected, onSelect, className }: CalendarProps) {
  const selectionRange = {
    startDate: selected.from ?? new Date(),
    endDate: selected.to ?? new Date(),
    key: 'selection',
  };

  // Resolve brand primary color from CSS variable (fallback to blue)
  const [primaryHex, setPrimaryHex] = React.useState('#2563eb');
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const root = getComputedStyle(document.documentElement);
      const hsl = root.getPropertyValue('--primary-500').trim(); // e.g. "24 85% 54%"
      if (hsl) {
        const [h, s, l] = hsl.split(' ');
        // Convert HSL to hex quickly
        const to255 = (n: number) => Math.round(n * 255);
        const H = parseFloat(h);
        const S = parseFloat(s) / 100;
        const L = parseFloat(l) / 100;
        const a = S * Math.min(L, 1 - L);
        const f = (n: number) => {
          const k = (n + H / 30) % 12;
          const color = L - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
          return to255(color).toString(16).padStart(2, '0');
        };
        const hex = `#${f(0)}${f(8)}${f(4)}`;
        setPrimaryHex(hex);
      }
    }
  }, []);

  return (
    <div className={className}>
      <DateRange
        ranges={[selectionRange]}
        onChange={(ranges: RangeKeyDict) => {
          const sel = ranges.selection;
          onSelect({ from: sel.startDate, to: sel.endDate });
        }}
        showPreview={false}
        showMonthAndYearPickers={true}
        showDateDisplay={false}
        rangeColors={[primaryHex]}
        color={primaryHex}
      />
    </div>
  );
}
