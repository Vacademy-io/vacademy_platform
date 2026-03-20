import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import './CourseStructureDisplay.css';
import {
    BookOpen,
    FileText,
    Video,
    CheckCircle,
    Clock,
    AlertCircle,
    ChevronRight,
    Sparkles,
    Target,
    Zap,
    Brain,
} from 'lucide-react';

interface Modification {
    action: string;
    targetType: string;
    parentPath?: string | null;
    name: string;
    description?: string;
    node?: {
        id: string;
        name: string;
        type: string;
        key: string;
        depth: number;
        path: string;
    };
}

interface Todo {
    name: string;
    title: string;
    type: string;
    path: string;
    keyword: string;
    model: string;
    actionType: string;
    prompt: string;
    order: number;
}

interface CourseStructureData {
    modifications?: Modification[];
    todos?: Todo[];
    explanation?: string;
    // Handle SLIDE_CONTENT_UPDATE
    type?: string;
    path?: string;
    status?: boolean;
    actionType?: string;
    slideType?: string;
    contentData?: string;
}

interface CourseStructureDisplayProps {
    data: CourseStructureData;
}

const CourseStructureDisplay: React.FC<CourseStructureDisplayProps> = ({ data }) => {
    // Determine if this is a slide content update
    const isSlideContentUpdate = data.type === 'SLIDE_CONTENT_UPDATE';

    const [activeTab, setActiveTab] = useState<'structure' | 'todos' | 'details' | 'content'>(
        isSlideContentUpdate ? 'content' : 'structure'
    );

    // Debug logging (remove in production)
    // console.log('🎨 CourseStructureDisplay rendered with data:', {
    //     hasModifications: !!data.modifications,
    //     modificationsCount: data.modifications?.length || 0,
    //     hasTodos: !!data.todos,
    //     todosCount: data.todos?.length || 0,
    //     hasExplanation: !!data.explanation,
    //     data
    // });

    const getActionIcon = (action: string) => {
        switch (action.toLowerCase()) {
            case 'add':
                return <Zap className="size-4 text-green-500" />;
            case 'update':
                return <AlertCircle className="size-4 text-blue-500" />;
            case 'delete':
                return <AlertCircle className="size-4 text-red-500" />;
            default:
                return <Brain className="size-4 text-gray-500" />;
        }
    };

    const getTypeIcon = (type: string) => {
        switch (type.toLowerCase()) {
            case 'course':
                return <BookOpen className="size-4 text-blue-600" />;
            case 'module':
                return <BookOpen className="size-4 text-purple-600" />;
            case 'chapter':
                return <FileText className="size-4 text-green-600" />;
            case 'slide':
            case 'document':
                return <FileText className="size-4 text-orange-600" />;
            case 'video':
                return <Video className="size-4 text-red-600" />;
            default:
                return <FileText className="size-4 text-gray-600" />;
        }
    };

    const getStatusColor = (actionType: string) => {
        switch (actionType.toLowerCase()) {
            case 'add':
                return 'bg-green-100 text-green-800 border-green-200';
            case 'update':
                return 'bg-blue-100 text-blue-800 border-blue-200';
            case 'delete':
                return 'bg-red-100 text-red-800 border-red-200';
            default:
                return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    const renderStructureView = () => {
        if (!data.modifications || data.modifications.length === 0) {
            return (
                <div className="py-8 text-center text-gray-500">
                    <BookOpen className="mx-auto mb-3 size-12 text-gray-300" />
                    <p>No course structure modifications found</p>
                </div>
            );
        }

        return (
            <div className="space-y-4">
                {data.modifications.map((mod, index) => (
                    <Card
                        key={index}
                        className="course-structure-card course-structure-fade-in w-full border-l-4 border-l-blue-500"
                    >
                        <CardContent className="p-3 sm:p-4">
                            <div className="flex items-start gap-3">
                                <div className="mt-1 shrink-0">{getActionIcon(mod.action)}</div>
                                <div className="min-w-0 flex-1">
                                    <div className="mb-2 flex flex-wrap items-center gap-2">
                                        {getTypeIcon(mod.targetType)}
                                        <h4 className="min-w-0 break-words font-semibold text-gray-900">
                                            {mod.name}
                                        </h4>
                                        <Badge
                                            className={`${getStatusColor(mod.action)} status-badge shrink-0`}
                                        >
                                            {mod.action}
                                        </Badge>
                                    </div>

                                    {mod.description && (
                                        <p className="mb-2 text-sm text-gray-600">
                                            {mod.description}
                                        </p>
                                    )}

                                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 sm:gap-4">
                                        <span className="flex shrink-0 items-center gap-1">
                                            <Target className="size-3" />
                                            Type: {mod.targetType}
                                        </span>
                                        {mod.node && (
                                            <span className="flex min-w-0 items-center gap-1">
                                                <Sparkles className="size-3 shrink-0" />
                                                <span className="break-all">
                                                    Path: {mod.node.path}
                                                </span>
                                            </span>
                                        )}
                                        {mod.parentPath && (
                                            <span className="flex min-w-0 items-center gap-1">
                                                <ChevronRight className="size-3 shrink-0" />
                                                <span className="break-all">
                                                    Parent: {mod.parentPath}
                                                </span>
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        );
    };

    const renderTodosView = () => {
        if (!data.todos || data.todos.length === 0) {
            return (
                <div className="py-8 text-center text-gray-500">
                    <CheckCircle className="mx-auto mb-3 size-12 text-gray-300" />
                    <p>No tasks found</p>
                </div>
            );
        }

        return (
            <div className="space-y-4">
                {data.todos.map((todo, index) => (
                    <Card
                        key={index}
                        className="course-structure-card course-structure-fade-in border-l-4 border-l-orange-500"
                    >
                        <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                                <div className="mt-1 shrink-0">
                                    <Clock className="size-4 text-orange-500" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="mb-2 flex items-center gap-2">
                                        <h4 className="font-semibold text-gray-900">
                                            {todo.title}
                                        </h4>
                                        <Badge variant="outline" className="text-xs">
                                            #{todo.order}
                                        </Badge>
                                    </div>

                                    <p className="mb-3 text-sm text-gray-600">{todo.name}</p>

                                    <div className="mb-3 rounded-lg bg-gray-50 p-3">
                                        <p className="text-sm leading-relaxed text-gray-700">
                                            {todo.prompt.length > 200
                                                ? `${todo.prompt.substring(0, 200)}...`
                                                : todo.prompt}
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-4 text-xs text-gray-500">
                                        <span className="flex items-center gap-1">
                                            {getTypeIcon(todo.type)}
                                            {todo.type}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Brain className="size-3" />
                                            {todo.model}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Target className="size-3" />
                                            {todo.path}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        );
    };

    const renderSlideContentView = () => {
        if (!isSlideContentUpdate || !data.contentData) {
            return (
                <Card>
                    <CardContent className="p-4">
                        <p className="text-center text-gray-500">No slide content available</p>
                    </CardContent>
                </Card>
            );
        }

        return (
            <div className="space-y-4">
                <Card className="course-structure-card course-structure-fade-in border-l-4 border-l-green-500">
                    <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                            <div className="mt-1 shrink-0">
                                <CheckCircle className="size-4 text-green-500" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="mb-2 flex flex-wrap items-center gap-2">
                                    <FileText className="size-4 text-blue-600" />
                                    <h4 className="font-semibold text-gray-900">
                                        Slide Content Generated
                                    </h4>
                                    <Badge className="status-badge bg-green-100 text-green-800">
                                        {data.actionType || 'CREATED'}
                                    </Badge>
                                </div>

                                <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-gray-500">
                                    <span className="flex items-center gap-1">
                                        <Target className="size-3" />
                                        Path: {data.path}
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <FileText className="size-3" />
                                        Type: {data.slideType}
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <CheckCircle className="size-3" />
                                        Status: {data.status ? 'Success' : 'Failed'}
                                    </span>
                                </div>

                                <Card className="bg-gray-50">
                                    <CardContent className="p-3">
                                        <div className="prose prose-sm max-w-none">
                                            <pre className="overflow-x-auto whitespace-pre-wrap text-sm text-gray-700">
                                                {data.contentData}
                                            </pre>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    };

    const renderExplanation = () => {
        if (!data.explanation) {
            return (
                <div className="py-8 text-center text-gray-500">
                    <FileText className="mx-auto mb-3 size-12 text-gray-300" />
                    <p>No explanation provided</p>
                </div>
            );
        }

        // Parse HTML content if it exists
        const cleanExplanation = data.explanation
            .replace(/<[^>]*>/g, '') // Remove HTML tags
            .replace(/\n/g, ' ') // Replace newlines with spaces
            .trim();

        return (
            <Card>
                <CardContent className="p-4">
                    <div className="prose prose-sm max-w-none">
                        <p className="leading-relaxed text-gray-700">{cleanExplanation}</p>
                    </div>
                </CardContent>
            </Card>
        );
    };

    return (
        <div className="course-structure-display w-full max-w-full rounded-xl bg-gradient-to-br from-blue-50 to-indigo-100 p-1">
            <Card className="course-structure-fade-in w-full border-0 shadow-lg">
                <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                        <div className="rounded-lg bg-blue-100 p-2">
                            <Sparkles className="size-5 text-blue-600" />
                        </div>
                        <div>
                            <CardTitle className="text-lg text-gray-900">
                                {isSlideContentUpdate
                                    ? 'Slide Content Generated'
                                    : 'Course Structure Generated'}
                            </CardTitle>
                            <p className="mt-1 text-sm text-gray-600">
                                {isSlideContentUpdate
                                    ? 'AI has generated content for your slide'
                                    : 'AI has created your course structure and tasks'}
                            </p>
                        </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                        {isSlideContentUpdate ? (
                            <>
                                <Button
                                    variant={activeTab === 'content' ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setActiveTab('content')}
                                    className="tab-button text-xs"
                                >
                                    <FileText className="mr-1 size-3" />
                                    Content
                                </Button>
                                {data.explanation && (
                                    <Button
                                        variant={activeTab === 'details' ? 'default' : 'outline'}
                                        size="sm"
                                        onClick={() => setActiveTab('details')}
                                        className="tab-button text-xs"
                                    >
                                        <FileText className="mr-1 size-3" />
                                        Details
                                    </Button>
                                )}
                            </>
                        ) : (
                            <>
                                <Button
                                    variant={activeTab === 'structure' ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setActiveTab('structure')}
                                    className="tab-button text-xs"
                                >
                                    <BookOpen className="mr-1 size-3" />
                                    Structure ({data.modifications?.length || 0})
                                </Button>
                                <Button
                                    variant={activeTab === 'todos' ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setActiveTab('todos')}
                                    className="tab-button text-xs"
                                >
                                    <CheckCircle className="mr-1 size-3" />
                                    Tasks ({data.todos?.length || 0})
                                </Button>
                                <Button
                                    variant={activeTab === 'details' ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setActiveTab('details')}
                                    className="tab-button text-xs"
                                >
                                    <FileText className="mr-1 size-3" />
                                    Details
                                </Button>
                            </>
                        )}
                    </div>
                </CardHeader>

                <CardContent className="pt-0">
                    {activeTab === 'structure' && renderStructureView()}
                    {activeTab === 'todos' && renderTodosView()}
                    {activeTab === 'details' && renderExplanation()}
                    {activeTab === 'content' && renderSlideContentView()}
                </CardContent>
            </Card>
        </div>
    );
};

export default CourseStructureDisplay;
