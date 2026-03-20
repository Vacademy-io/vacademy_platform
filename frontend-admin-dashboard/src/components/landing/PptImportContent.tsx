import { motion, Variants } from 'framer-motion';
import { File, ArrowRight, Layers } from 'lucide-react';

export const PptImportContent = () => {
    const containerVariants: Variants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.4,
                delayChildren: 0.2,
            },
        },
    };

    const itemVariants: Variants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
    };

    return (
        <div className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden bg-slate-100 p-4">
            <motion.div
                className="flex items-center justify-center gap-4 md:gap-6"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
            >
                {/* PPT Icon */}
                <motion.div className="flex flex-col items-center gap-2" variants={itemVariants}>
                    <File className="size-16 text-orange-500 md:size-20" />
                    <span className="text-xs font-bold text-slate-600">My Deck.pptx</span>
                </motion.div>

                {/* Arrow */}
                <motion.div variants={itemVariants}>
                    <ArrowRight className="size-10 shrink-0 text-slate-400 md:size-12" />
                </motion.div>

                {/* Volt Slides */}
                <motion.div className="relative size-20 md:size-24" variants={itemVariants}>
                    <motion.div
                        className="absolute left-0 top-0 flex size-14 items-center justify-center rounded-lg border border-slate-200 bg-white shadow-md md:size-16"
                        animate={{ y: [0, -4, 0], x: [0, -2, 0], rotate: -3 }}
                        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                    >
                        <Layers className="size-7 text-blue-500 md:size-8" />
                    </motion.div>
                    <motion.div
                        className="absolute left-2 top-2 flex size-14 items-center justify-center rounded-lg border border-slate-200 bg-white shadow-lg md:left-4 md:top-4 md:size-16"
                        animate={{ y: [0, 5, 0], x: [0, 3, 0], rotate: 5 }}
                        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                    >
                        <Layers className="size-7 text-purple-500 md:size-8" />
                    </motion.div>
                </motion.div>
            </motion.div>
        </div>
    );
};
