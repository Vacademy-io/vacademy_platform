import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface TemplateTypeSelectorProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

const TEMPLATE_TYPES = [
  { value: 'greeting', label: 'Greeting' },
  { value: 'reminder', label: 'Reminder' },
  { value: 'notification', label: 'Notification' },
  { value: 'promotion', label: 'Promotion' },
  { value: 'confirmation', label: 'Confirmation' },
  { value: 'invitation', label: 'Invitation' },
  { value: 'announcement', label: 'Announcement' },
  { value: 'follow_up', label: 'Follow Up' },
  { value: 'thank_you', label: 'Thank You' },
  { value: 'goodbye', label: 'Goodbye' },
  { value: 'utility', label: 'Utility' },
];

export const TemplateTypeSelector: React.FC<TemplateTypeSelectorProps> = ({
  value,
  onChange,
  className = '',
}) => {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={className}>
        <SelectValue placeholder="Select template type" />
      </SelectTrigger>
      <SelectContent>
        {TEMPLATE_TYPES.map((type) => (
          <SelectItem key={type.value} value={type.value}>
            {type.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
