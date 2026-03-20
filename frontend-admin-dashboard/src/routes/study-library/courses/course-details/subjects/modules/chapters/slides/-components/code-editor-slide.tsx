import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import {
    Code,
    Play,
    Moon,
    Sun,
    Copy,
    Download,
    Eye,
    Edit,
    Settings,
    ChevronDown,
    ChevronUp,
    Maximize2,
    Minimize2,
    GripVertical,
} from 'lucide-react';
import Editor from '@monaco-editor/react';
import { toast } from 'sonner';

// Import constants, types, and utilities
import { CodeEditorData, CodeEditorSlideProps, AllLanguagesData } from './utils/code-editor-types';
import {
    copyCodeToClipboard,
    downloadCodeAsFile,
    handleUserInputSubmission,
    executeCode,
    initializeLanguageStates,
    initializeCurrentData,
} from './utils/code-editor-utils';
import { X } from '@phosphor-icons/react';

export const CodeEditorSlide: React.FC<CodeEditorSlideProps> = ({
    codeData,
    isEditable,
    onDataChange,
}) => {
    const editorRef = useRef<unknown>(null);
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const [output, setOutput] = useState<string>('');
    const [isRunning, setIsRunning] = useState(false);
    const [waitingForInput, setWaitingForInput] = useState(false);
    const [inputValue, setInputValue] = useState<string>('');
    const [isPyodideLoading, setIsPyodideLoading] = useState(false);

    // New state for output panel
    const [isOutputExpanded, setIsOutputExpanded] = useState(false);
    const [isOutputFullScreen, setIsOutputFullScreen] = useState(false);
    const [outputHeight, setOutputHeight] = useState(200); // Default height in pixels
    const [isResizing, setIsResizing] = useState(false);
    const resizeRef = useRef<HTMLDivElement>(null);
    // Store code for each language separately using utility function
    const [languageStates, setLanguageStates] = useState<AllLanguagesData>(() =>
        initializeLanguageStates(codeData)
    );

    // Initialize current data using utility function
    const [currentData, setCurrentData] = useState<CodeEditorData>(() =>
        initializeCurrentData(codeData, languageStates)
    );

    useEffect(() => {
        if (codeData) {
            // Update language states using utility function
            const newLanguageStates = initializeLanguageStates(codeData);
            setLanguageStates(newLanguageStates);

            // Update current data using utility function
            const newCurrentData = initializeCurrentData(codeData, newLanguageStates);
            setCurrentData(newCurrentData);
        }
    }, [codeData]);

    // Force save function for immediate actions
    const forceSave = useCallback(
        (data: CodeEditorData) => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
                saveTimeoutRef.current = null;
            }
            if (onDataChange && isEditable) {
                // Use provided allLanguagesData if available, otherwise use current languageStates
                const dataWithAllLanguages = {
                    ...data,
                    allLanguagesData: data.allLanguagesData || languageStates,
                };
                onDataChange(dataWithAllLanguages);
            }
        },
        [onDataChange, isEditable, languageStates]
    );

    // Debounced save function for API calls
    const debouncedSave = useCallback(
        (data: CodeEditorData) => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }

            saveTimeoutRef.current = setTimeout(() => {
                if (onDataChange && isEditable) {
                    // Use provided allLanguagesData if available, otherwise use current languageStates
                    const dataWithAllLanguages = {
                        ...data,
                        allLanguagesData: data.allLanguagesData || languageStates,
                    };
                    onDataChange(dataWithAllLanguages);
                }
            }, 1500); // 1.5 second delay
        },
        [onDataChange, isEditable, languageStates]
    );

    // Immediate update function for non-code changes (theme, viewMode, language)
    const updateDataImmediate = useCallback(
        (updates: Partial<CodeEditorData>) => {
            const newData = {
                ...currentData,
                ...updates,
                // Always include both languages' data in the update
                allLanguagesData: languageStates,
            };
            setCurrentData(newData);

            // Force save immediately for UI changes
            forceSave(newData);
        },
        [currentData, forceSave, languageStates]
    );

    // Debounced update function for code changes only
    const updateCodeDebounced = useCallback(
        (code: string) => {
            // Create updated language states with the latest code
            const updatedLanguageStates = {
                ...languageStates,
                [currentData.language]: {
                    code: code,
                    lastEdited: Date.now(),
                },
            };

            const newData = {
                ...currentData,
                code,
                // Always include both languages' data with the latest code
                allLanguagesData: updatedLanguageStates,
            };
            setCurrentData(newData);

            // Use debounced save for code changes
            debouncedSave(newData);
        },
        [currentData, debouncedSave, languageStates]
    );

    const handleThemeChange = useCallback(() => {
        const newTheme = currentData.theme === 'light' ? 'dark' : 'light';
        updateDataImmediate({ theme: newTheme });
    }, [currentData.theme, updateDataImmediate]);

    const handleViewModeChange = useCallback(
        (viewMode: 'view' | 'edit') => {
            updateDataImmediate({ viewMode });
        },
        [updateDataImmediate]
    );

    const handleCodeChange = useCallback(
        (value: string | undefined) => {
            if (value !== undefined) {
                // Update language state store for persistence
                setLanguageStates((prev) => ({
                    ...prev,
                    [currentData.language]: {
                        code: value,
                        lastEdited: Date.now(),
                    },
                }));

                // Update current data with debounced save for code changes
                updateCodeDebounced(value);
            }
        },
        [updateCodeDebounced, currentData.language, setLanguageStates]
    );

    const handleCopyCode = useCallback(() => {
        const currentCode = getCurrentCodeFromEditor();

        try {
            copyCodeToClipboard(currentCode);
            toast.success('Code copied to clipboard!', {
                description: `${currentData.language} code has been copied successfully.`,
                duration: 2000,
            });
        } catch (error) {
            console.error('Failed to copy code:', error);
            toast.error('Failed to copy code', {
                description: 'Please try again or copy manually.',
                duration: 3000,
            });
        }
    }, [currentData.language]);

    const handleDownloadCode = useCallback(() => {
        const currentCode = getCurrentCodeFromEditor();

        try {
            downloadCodeAsFile(currentCode, currentData.language);
            toast.success('Code downloaded successfully!', {
                description: `${currentData.language} code has been saved to your downloads.`,
                duration: 2000,
            });
        } catch (error) {
            console.error('Failed to download code:', error);
            toast.error('Failed to download code', {
                description: 'Please try again or save manually.',
                duration: 3000,
            });
        }
    }, [currentData.language]);

    const handleInputSubmit = useCallback(() => {
        if (inputValue.trim()) {
            const newOutput = handleUserInputSubmission(inputValue, currentData.language, output);
            setOutput(newOutput);
            setInputValue('');
            setWaitingForInput(false);
        }
    }, [inputValue, currentData.language, output]);

    // Helper function to get the current code from the editor
    const getCurrentCodeFromEditor = useCallback((): string => {
        if (
            editorRef.current &&
            typeof editorRef.current === 'object' &&
            'getValue' in editorRef.current
        ) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return (editorRef.current as any).getValue() || '';
        }
        // Fallback to current data or language state
        return currentData.code || languageStates[currentData.language].code;
    }, [currentData.code, currentData.language, languageStates]);

    const runCode = useCallback(async () => {
        // Get the most current code from the editor before running
        const currentCode = getCurrentCodeFromEditor();

        setIsRunning(true);
        setIsPyodideLoading(true);
        setIsOutputExpanded(true); // Auto-expand output when running
        setOutput('Loading Python environment...');

        try {
            const { output, needsInput } = await executeCode(currentCode, currentData.language);
            setOutput(output);
            setWaitingForInput(needsInput);
        } catch (error) {
            setOutput(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsRunning(false);
            setIsPyodideLoading(false);
        }
    }, [currentData.language, getCurrentCodeFromEditor]);

    const handleEditorDidMount = (editor: unknown) => {
        editorRef.current = editor;
    };

    // Output panel controls
    const toggleOutputExpanded = useCallback(() => {
        setIsOutputExpanded(!isOutputExpanded);
        if (isOutputFullScreen) {
            setIsOutputFullScreen(false);
        }
    }, [isOutputExpanded, isOutputFullScreen]);

    const toggleOutputFullScreen = useCallback(() => {
        setIsOutputFullScreen(!isOutputFullScreen);
    }, [isOutputFullScreen]);

    // Resize functionality
    const handleResizeStart = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        setIsResizing(true);
    }, []);

    const handleResizeMove = useCallback(
        (e: MouseEvent) => {
            if (!isResizing) return;

            const container = resizeRef.current?.parentElement;
            if (!container) return;

            const containerRect = container.getBoundingClientRect();
            const newHeight = containerRect.bottom - e.clientY;

            // Set minimum and maximum heights
            const minHeight = 100;
            const maxHeight = window.innerHeight * 0.8;

            if (newHeight >= minHeight && newHeight <= maxHeight) {
                setOutputHeight(newHeight);
            }
        },
        [isResizing]
    );

    const handleResizeEnd = useCallback(() => {
        setIsResizing(false);
    }, []);

    // Add keyboard shortcut for running code
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                event.preventDefault();
                if (!isRunning) {
                    runCode();
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isRunning, isEditable, runCode]);

    // Add resize event listeners
    useEffect(() => {
        if (isResizing) {
            document.addEventListener('mousemove', handleResizeMove);
            document.addEventListener('mouseup', handleResizeEnd);
        }
        return () => {
            document.removeEventListener('mousemove', handleResizeMove);
            document.removeEventListener('mouseup', handleResizeEnd);
        };
    }, [isResizing, handleResizeMove, handleResizeEnd]);

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
        };
    }, []);

    // Calculate editor height based on output panel state
    const getEditorHeight = () => {
        if (isOutputFullScreen) return '0px';
        if (!isOutputExpanded) return '100%';
        return `calc(100% - ${outputHeight}px)`;
    };

    return (
        <Card className="h-full">
            <CardHeader className="pb-2">
                <div className="flex flex-col items-center justify-between gap-2 lg:flex-row">
                    <CardTitle className="flex items-center gap-2">
                        <Code className="size-5" />
                        Code Editor
                        <span className="ml-2 rounded-full bg-gray-100 px-2 py-1 text-xs font-normal text-gray-600">
                            {currentData.viewMode === 'edit' ? 'Edit Mode' : 'View Mode'}
                        </span>
                    </CardTitle>

                    <div className="flex items-center gap-2">
                        <Button
                            onClick={runCode}
                            disabled={isRunning}
                            size="sm"
                            className="bg-green-600 text-white hover:bg-green-700"
                        >
                            <Play className="mr-1 size-4" />
                            {isRunning ? (isPyodideLoading ? 'Loading...' : 'Running...') : 'Run'}
                        </Button>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm">
                                    <Settings className="mr-1 size-4" />
                                    Settings
                                    <ChevronDown className="ml-1 size-3" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                                <DropdownMenuItem className="flex items-center justify-between">
                                    <span>View/Edit Mode</span>
                                    <div className="flex items-center gap-1">
                                        <Eye className="size-3" />
                                        <Switch
                                            checked={currentData.viewMode === 'edit'}
                                            onCheckedChange={(checked) =>
                                                handleViewModeChange(checked ? 'edit' : 'view')
                                            }
                                            disabled={!isEditable}
                                        />
                                        <Edit className="size-3" />
                                    </div>
                                </DropdownMenuItem>

                                <DropdownMenuSeparator />

                                <DropdownMenuItem
                                    onClick={handleThemeChange}
                                    disabled={!isEditable}
                                >
                                    {currentData.theme === 'light' ? (
                                        <>
                                            <Moon className="mr-2 size-4" />
                                            Switch to Dark Theme
                                        </>
                                    ) : (
                                        <>
                                            <Sun className="mr-2 size-4" />
                                            Switch to Light Theme
                                        </>
                                    )}
                                </DropdownMenuItem>

                                <DropdownMenuSeparator />

                                <DropdownMenuItem onClick={handleCopyCode}>
                                    <Copy className="mr-2 size-4" />
                                    Copy Code
                                </DropdownMenuItem>

                                <DropdownMenuItem onClick={handleDownloadCode}>
                                    <Download className="mr-2 size-4" />
                                    Download Code
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <div className="flex h-[550px] flex-col">
                    {/* Code Editor Section */}
                    <div className="flex-1 border-t" style={{ height: getEditorHeight() }}>
                        <Editor
                            height="100%"
                            language={currentData.language}
                            value={currentData.code}
                            theme={currentData.theme === 'dark' ? 'vs-dark' : 'light'}
                            onChange={handleCodeChange}
                            onMount={handleEditorDidMount}
                            options={{
                                readOnly: !isEditable || currentData.viewMode === 'view',
                                minimap: { enabled: false },
                                scrollBeyondLastLine: false,
                                automaticLayout: true,
                                fontSize: 14,
                                lineNumbers: 'on',
                                roundedSelection: false,
                                scrollbar: {
                                    verticalScrollbarSize: 8,
                                    horizontalScrollbarSize: 8,
                                },
                                padding: { top: 16 },
                                // Optimize for smooth language switching
                                quickSuggestions: true,
                                suggestOnTriggerCharacters: true,
                            }}
                        />
                    </div>

                    {/* Output Panel */}
                    {isOutputExpanded && (
                        <>
                            {/* Resize Handle */}
                            <div
                                ref={resizeRef}
                                className="flex h-1 cursor-ns-resize items-center justify-center bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600"
                                onMouseDown={handleResizeStart}
                            >
                                <GripVertical className="size-4 text-gray-500" />
                            </div>

                            {/* Output Content */}
                            <div
                                className="flex flex-col overflow-y-scroll border-t"
                                style={{
                                    height: isOutputFullScreen ? '100vh' : `${outputHeight}px`,
                                }}
                            >
                                {/* Output Header */}
                                <div className="flex items-center justify-between border-b bg-gray-50 px-4 py-2 dark:bg-gray-800">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium">Console</span>
                                        {output && !isRunning && (
                                            <span className="inline-flex size-2 rounded-full bg-green-500"></span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={toggleOutputFullScreen}
                                            className="size-8 p-0"
                                        >
                                            {isOutputFullScreen ? (
                                                <Minimize2 className="size-4" />
                                            ) : (
                                                <Maximize2 className="size-4" />
                                            )}
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={toggleOutputExpanded}
                                            className="size-8 p-0"
                                        >
                                            <X className="size-4" />
                                        </Button>
                                    </div>
                                </div>

                                {/* Output Content */}
                                <div className="flex-1 overflow-auto bg-gray-900 p-4 font-mono text-sm text-green-400">
                                    <pre className="whitespace-pre-wrap">
                                        {isPyodideLoading && isRunning
                                            ? 'Loading Python environment (this may take a few seconds on first run)...'
                                            : output || 'Click "Run Code" to see output here...'}
                                    </pre>
                                    {waitingForInput && (
                                        <div className="mt-2 flex items-center gap-2">
                                            <span className="text-yellow-400">{'> '}</span>
                                            <input
                                                type="text"
                                                value={inputValue}
                                                onChange={(e) => setInputValue(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        handleInputSubmit();
                                                    }
                                                }}
                                                className="flex-1 border-none bg-transparent text-green-400 outline-none"
                                                placeholder="Type your input and press Enter..."
                                                autoFocus
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* Input Controls */}
                                {waitingForInput && (
                                    <div className="border-t border-gray-700 bg-gray-800 p-2">
                                        <div className="flex gap-2">
                                            <button
                                                onClick={handleInputSubmit}
                                                className="rounded bg-green-600 px-3 py-1 text-sm text-white hover:bg-green-700"
                                            >
                                                Submit
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setWaitingForInput(false);
                                                    setInputValue('');
                                                }}
                                                className="rounded bg-gray-600 px-3 py-1 text-sm text-white hover:bg-gray-700"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {/* Output Toggle Button (when collapsed) */}
                    {!isOutputExpanded && (
                        <div className="border-t p-2">
                            <Button variant="outline" size="sm" onClick={toggleOutputExpanded}>
                                <ChevronUp className="mr-1 size-4" />
                                Show Output
                            </Button>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};
