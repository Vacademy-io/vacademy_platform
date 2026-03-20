import React, { useMemo, useState, useRef, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Cloud, Feather, MessageSquare, Hash } from 'lucide-react';
import { WordCloud, WordCloudProps } from '@isoterik/react-word-cloud';

interface ResponseData {
    username: string;
    response_data: {
        text_answer: string | null;
    };
}

interface WordCloudModalProps {
    isOpen: boolean;
    onClose: () => void;
    responses: ResponseData[];
}

export const WordCloudModal: React.FC<WordCloudModalProps> = ({ isOpen, onClose, responses }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [size, setSize] = useState<{ width: number; height: number } | null>(null);
    const resizeObserverRef = useRef<ResizeObserver | null>(null);

    useEffect(() => {
        if (isOpen) {
            console.log('[WordCloud] Modal opened. Responses:', responses.length);
            console.log(
                '[WordCloud] Text answers:',
                responses.map((r) => r.response_data?.text_answer).filter(Boolean)
            );
        }
    }, [isOpen, responses]);

    useEffect(() => {
        if (!isOpen) {
            setSize(null);
            return;
        }

        // Set a fallback size initially
        const fallbackSize = { width: 600, height: 500 };
        setSize(fallbackSize);

        // Set up ResizeObserver for more accurate sizing
        if (!resizeObserverRef.current) {
            resizeObserverRef.current = new ResizeObserver((entries) => {
                const entry = entries[0];
                if (entry) {
                    const { width, height } = entry.contentRect;
                    console.log('[WordCloud] ResizeObserver detected size:', { width, height });
                    if (width > 0 && height > 0) {
                        setSize({ width, height });
                    }
                }
            });
        }

        const observer = resizeObserverRef.current;

        // Use a timeout to ensure the DOM is ready
        const timeoutId = setTimeout(() => {
            const currentRef = containerRef.current;
            if (currentRef) {
                console.log('[WordCloud] Starting ResizeObserver on container');
                observer.observe(currentRef);

                // Also manually get initial size as a backup
                const rect = currentRef.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0) {
                    console.log('[WordCloud] Manual size detection:', {
                        width: rect.width,
                        height: rect.height,
                    });
                    setSize({ width: rect.width, height: rect.height });
                }
            }
        }, 100);

        return () => {
            clearTimeout(timeoutId);
            if (containerRef.current) {
                observer.unobserve(containerRef.current);
            }
        };
    }, [isOpen]);

    const words = useMemo(() => {
        if (!responses || responses.length === 0) {
            console.log('[WordCloud] No responses available');
            return [];
        }

        const textBlob = responses
            .map((r) => r.response_data?.text_answer)
            .filter(Boolean)
            .join(' ');

        console.log('[WordCloud] Combined text blob:', textBlob);

        if (!textBlob.trim()) {
            console.log('[WordCloud] No text content found');
            return [];
        }

        // Professional stop words to filter out
        const stopWords = new Set([
            'the',
            'and',
            'or',
            'but',
            'in',
            'on',
            'at',
            'to',
            'for',
            'of',
            'with',
            'by',
            'is',
            'are',
            'was',
            'were',
            'be',
            'been',
            'being',
            'have',
            'has',
            'had',
            'do',
            'does',
            'did',
            'will',
            'would',
            'could',
            'should',
            'may',
            'might',
            'must',
            'can',
            'cannot',
            'cant',
            'wont',
            'dont',
            'doesnt',
            'didnt',
            'isnt',
            'arent',
            'wasnt',
            'werent',
            'hasnt',
            'havent',
            'hadnt',
            'wouldnt',
            'couldnt',
            'shouldnt',
            'mightnt',
            'mustnt',
            'i',
            'you',
            'he',
            'she',
            'it',
            'we',
            'they',
            'me',
            'him',
            'her',
            'us',
            'them',
            'my',
            'your',
            'his',
            'her',
            'its',
            'our',
            'their',
            'mine',
            'yours',
            'hers',
            'ours',
            'theirs',
            'this',
            'that',
            'these',
            'those',
            'here',
            'there',
            'where',
            'when',
            'why',
            'how',
            'what',
            'which',
            'who',
            'whom',
            'whose',
            'a',
            'an',
            'some',
            'any',
            'all',
            'each',
            'every',
            'no',
            'none',
            'both',
            'either',
            'neither',
            'one',
            'two',
            'three',
            'first',
            'second',
            'last',
            'next',
            'previous',
            'very',
            'much',
            'many',
            'more',
            'most',
            'less',
            'least',
            'few',
            'little',
            'big',
            'small',
            'large',
            'good',
            'bad',
            'best',
            'worst',
            'better',
            'worse',
            'yes',
            'no',
            'ok',
            'okay',
            'well',
            'just',
            'only',
            'also',
            'too',
            'so',
            'then',
            'now',
            'again',
            'once',
            'always',
            'never',
            'sometimes',
            'often',
            'usually',
            'maybe',
            'perhaps',
            'probably',
        ]);

        const wordCounts: { [key: string]: number } = {};

        // Process text and split into words
        const words = textBlob
            .toLowerCase()
            .replace(/[^\w\s]/g, '') // Remove punctuation
            .replace(/\b\d+\b/g, '') // Remove standalone numbers
            .split(/\s+/)
            .filter((word) => word.trim().length > 0); // Remove empty strings

        console.log('[WordCloud] All words after initial processing:', words);

        words.forEach((word, index) => {
            console.log(`[WordCloud] Processing word ${index}: "${word}"`);

            // More stringent filtering for professional appearance
            if (
                word &&
                word.length >= 3 && // Minimum 3 characters
                word.length <= 20 && // Maximum 20 characters to avoid very long words
                !stopWords.has(word.toLowerCase()) && // Check stop words in lowercase
                !/^\d+$/.test(word) && // Not just numbers
                /^[a-zA-Z]+$/.test(word) // Only letters, no mixed alphanumeric
            ) {
                // Always use lowercase as the key to avoid case duplicates
                const normalizedWord = word.toLowerCase();
                wordCounts[normalizedWord] = (wordCounts[normalizedWord] || 0) + 1;
                console.log(
                    `[WordCloud] Added word: "${normalizedWord}" (count: ${wordCounts[normalizedWord]})`
                );
            } else {
                console.log(`[WordCloud] Filtered out word: "${word}" - reasons:`, {
                    tooShort: word.length < 3,
                    tooLong: word.length > 20,
                    isStopWord: stopWords.has(word.toLowerCase()),
                    isNumber: /^\d+$/.test(word),
                    hasNonLetters: !/^[a-zA-Z]+$/.test(word),
                });
            }
        });

        console.log('[WordCloud] Final word counts before sorting:', wordCounts);

        const result = Object.entries(wordCounts)
            .map(([text, value]) => ({
                text: text.charAt(0).toUpperCase() + text.slice(1), // Capitalize for display
                value,
            }))
            .sort((a, b) => b.value - a.value) // Sort by frequency
            .slice(0, 40); // Limit to top 40 words for better visual appearance

        console.log('[WordCloud] Final result:', result);
        console.log('[WordCloud] Total unique words found:', Object.keys(wordCounts).length);
        console.log('[WordCloud] Words in final result:', result.length);

        return result;
    }, [responses]);

    const fontSize: WordCloudProps['fontSize'] = (word) => {
        const minSize = 32; // Increased from 16
        const maxSize = 80; // Increased from 48

        if (words.length === 0) return minSize;

        const values = words.map((w) => w.value);
        const minValue = Math.min(...values);
        const maxValue = Math.max(...values);

        if (minValue === maxValue) {
            return minSize;
        }

        const scale = (value: number) =>
            minSize + ((value - minValue) / (maxValue - minValue)) * (maxSize - minSize);

        return scale(word.value);
    };

    const colors = [
        '#1f2937', // Dark gray
        '#374151', // Medium gray
        '#4f46e5', // Professional indigo
        '#059669', // Professional green
        '#dc2626', // Professional red
        '#b45309', // Professional amber
        '#7c3aed', // Professional purple
        '#0891b2', // Professional cyan
        '#be123c', // Professional rose
        '#166534', // Dark green
        '#1e40af', // Dark blue
        '#92400e', // Dark orange
    ];

    const shouldRenderCloud = size && size.width > 0 && size.height > 0 && words.length > 0;

    console.log('[WordCloud] Render conditions:', {
        hasSize: !!size,
        sizeValues: size,
        hasWords: words.length > 0,
        wordCount: words.length,
        shouldRender: shouldRenderCloud,
    });

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="w-[95vw] max-w-3xl overflow-hidden rounded-2xl border-white/20 bg-white/95 p-0 shadow-2xl backdrop-blur-xl sm:w-full">
                {/* Enhanced background effects */}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-teal-50/50 via-white to-emerald-50/50" />
                <div className="absolute right-1/4 top-0 size-48 rounded-full bg-teal-500/5 blur-3xl" />
                <div className="absolute bottom-0 left-1/4 size-48 rounded-full bg-emerald-500/5 blur-3xl" />

                <DialogHeader className="relative z-10 border-b border-slate-200/50 bg-white/80 p-6 pb-4 backdrop-blur-sm">
                    <DialogTitle className="flex items-center text-2xl font-bold text-slate-800 lg:text-3xl">
                        <div className="mr-3 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 p-2 shadow-lg">
                            <Cloud className="text-white" size={24} />
                        </div>
                        <span className="bg-gradient-to-r from-teal-600 to-emerald-600 bg-clip-text text-transparent">
                            Response Word Cloud
                        </span>
                    </DialogTitle>
                    <DialogDescription className="mt-2 text-slate-600">
                        Visual representation of the most frequently used words in participant
                        responses.
                        {words.length > 0 && (
                            <span className="ml-2 inline-flex items-center gap-1 rounded-lg border border-teal-200/50 bg-teal-100/80 px-2 py-1 backdrop-blur-sm">
                                <Hash size={14} className="text-teal-600" />
                                <span className="font-semibold text-teal-700">{words.length}</span>
                                <span className="text-teal-600">unique words</span>
                            </span>
                        )}
                    </DialogDescription>
                </DialogHeader>

                <div className="relative z-10 p-6">
                    <div
                        ref={containerRef}
                        className="h-[500px] w-full overflow-hidden rounded-2xl border border-slate-200/50 bg-white/50 shadow-inner backdrop-blur-sm"
                    >
                        {shouldRenderCloud ? (
                            <div className="relative size-full">
                                {/* Subtle background pattern */}
                                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-teal-50/30 via-transparent to-emerald-50/30" />
                                <WordCloud
                                    words={words}
                                    width={size.width}
                                    height={size.height}
                                    fontSize={fontSize}
                                    font="Inter"
                                    fill={(_, index) => colors[index % colors.length] || '#000'}
                                />
                            </div>
                        ) : (
                            <div className="flex h-full flex-col items-center justify-center text-center">
                                <div className="mb-6">
                                    <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-gradient-to-r from-teal-300 to-emerald-400 shadow-lg">
                                        {words.length === 0 ? (
                                            <MessageSquare className="text-white" size={32} />
                                        ) : (
                                            <Feather className="text-white" size={32} />
                                        )}
                                    </div>
                                </div>
                                {words.length === 0 ? (
                                    <>
                                        <p className="mb-2 text-lg font-medium text-slate-500">
                                            No text responses submitted yet
                                        </p>
                                        <p className="max-w-md text-sm leading-relaxed text-slate-400">
                                            The word cloud will appear here once participants
                                            respond with text answers. Words will be sized based on
                                            their frequency.
                                        </p>
                                    </>
                                ) : (
                                    <>
                                        <p className="mb-2 text-lg font-medium text-slate-500">
                                            Calculating layout...
                                        </p>
                                        <p className="text-sm text-slate-400">
                                            Please wait while we generate your word cloud.
                                        </p>
                                        {/* Debug info */}
                                        <div className="mt-4 text-xs text-slate-400">
                                            Words: {words.length} | Size:{' '}
                                            {size ? `${size.width}x${size.height}` : 'detecting...'}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter className="relative z-10 rounded-b-2xl border-t border-slate-200/50 bg-white/80 p-4 backdrop-blur-sm">
                    <Button
                        onClick={onClose}
                        variant="outline"
                        className="rounded-xl border-slate-300 bg-white/80 font-semibold text-slate-700 backdrop-blur-sm transition-all duration-200 hover:scale-105 hover:border-teal-400 hover:bg-white hover:text-teal-700"
                    >
                        Close
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
