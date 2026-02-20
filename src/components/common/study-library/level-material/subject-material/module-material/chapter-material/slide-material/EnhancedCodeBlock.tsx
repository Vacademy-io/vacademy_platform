import React from 'react';

interface EnhancedCodeBlockProps {
    code: string;
    language?: string;
    className?: string;
}

export const EnhancedCodeBlock: React.FC<EnhancedCodeBlockProps> = ({ code, className = '' }) => {
    return (
        <div className={`enhanced-code-block relative my-6 ${className}`}>
            <div className="absolute top-0 left-0 right-0 h-8 bg-gray-800 rounded-t-lg flex items-center px-4 select-none z-10">
                <div className="flex space-x-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                </div>
            </div>
            <code className="block bg-gray-900 text-gray-100 p-6 pt-12 rounded-lg overflow-x-auto font-mono text-sm leading-relaxed shadow-lg whitespace-pre">
                {code}
            </code>
        </div>
    );
};
