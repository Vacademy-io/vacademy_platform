/* eslint-disable complexity */
import React, { useState, useEffect } from 'react';
import { Check, ChevronRight, Clock, Target, Play, Pause } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { aiResponseMemory, type TodoTask } from '@/services/aiResponseMemory';
import './styles/TodoProgress.css';

interface TodoProgressProps {
    onTaskClick?: (task: TodoTask) => void;
    onStartAutomation?: () => void;
    isAutomationRunning?: boolean;
}

export const TodoProgress: React.FC<TodoProgressProps> = ({
    onTaskClick,
    onStartAutomation,
    isAutomationRunning = false,
}) => {
    const [todos, setTodos] = useState<TodoTask[]>([]);
    const [completed, setCompleted] = useState<TodoTask[]>([]);
    const [currentTask, setCurrentTask] = useState<TodoTask | null>(null);

    // Load todos from memory
    useEffect(() => {
        const loadTodos = () => {
            const allTodos = aiResponseMemory.getAllTodos();
            const pending = allTodos.filter((t) => !t.completed);
            const done = allTodos.filter((t) => t.completed);

            // Only log when there are changes
            const hasChanges = todos.length !== pending.length || completed.length !== done.length;
            if (hasChanges) {
                console.log('🎯 [TODO UI] Loading todos from memory...');
                console.log('🎯 [TODO UI] Loaded todos:', {
                    total: allTodos.length,
                    pending: pending.length,
                    completed: done.length,
                });
            }

            setTodos(pending);
            setCompleted(done);

            // Set current task (first pending task)
            if (pending.length > 0 && !currentTask) {
                const first = pending[0];
                if (first) {
                    setCurrentTask(first);
                    console.log('🎯 [TODO UI] Set current task:', first.title);
                }
            } else if (pending.length === 0 && currentTask) {
                setCurrentTask(null);
                console.log('🎯 [TODO UI] All tasks completed, cleared current task');
            }
        };

        loadTodos();

        // Refresh every 3 seconds to catch updates (reduced frequency)
        const interval = setInterval(loadTodos, 3000);
        return () => clearInterval(interval);
    }, [todos.length, completed.length, currentTask]);

    const handleTaskClick = (task: TodoTask) => {
        setCurrentTask(task);
        onTaskClick?.(task);
    };

    const handleManualComplete = (task: TodoTask) => {
        console.log('🎯 [TODO UI] User manually completing task:', {
            id: task.id,
            title: task.title,
            type: task.type,
        });
        aiResponseMemory.markTodoCompleted(task.id);
        setCurrentTask(null);
        console.log('🎯 [TODO UI] Task marked complete, cleared current task');
    };

    const progress =
        todos.length + completed.length > 0
            ? (completed.length / (todos.length + completed.length)) * 100
            : 0;

    const getTaskIcon = (task: TodoTask) => {
        switch (task.type) {
            case 'subject':
                return '📚';
            case 'module':
                return '📋';
            case 'chapter':
                return '📄';
            case 'slide':
                return '🎯';
            default:
                return '📝';
        }
    };

    const getTypeColor = (type: string) => {
        switch (type) {
            case 'subject':
                return 'text-blue-600 bg-blue-50 border-blue-200';
            case 'module':
                return 'text-green-600 bg-green-50 border-green-200';
            case 'chapter':
                return 'text-purple-600 bg-purple-50 border-purple-200';
            case 'slide':
                return 'text-orange-600 bg-orange-50 border-orange-200';
            default:
                return 'text-gray-600 bg-gray-50 border-gray-200';
        }
    };

    if (todos.length === 0 && completed.length === 0) {
        return null; // Don't show if no todos
    }

    return (
        <Card className="todo-progress-card">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-sm font-medium">
                        <Target className="size-4" />
                        Course Generation Tasks
                    </CardTitle>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">
                            {completed.length}/{todos.length + completed.length}
                        </span>
                        {todos.length > 0 && onStartAutomation && (
                            <Button
                                size="sm"
                                variant={isAutomationRunning ? 'secondary' : 'default'}
                                onClick={onStartAutomation}
                                disabled={isAutomationRunning}
                                className="h-6 px-2 text-xs"
                            >
                                {isAutomationRunning ? (
                                    <>
                                        <Pause className="mr-1 size-3" />
                                        Running...
                                    </>
                                ) : (
                                    <>
                                        <Play className="mr-1 size-3" />
                                        Start
                                    </>
                                )}
                            </Button>
                        )}
                    </div>
                </div>

                {todos.length + completed.length > 0 && (
                    <div className="space-y-1">
                        <Progress value={progress} className="h-1.5" />
                        <div className="text-xs text-gray-500">
                            {completed.length > 0 && `${completed.length} completed`}
                            {todos.length > 0 && completed.length > 0 && ', '}
                            {todos.length > 0 && `${todos.length} remaining`}
                        </div>
                    </div>
                )}
            </CardHeader>

            <CardContent className="space-y-2 pt-0">
                {/* Current Task */}
                {currentTask && (
                    <div className="current-task">
                        <div className="mb-1 flex items-center gap-1 text-xs font-medium text-gray-700">
                            <Clock className="size-3" />
                            Current Task
                        </div>
                        <div
                            className={`task-item current ${getTypeColor(currentTask.type)}`}
                            onClick={() => handleTaskClick(currentTask)}
                        >
                            <div className="task-icon">
                                {isAutomationRunning ? (
                                    <div className="size-3 animate-spin rounded-full border border-gray-400 border-t-gray-600" />
                                ) : (
                                    <ChevronRight className="size-3" />
                                )}
                            </div>
                            <div className="task-content">
                                <div className="task-title">
                                    {getTaskIcon(currentTask)} {currentTask.title}
                                </div>
                                <div className="task-description">{currentTask.description}</div>
                            </div>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleManualComplete(currentTask);
                                }}
                                className="h-6 px-2 text-xs"
                            >
                                Done
                            </Button>
                        </div>
                    </div>
                )}

                {/* Pending Tasks */}
                {todos.slice(currentTask ? 1 : 0).length > 0 && (
                    <div className="pending-tasks">
                        <div className="mb-1 text-xs font-medium text-gray-600">
                            Upcoming ({todos.slice(currentTask ? 1 : 0).length})
                        </div>
                        <div className="space-y-1">
                            {todos.slice(currentTask ? 1 : 0, 3).map(
                                (
                                    task // Show max 3
                                ) => (
                                    <div
                                        key={task.id}
                                        className={`task-item pending ${getTypeColor(task.type)}`}
                                        onClick={() => handleTaskClick(task)}
                                    >
                                        <div className="task-icon">
                                            <ChevronRight className="size-3 text-gray-400" />
                                        </div>
                                        <div className="task-content">
                                            <div className="task-title">
                                                {getTaskIcon(task)} {task.title}
                                            </div>
                                        </div>
                                    </div>
                                )
                            )}
                            {todos.slice(currentTask ? 1 : 0).length > 3 && (
                                <div className="pl-6 text-xs text-gray-500">
                                    +{todos.slice(currentTask ? 1 : 0).length - 3} more tasks...
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Completed Tasks */}
                {completed.length > 0 && (
                    <div className="completed-tasks">
                        <div className="mb-1 text-xs font-medium text-green-600">
                            Completed ({completed.length})
                        </div>
                        <div className="space-y-1">
                            {completed.slice(-2).map(
                                (
                                    task // Show last 2 completed
                                ) => (
                                    <div
                                        key={task.id}
                                        className="task-item completed"
                                        onClick={() => handleTaskClick(task)}
                                    >
                                        <div className="task-icon">
                                            <Check className="size-3 text-green-600" />
                                        </div>
                                        <div className="task-content">
                                            <div className="task-title completed-text">
                                                {getTaskIcon(task)} {task.title}
                                            </div>
                                        </div>
                                        <div className="completion-time">
                                            {task.completedAt?.toLocaleTimeString([], {
                                                hour: '2-digit',
                                                minute: '2-digit',
                                            })}
                                        </div>
                                    </div>
                                )
                            )}
                            {completed.length > 2 && (
                                <div className="pl-6 text-xs text-gray-500">
                                    +{completed.length - 2} more completed...
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default TodoProgress;
