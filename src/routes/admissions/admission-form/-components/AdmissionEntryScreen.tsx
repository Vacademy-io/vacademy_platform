import React, { useState } from 'react';

export interface StudentSearchResult {
    id: string;
    studentName: string;
    parentName?: string;
    mobile: string;
    classVal: string;
    source?: string;
    status?: string;
    // Data pre-fills
    dob: string;
    address: string;
    gender: string;
    email?: string;
}

interface Props {
    onStartAdmission: (data: Partial<StudentSearchResult> | null) => void;
}

const MOCK_ENQUIRY_DATA: StudentSearchResult[] = [
    {
        id: 'ENQ-2025-001',
        studentName: 'Aarav Sharma',
        parentName: 'Ramesh Sharma',
        mobile: '9876543210',
        classVal: 'Class 5',
        source: 'Website',
        dob: '2015-05-12',
        address: '123 Main St, New Delhi',
        gender: 'MALE',
        email: 'ramesh.sharma@example.com'
    },
    {
        id: 'ENQ-2025-002',
        studentName: 'Priya Patel',
        parentName: 'Suresh Patel',
        mobile: '8876543210',
        classVal: 'Class 3',
        source: 'Walk-in',
        dob: '2017-08-22',
        address: '456 Park Avenue, Mumbai',
        gender: 'FEMALE',
        email: 'suresh.p@example.com'
    }
];

const MOCK_APPLICATION_DATA: StudentSearchResult[] = [
    {
        id: 'APP-2025-001',
        studentName: 'Vihaan Singh',
        parentName: 'Vikram Singh',
        mobile: '7876543210',
        classVal: 'Class 8',
        status: 'Approved',
        dob: '2012-02-15',
        address: '789 Lake View, Bangalore',
        gender: 'MALE',
        email: 'vikram.singh@example.com'
    },
    {
        id: 'APP-2025-002',
        studentName: 'Ananya Gupta',
        parentName: 'Rahul Gupta',
        mobile: '6876543210',
        classVal: 'Class 1',
        status: 'Pending Review',
        dob: '2019-11-05',
        address: '321 Hill Road, Pune',
        gender: 'FEMALE',
        email: 'rahul.g@example.com'
    }
];

