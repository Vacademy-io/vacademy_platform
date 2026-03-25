import { motion } from 'framer-motion';
import { Crown, Trophy, TrendingUp, BarChart2 } from 'lucide-react';
import { useState, useEffect } from 'react';

const leaderboardData = [
    { name: 'Alex Johnson', score: 2450 },
    { name: 'Maria Garcia', score: 2300 },
    { name: 'Chen Wei', score: 2280 },
    { name: 'Fatima Al-Fassi', score: 2100 },
    { name: 'David Smith', score: 1950 },
];

const initialChartData = [
    { label: 'A', value: 30 },
    { label: 'B', value: 85 },
    { label: 'C', value: 60 },
    { label: 'D', value: 45 },
];

export const LeaderboardCardContent = () => {
    const [chartData, setChartData] = useState(initialChartData);

    useEffect(() => {
        const interval = setInterval(() => {
            setChartData(
                initialChartData.map((bar) => ({
                    ...bar,
                    value: Math.max(10, Math.floor(Math.random() * 100)),
                }))
            );
        }, 2000); // Update every 2 seconds

        return () => clearInterval(interval);
    }, []);

    return (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-100 p-4">
            <div className="relative h-[360px] w-full max-w-lg">
                {/* Laptop Screen */}
                <motion.div
                    className="flex h-[340px] w-full flex-col rounded-t-xl border-4 border-b-0 border-slate-300 bg-white/70 p-6 shadow-2xl backdrop-blur-sm"
                    initial={{ opacity: 0, y: 50 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, ease: 'easeOut' }}
                >
                    <div className="mb-4 flex shrink-0 items-center justify-between">
                        <h3 className="text-lg font-bold text-slate-800">Live Analytics</h3>
                        <TrendingUp className="text-blue-500" size={22} />
                    </div>

                    <div className="grid flex-1 grid-cols-2 gap-6 overflow-hidden">
                        {/* Leaderboard Section */}
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.5, duration: 0.5 }}
                        >
                            <div className="flex items-center justify-between">
                                <h4 className="text-sm font-semibold text-slate-600">
                                    Top Performers
                                </h4>
                                <Trophy className="text-yellow-400" size={18} />
                            </div>
                            <div className="mt-2 space-y-2">
                                {leaderboardData.slice(0, 5).map((player, index) => (
                                    <div
                                        key={player.name}
                                        className="flex items-center rounded-lg bg-slate-50 p-2 text-sm"
                                    >
                                        <span className="w-6 text-center font-bold text-slate-500">
                                            {index + 1}
                                        </span>
                                        <span className="ml-3 flex-1 font-medium text-slate-700">
                                            {player.name}
                                        </span>
                                        <div className="flex items-center gap-2 font-bold text-orange-500">
                                            {index === 0 && (
                                                <Crown size={16} className="text-yellow-400" />
                                            )}
                                            {player.score}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </motion.div>

                        {/* Chart Section */}
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.5, duration: 0.5 }}
                        >
                            <div className="flex items-center justify-between">
                                <h4 className="text-sm font-semibold text-slate-600">
                                    Response Distribution
                                </h4>
                                <BarChart2 className="text-blue-400" size={18} />
                            </div>
                            <div className="mt-4 flex h-48 items-end justify-around">
                                {chartData.map((bar, index) => (
                                    <div
                                        key={bar.label}
                                        className="flex h-full w-1/5 flex-col items-center"
                                    >
                                        <motion.div
                                            className="w-4/5 rounded-t-md bg-blue-400"
                                            style={{ originY: 1 }}
                                            animate={{ height: `${bar.value}%` }}
                                            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                                        />
                                        <span className="mt-2 text-sm font-semibold text-slate-600">
                                            {bar.label}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    </div>
                </motion.div>
                {/* Laptop Base */}
                <div className="absolute -bottom-1 -left-[5%] h-5 w-[110%] rounded-b-lg bg-slate-200">
                    <div className="absolute left-1/2 top-1 h-1 w-16 -translate-x-1/2 rounded-full bg-slate-300"></div>
                </div>
            </div>
        </div>
    );
};
