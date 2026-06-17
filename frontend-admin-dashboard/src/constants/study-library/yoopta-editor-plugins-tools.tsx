import { YooptaPlugin, SlateElement } from '@yoopta/editor';
import Paragraph from '@yoopta/paragraph';
import Blockquote from '@yoopta/blockquote';
import Embed from '@yoopta/embed';
import Image from '@yoopta/image';
import Link from '@yoopta/link';
import Callout from '@yoopta/callout';
import Video from '@yoopta/video';
import File from '@yoopta/file';
import Accordion from '@yoopta/accordion';
import { NumberedList, BulletedList, TodoList } from '@yoopta/lists';
import { Bold, Italic, CodeMark, Underline, Strike, Highlight } from '@yoopta/marks';
import { HeadingOne, HeadingThree, HeadingTwo } from '@yoopta/headings';
import Code from '@yoopta/code';
import { CodeWithPreservedNewlines } from '@/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-components/yoopta-editor-customizations/code-plugin-override';
import Table from '@yoopta/table';
import Divider from '@yoopta/divider';
import ActionMenuList, { DefaultActionMenuRender } from '@yoopta/action-menu-list';
import Toolbar, { DefaultToolbarRender } from '@yoopta/toolbar';
import LinkTool, { DefaultLinkToolRender } from '@yoopta/link-tool';
import { getPublicUrl, UploadFileInS3 } from '@/services/upload_file';
import { getTokenDecodedData, getTokenFromCookie } from '@/lib/auth/sessionUtility';
import { TokenKey } from '../auth/tokens';
import { MultiLangCodePlugin } from '@/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-components/yoopta-editor-customizations/python-editor';
import { JupyterNotebookPlugin } from '@/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-components/yoopta-editor-customizations/jupyter-notebook';
import { ScratchPlugin } from '@/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-components/yoopta-editor-customizations/scratch-editor';
import { MermaidPlugin } from '@/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-components/yoopta-editor-customizations/mermaid-editor';
import { MathPlugin } from '@/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-components/yoopta-editor-customizations/math-editor';
import { AudioPlugin } from '@/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-components/yoopta-editor-customizations/audio-player';
import { TimelinePlugin } from '@/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-components/yoopta-editor-customizations/timeline-editor';
import { QuizBlockPlugin } from '@/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-components/yoopta-editor-customizations/quiz-block-editor';
import { ColumnsPlugin } from '@/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-components/yoopta-editor-customizations/columns-editor';
import { TableOfContentsPlugin } from '@/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-components/yoopta-editor-customizations/table-of-contents';
import { FlashcardPlugin } from '@/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-components/yoopta-editor-customizations/flashcard-editor';
import { FillBlanksPlugin } from '@/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-components/yoopta-editor-customizations/fill-blanks-editor';
import { TabsPlugin } from '@/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-components/yoopta-editor-customizations/tabs-editor';
import { PdfViewerPlugin } from '@/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-components/yoopta-editor-customizations/pdf-viewer';

/** Extract userId from JWT token */
function getUserIdFromToken(): string {
    const accessToken = getTokenFromCookie(TokenKey.accessToken);
    const data = getTokenDecodedData(accessToken);
    return data?.sub || 'unknown-user';
}

/** Get image natural dimensions (returns 0x0 on failure) */
function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
    return new Promise((resolve) => {
        const url = URL.createObjectURL(file);
        const img = new window.Image();
        img.onload = () => {
            resolve({ width: img.naturalWidth, height: img.naturalHeight });
            URL.revokeObjectURL(url);
        };
        img.onerror = () => {
            resolve({ width: 0, height: 0 });
            URL.revokeObjectURL(url);
        };
        img.src = url;
    });
}