export default function AdmissionEntryScreen({ onStartAdmission }: Props) {
    const [academicYear, setAcademicYear] = useState('2025-2026');
    const [fromSource, setFromSource] = useState('From Enquiry');
    const [searchBy, setSearchBy] = useState('Student Name');
    const [searchValue, setSearchValue] = useState('');
    const [searchResults, setSearchResults] = useState<StudentSearchResult[] | null>(null);

    const handleSearch = () => {
        if (!searchValue.trim()) {
            setSearchResults(null);
            return;
        }

        const query = searchValue.toLowerCase();
        let dataToSearch: StudentSearchResult[] = [];

        if (fromSource === 'From Enquiry') {
            dataToSearch = MOCK_ENQUIRY_DATA;
        } else if (fromSource === 'From Application') {
            dataToSearch = MOCK_APPLICATION_DATA;
        }

        const results = dataToSearch.filter(item => {
            if (searchBy === 'Student Name') return item.studentName.toLowerCase().includes(query);
            if (searchBy === 'Application No' || searchBy === 'Enquiry No') return item.id.toLowerCase().includes(query);
            if (searchBy === 'Parent Mobile') return item.mobile.includes(query);
            return false;
        });

        setSearchResults(results);
    };

    return (
        <div className="flex h-full flex-col p-6 animate-in fade-in duration-300">
            {/* Header Section */}
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
                <h1 className="text-2xl font-bold text-gray-800">Admission Form</h1>
                <button
                    onClick={() => onStartAdmission(null)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors shadow-sm"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
                    </svg>
                    New Admission
                </button>
            </div>

            {/* Search Panel */}
            <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm mb-6">
                <div className="flex items-center gap-2 mb-4">
                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                    </svg>
                    <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Search Criteria</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                    <div className="flex flex-col gap-1.5 flex-1">
                        <label className="text-xs font-medium text-gray-600">Academic Year</label>
                        <select
                            value={academicYear}
                            onChange={(e) => setAcademicYear(e.target.value)}
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none"
                        >
                            <option value="2024-2025">2024-2025</option>
                            <option value="2025-2026">2025-2026</option>
                            <option value="2026-2027">2026-2027</option>
                        </select>
                    </div>

                    <div className="flex flex-col gap-1.5 flex-1">
                        <label className="text-xs font-medium text-gray-600">FROM <span className="text-red-500">*</span></label>
                        <select
                            value={fromSource}
                            onChange={(e) => {
                                setFromSource(e.target.value);
                                setSearchResults(null);
                                setSearchValue('');
                            }}
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none"
                        >
                            <option value="From Enquiry">From Enquiry</option>
                            <option value="From Application">From Application</option>
                        </select>
                    </div>

                    <div className="flex flex-col gap-1.5 flex-1">
                        <label className="text-xs font-medium text-gray-600">Search By</label>
                        <select
                            value={searchBy}
                            onChange={(e) => setSearchBy(e.target.value)}
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none"
                        >
                            {fromSource === 'From Enquiry' ? (
                                <option value="Enquiry No">Enquiry No</option>
                            ) : (
                                <option value="Application No">Application No</option>
                            )}
                            <option value="Student Name">Student Name</option>
                            <option value="Parent Mobile">Parent Mobile</option>
                        </select>
                    </div>

                    <div className="flex flex-col gap-1.5 flex-1 lg:col-span-1">
                        <label className="text-xs font-medium text-gray-600">Enter Details</label>
                        <input
                            type="text"
                            value={searchValue}
                            onChange={(e) => setSearchValue(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            placeholder={`Enter ${searchBy}`}
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none"
                        />
                    </div>

                    <div className="flex-1">
                        <button
                            onClick={handleSearch}
                            className="w-full px-4 py-2 bg-gray-800 text-white text-sm font-medium rounded-md hover:bg-gray-900 transition-colors"
                        >
                            Search
                        </button>
                    </div>
                </div>
            </div>

            {/* Results Section */}
            {searchResults !== null && (
                <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden flex-1 flex flex-col">
                    <div className="overflow-x-auto flex-1">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider border-b border-gray-200">
                                    <th className="px-6 py-3 font-semibold">{fromSource === 'From Enquiry' ? 'Inquiry ID' : 'Registration ID'}</th>
                                    <th className="px-6 py-3 font-semibold">Student Name</th>
                                    <th className="px-6 py-3 font-semibold">Class</th>
                                    <th className="px-6 py-3 font-semibold">{fromSource === 'From Application' ? 'Parent Name' : 'Parent Mobile'}</th>
                                    <th className="px-6 py-3 font-semibold">{fromSource === 'From Application' ? 'Status' : 'Source'}</th>
                                    <th className="px-6 py-3 font-semibold text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 text-sm">
                                {searchResults.length > 0 ? (
                                    searchResults.map((result) => (
                                        <tr key={result.id} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="px-6 py-4 font-medium text-gray-900">{result.id}</td>
                                            <td className="px-6 py-4 text-gray-700">{result.studentName}</td>
                                            <td className="px-6 py-4 text-gray-700">{result.classVal}</td>
                                            <td className="px-6 py-4 text-gray-700">
                                                {fromSource === 'From Application' ? result.parentName : result.mobile}
                                            </td>
                                            <td className="px-6 py-4">
                                                {fromSource === 'From Application' ? (
                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                                                        ${result.status === 'Approved' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                                        {result.status}
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-600">{result.source}</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    onClick={() => onStartAdmission(result)}
                                                    className="inline-flex items-center justify-center px-3 py-1.5 border border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white rounded text-xs font-medium transition-colors"
                                                >
                                                    {fromSource === 'From Enquiry' ? 'Start Admission' : 'Start Admission'}
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                                            <div className="flex flex-col items-center justify-center gap-2">
                                                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                                </svg>
                                                <p>No records found matching your search criteria.</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Empty State when no search performed yet */}
            {searchResults === null && (
                <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-lg bg-gray-50/50 p-12 text-center">
                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm border border-gray-100 mb-4 text-gray-400">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"></path>
                        </svg>
                    </div>
                    <h3 className="text-lg font-medium text-gray-800 mb-1">Select a student to begin</h3>
                    <p className="text-sm text-gray-500 max-w-md">
                        Use the search panel above to find an existing Enquiry or Application. Alternatively, click 'Direct Admission' to start a fresh form.
                    </p>
                </div>
            )}
        </div>
    );
}
