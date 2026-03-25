import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    Trophy,
    Medal,
    User,
    Envelope,
    Phone,
    Download,
    CaretLeft,
    CaretRight,
} from '@phosphor-icons/react';
import type { LeaderboardResponse, LeaderboardEntry } from '@/types/challenge-analytics';

interface EngagementLeaderboardProps {
    data: LeaderboardResponse | undefined;
    isLoading: boolean;
    page: number;
    onPageChange: (page: number) => void;
}

const getRankIcon = (rank: number) => {
    switch (rank) {
        case 1:
            return <span className="text-2xl">🥇</span>;
        case 2:
            return <span className="text-2xl">🥈</span>;
        case 3:
            return <span className="text-2xl">🥉</span>;
        default:
            return (
                <span className="flex size-8 items-center justify-center rounded-full bg-gray-100 text-sm font-bold text-gray-600">
                    {rank}
                </span>
            );
    }
};

const getRankColor = (rank: number) => {
    switch (rank) {
        case 1:
            return 'from-yellow-400 to-amber-500';
        case 2:
            return 'from-gray-300 to-gray-400';
        case 3:
            return 'from-amber-600 to-amber-700';
        default:
            return 'from-gray-100 to-gray-200';
    }
};

export function EngagementLeaderboard({
    data,
    isLoading,
    page,
    onPageChange,
}: EngagementLeaderboardProps) {
    if (isLoading) {
        return (
            <Card className="shadow-sm">
                <CardHeader>
                    <div className="h-6 w-48 animate-pulse rounded bg-gray-200" />
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className="h-16 animate-pulse rounded-lg bg-gray-100" />
                        ))}
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (!data || !data.leaderboard || data.leaderboard.length === 0) {
        return (
            <Card className="shadow-sm">
                <CardHeader className="flex flex-row items-center gap-2">
                    <Trophy className="size-5 text-amber-500" weight="fill" />
                    <CardTitle className="text-base font-semibold">
                        Engagement Leaderboard
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex h-[200px] items-center justify-center text-gray-500">
                        No leaderboard data available
                    </div>
                </CardContent>
            </Card>
        );
    }

    const { leaderboard, pagination } = data;
    const topThree = leaderboard.slice(0, 3);
    const rest = leaderboard.slice(3);

    const exportToCSV = () => {
        const headers = [
            'Rank',
            'Name',
            'Email',
            'Phone',
            'Center',
            'Total Messages',
            'Engagement Score',
        ];
        const rows = leaderboard.map((entry) => {
            const cf = entry.user_details?.custom_fields || {};
            const name =
                cf['first name'] && cf['last name']
                    ? `${cf['first name']} ${cf['last name']}`
                    : cf['parent name'] || 'N/A';
            return [
                entry.rank,
                name,
                cf['Email'] || cf['alternate email'] || 'N/A',
                entry.phone_number,
                cf['center name'] || 'N/A',
                entry.engagement_metrics.total_messages,
                entry.engagement_metrics.engagement_score,
            ];
        });

        const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `engagement_leaderboard_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    };

    return (
        <Card className="shadow-sm">
            <CardHeader className="pb-2">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                        <div className="rounded-lg bg-amber-100 p-2">
                            <Trophy className="size-5 text-amber-600" weight="fill" />
                        </div>
                        <div>
                            <CardTitle className="text-base font-semibold">
                                Engagement Leaderboard
                            </CardTitle>
                            <p className="text-xs text-gray-500">Top power users by engagement</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500">
                            {pagination.total_users} total users
                        </span>
                        <Button variant="outline" size="sm" onClick={exportToCSV} className="gap-2">
                            <Download className="size-4" />
                            Export CSV
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {/* Top 3 Podium */}
                {page === 1 && topThree.length > 0 && (
                    <div className="mb-6 grid gap-4 md:grid-cols-3">
                        {topThree.map((entry, index) => (
                            <div
                                key={entry.rank}
                                className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${getRankColor(entry.rank)} p-4 ${
                                    index === 0 ? 'md:col-start-2 md:row-start-1' : ''
                                } ${index === 1 ? 'md:col-start-1 md:row-start-1' : ''} ${
                                    index === 2 ? 'md:col-start-3 md:row-start-1' : ''
                                }`}
                            >
                                <div className="absolute right-2 top-2">
                                    {getRankIcon(entry.rank)}
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="flex size-10 items-center justify-center rounded-full bg-white/20 text-white">
                                        <User className="size-5" weight="fill" />
                                    </div>
                                    <div className="flex-1">
                                        <h4
                                            className={`font-semibold ${entry.rank <= 3 ? 'text-white' : 'text-gray-800'}`}
                                        >
                                            {entry.user_details?.custom_fields?.['first name'] &&
                                            entry.user_details?.custom_fields?.['last name']
                                                ? `${entry.user_details.custom_fields['first name']} ${entry.user_details.custom_fields['last name']}`
                                                : entry.user_details?.custom_fields?.[
                                                      'parent name'
                                                  ] || 'Anonymous'}
                                        </h4>
                                        <p
                                            className={`text-xs ${entry.rank <= 3 ? 'text-white/80' : 'text-gray-600'}`}
                                        >
                                            {entry.user_details?.custom_fields?.['center name'] ||
                                                'Unknown Center'}
                                        </p>
                                    </div>
                                </div>
                                <div className="mt-4 grid grid-cols-2 gap-2">
                                    <div
                                        className={`rounded-lg ${entry.rank <= 3 ? 'bg-white/20' : 'bg-gray-100'} p-2`}
                                    >
                                        <span
                                            className={`text-xs ${entry.rank <= 3 ? 'text-white/80' : 'text-gray-500'}`}
                                        >
                                            Messages
                                        </span>
                                        <p
                                            className={`font-bold ${entry.rank <= 3 ? 'text-white' : 'text-gray-800'}`}
                                        >
                                            {entry.engagement_metrics.total_messages}
                                        </p>
                                    </div>
                                    <div
                                        className={`rounded-lg ${entry.rank <= 3 ? 'bg-white/20' : 'bg-gray-100'} p-2`}
                                    >
                                        <span
                                            className={`text-xs ${entry.rank <= 3 ? 'text-white/80' : 'text-gray-500'}`}
                                        >
                                            Score
                                        </span>
                                        <p
                                            className={`font-bold ${entry.rank <= 3 ? 'text-white' : 'text-gray-800'}`}
                                        >
                                            {entry.engagement_metrics.engagement_score}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Leaderboard Table */}
                <div className="overflow-hidden rounded-lg border">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left font-medium text-gray-700">
                                    Rank
                                </th>
                                <th className="px-4 py-3 text-left font-medium text-gray-700">
                                    User
                                </th>
                                <th className="px-4 py-3 text-left font-medium text-gray-700">
                                    Contact
                                </th>
                                <th className="px-4 py-3 text-right font-medium text-gray-700">
                                    Outgoing
                                </th>
                                <th className="px-4 py-3 text-right font-medium text-gray-700">
                                    Incoming
                                </th>
                                <th className="px-4 py-3 text-right font-medium text-gray-700">
                                    Total
                                </th>
                                <th className="px-4 py-3 text-right font-medium text-gray-700">
                                    Score
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {(page === 1 ? rest : leaderboard).map((entry) => (
                                <tr key={entry.rank} className="border-t hover:bg-gray-50">
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            {getRankIcon(entry.rank)}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div>
                                            <p className="font-medium text-gray-800">
                                                {entry.user_details?.custom_fields?.[
                                                    'first name'
                                                ] &&
                                                entry.user_details?.custom_fields?.['last name']
                                                    ? `${entry.user_details.custom_fields['first name']} ${entry.user_details.custom_fields['last name']}`
                                                    : entry.user_details?.custom_fields?.[
                                                          'parent name'
                                                      ] || 'Anonymous'}
                                            </p>
                                            {entry.user_details?.custom_fields && (
                                                <p className="text-xs text-gray-500">
                                                    {entry.user_details.custom_fields[
                                                        'children name'
                                                    ] &&
                                                        `Child: ${entry.user_details.custom_fields['children name']}`}
                                                    {entry.user_details.custom_fields[
                                                        'center name'
                                                    ] &&
                                                        ` • ${entry.user_details.custom_fields['center name']}`}
                                                </p>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="space-y-1">
                                            {entry.user_details?.custom_fields?.['Email'] && (
                                                <div className="flex items-center gap-1 text-xs text-gray-600">
                                                    <Envelope className="size-3" />
                                                    <span className="max-w-[150px] truncate">
                                                        {entry.user_details.custom_fields['Email']}
                                                    </span>
                                                </div>
                                            )}
                                            <div className="flex items-center gap-1 text-xs text-gray-600">
                                                <Phone className="size-3" />
                                                <span>
                                                    {entry.user_details?.custom_fields?.['phone'] ||
                                                        entry.phone_number}
                                                </span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <span className="font-medium text-blue-600">
                                            {entry.engagement_metrics.outgoing_messages}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <span className="font-medium text-emerald-600">
                                            {entry.engagement_metrics.incoming_messages}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right font-medium">
                                        {entry.engagement_metrics.total_messages}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">
                                            {entry.engagement_metrics.engagement_score}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {pagination.total_pages > 1 && (
                    <div className="mt-4 flex items-center justify-between">
                        <span className="text-sm text-gray-500">
                            Page {pagination.current_page} of {pagination.total_pages}
                        </span>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onPageChange(page - 1)}
                                disabled={page <= 1}
                            >
                                <CaretLeft className="size-4" />
                                Previous
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onPageChange(page + 1)}
                                disabled={page >= pagination.total_pages}
                            >
                                Next
                                <CaretRight className="size-4" />
                            </Button>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