export const plugins: YooptaPlugin<Record<string, SlateElement>, Record<string, unknown>>[] = [
    Paragraph,
    Table as unknown as YooptaPlugin<Record<string, SlateElement>, Record<string, unknown>>,
    Divider,
    Accordion as unknown as YooptaPlugin<Record<string, SlateElement>, Record<string, unknown>>,
    // Markdown-on-space auto-format disabled (shortcuts: []). Yoopta converts a
    // block when you type a trigger + space ("1." → numbered list, "#" → heading,
    // ">" → quote, etc.), but its transform REPLACES the whole block — so typing
    // the trigger on a line that already has text WIPED the content (e.g. "1. "
    // inside an existing list item). Blocks are still creatable via the "/" slash
    // menu and the toolbar (those use `commands`, not `shortcuts`); Enter-to-
    // continue, paste, and HTML deserialize all live on other plugin keys and are
    // unaffected.
    HeadingOne.extend({ options: { shortcuts: [] } }),
    HeadingTwo.extend({ options: { shortcuts: [] } }),
    HeadingThree.extend({ options: { shortcuts: [] } }),
    Blockquote.extend({ options: { shortcuts: [] } }),
    Callout.extend({ options: { shortcuts: [] } }),
    NumberedList.extend({ options: { shortcuts: [] } }),
    BulletedList.extend({ options: { shortcuts: [] } }),
    TodoList.extend({ options: { shortcuts: [] } }),
    CodeWithPreservedNewlines(Code) as unknown as YooptaPlugin<
        Record<string, SlateElement>,
        Record<string, unknown>
    >,
    Link,
    Embed,
    MermaidPlugin as unknown as YooptaPlugin<Record<string, SlateElement>, Record<string, unknown>>,
    Image.extend({
        options: {
            async onUpload(file) {
                try {
                    const accessToken = getTokenFromCookie(TokenKey.accessToken);
                    const data = getTokenDecodedData(accessToken);
                    const INSTITUTE_ID = data && Object.keys(data.authorities)[0];
                    const userId = getUserIdFromToken();

                    // Get actual image dimensions and upload in parallel
                    const [dimensions, fileId] = await Promise.all([
                        getImageDimensions(file),
                        UploadFileInS3(file, () => {}, userId, INSTITUTE_ID, 'STUDENTS', true),
                    ]);

                    if (!fileId) {
                        throw new Error('File upload failed');
                    }

                    const publicUrl = await getPublicUrl(fileId);

                    if (!publicUrl) {
                        throw new Error('Failed to get public URL');
                    }

                    return {
                        src: publicUrl,
                        alt: file.name,
                        sizes: dimensions,
                    };
                } catch (error) {
                    console.error('Upload failed:', error);
                    throw error;
                }
            },
        },
    }),
    Video.extend({
        options: {
            async onUpload(file) {
                try {
                    const accessToken = getTokenFromCookie(TokenKey.accessToken);
                    const data = getTokenDecodedData(accessToken);
                    const INSTITUTE_ID = data && Object.keys(data.authorities)[0];
                    const userId = getUserIdFromToken();
                    const fileId = await UploadFileInS3(
                        file,
                        () => {},
                        userId,
                        INSTITUTE_ID,
                        'STUDENTS',
                        true
                    );

                    if (!fileId) {
                        throw new Error('File upload failed');
                    }

                    const publicUrl = await getPublicUrl(fileId);

                    if (!publicUrl) {
                        throw new Error('Failed to get public URL');
                    }

                    return {
                        src: publicUrl,
                        alt: file.name,
                        sizes: { width: 0, height: 0 },
                    };
                } catch (error) {
                    console.error('Upload failed:', error);
                    throw error;
                }
            },
        },
    }),
    File.extend({
        options: {
            onUpload: async (file) => {
                const accessToken = getTokenFromCookie(TokenKey.accessToken);
                const data = getTokenDecodedData(accessToken);
                const INSTITUTE_ID = data && Object.keys(data.authorities)[0];
                const userId = getUserIdFromToken();
                const fileId = await UploadFileInS3(
                    file,
                    () => {},
                    userId,
                    INSTITUTE_ID,
                    'STUDENTS',
                    true
                );

                if (!fileId) {
                    throw new Error('File upload failed');
                }

                const publicUrl = await getPublicUrl(fileId);

                if (!publicUrl) {
                    throw new Error('Failed to get public URL');
                }

                return {
                    src: publicUrl,
                    format: file.type,
                    name: file.name,
                    size: file.size,
                };
            },
        },
    }),
    MultiLangCodePlugin,
    JupyterNotebookPlugin,
    ScratchPlugin,
    MathPlugin as unknown as YooptaPlugin<Record<string, SlateElement>, Record<string, unknown>>,
    AudioPlugin as unknown as YooptaPlugin<Record<string, SlateElement>, Record<string, unknown>>,
    TimelinePlugin as unknown as YooptaPlugin<Record<string, SlateElement>, Record<string, unknown>>,
    QuizBlockPlugin as unknown as YooptaPlugin<Record<string, SlateElement>, Record<string, unknown>>,
    ColumnsPlugin as unknown as YooptaPlugin<Record<string, SlateElement>, Record<string, unknown>>,
    TableOfContentsPlugin as unknown as YooptaPlugin<Record<string, SlateElement>, Record<string, unknown>>,
    FlashcardPlugin as unknown as YooptaPlugin<Record<string, SlateElement>, Record<string, unknown>>,
    FillBlanksPlugin as unknown as YooptaPlugin<Record<string, SlateElement>, Record<string, unknown>>,
    TabsPlugin as unknown as YooptaPlugin<Record<string, SlateElement>, Record<string, unknown>>,
    PdfViewerPlugin as unknown as YooptaPlugin<Record<string, SlateElement>, Record<string, unknown>>,
];

export const TOOLS = {
    ActionMenu: {
        render: DefaultActionMenuRender,
        tool: ActionMenuList,
    },
    Toolbar: {
        render: DefaultToolbarRender,
        tool: Toolbar,
    },
    LinkTool: {
        render: DefaultLinkToolRender,
        tool: LinkTool,
    },
};

export const MARKS = [Bold, Italic, CodeMark, Underline, Strike, Highlight];
