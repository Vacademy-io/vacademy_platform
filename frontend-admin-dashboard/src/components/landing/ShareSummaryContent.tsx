import { motion } from 'framer-motion';
import { Send, Link, CheckCircle, FileText } from 'lucide-react';

const summaryData = {
    title: 'Q2 All-Hands Recap',
    actionPoints: [
        'Launch new marketing campaign by July 15th.',
        'Finalize budget for Q3 projects.',
        'Onboard two new engineers to the platform team.',
    ],
    voltLink: 'volt.session/q2-recap',
};

export const ShareSummaryContent = () => {
    return (
        <div className="absolute inset-0 flex items-center justify-center overflow-hidden bg-slate-100 p-4">
            <motion.div
                className="w-full max-w-sm scale-[0.85] overflow-hidden rounded-lg bg-white shadow-2xl md:scale-100"
                initial={{ opacity: 0, y: 50, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.7, ease: 'easeOut' }}
            >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center gap-2">
                        <Send size={16} className="text-blue-500" />
                        <h3 className="text-sm font-semibold text-slate-700">Auto-Share Summary</h3>
                    </div>
                    <motion.div
                        className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 1.5 }}
                    >
                        Sent to 42 participants
                    </motion.div>
                </div>

                {/* Body */}
                <div className="p-4">
                    {/* Action Items */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5, duration: 0.5 }}
                    >
                        <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                            <CheckCircle size={15} className="text-green-500" />
                            Action Items
                        </h4>
                        <ul className="mt-2 list-inside list-disc space-y-1.5 text-xs text-slate-500">
                            {summaryData.actionPoints.map((item, index) => (
                                <li key={index}>{item}</li>
                            ))}
                        </ul>
                    </motion.div>

                    {/* Volt Link */}
                    <motion.div
                        className="mt-4"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.8, duration: 0.5 }}
                    >
                        <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                            <Link size={15} className="text-orange-500" />
                            Volt Link
                        </h4>
                        <div className="mt-1 rounded-md bg-blue-50 p-2 font-mono text-xs text-blue-600">
                            {summaryData.voltLink}
                        </div>
                    </motion.div>
                </div>

                {/* Footer */}
                <motion.div
                    className="border-t border-slate-200 bg-slate-50 p-3 text-center"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1.2 }}
                >
                    <p className="text-xs text-slate-400">
                        Summary automatically sent via Volt AI.
                    </p>
                </motion.div>
            </motion.div>
        </div>
    );
};
