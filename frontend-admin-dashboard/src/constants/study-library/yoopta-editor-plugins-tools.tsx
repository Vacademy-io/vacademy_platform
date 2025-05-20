import { YooptaPlugin, SlateElement } from "@yoopta/editor";
import Paragraph from "@yoopta/paragraph";
import Blockquote from "@yoopta/blockquote";
import Embed from "@yoopta/embed";
import Image from "@yoopta/image";
import Link from "@yoopta/link";
import Callout from "@yoopta/callout";
import Video from "@yoopta/video";
import File from "@yoopta/file";
import Accordion from "@yoopta/accordion";
import { NumberedList, BulletedList, TodoList } from "@yoopta/lists";
import { Bold, Italic, CodeMark, Underline, Strike, Highlight } from "@yoopta/marks";
import { HeadingOne, HeadingThree, HeadingTwo } from "@yoopta/headings";
import Code from "@yoopta/code";
import Table from "@yoopta/table";
import Divider from "@yoopta/divider";
import ActionMenuList, { DefaultActionMenuRender } from "@yoopta/action-menu-list";
import Toolbar, { DefaultToolbarRender } from "@yoopta/toolbar";
import LinkTool, { DefaultLinkToolRender } from "@yoopta/link-tool";
import { getPublicUrl, UploadFileInS3 } from "@/services/upload_file";
import { getTokenDecodedData, getTokenFromCookie } from "@/lib/auth/sessionUtility";
import { TokenKey } from "../auth/tokens";

export const plugins: YooptaPlugin<Record<string, SlateElement>, Record<string, unknown>>[] = [
    Paragraph,
    Table as unknown as YooptaPlugin<Record<string, SlateElement>, Record<string, unknown>>,
    Divider,
    Accordion as unknown as YooptaPlugin<Record<string, SlateElement>, Record<string, unknown>>,
    HeadingOne,
    HeadingTwo,
    HeadingThree,
    Blockquote,
    Callout,
    NumberedList,
    BulletedList,
    TodoList,
    Code,
    Link,
    Embed,
    Image.extend({
        options: {
            async onUpload(file) {
                try {
                    // Use the underlying functions directly instead of the hook
                    const accessToken = getTokenFromCookie(TokenKey.accessToken);
                    const data = getTokenDecodedData(accessToken);
                    const INSTITUTE_ID = data && Object.keys(data.authorities)[0];
                    const fileId = await UploadFileInS3(
                        file,
                        () => {}, // setIsUploading
                        "your-user-id",
                        INSTITUTE_ID,
                        "STUDENTS",
                        true, // publicUrl
                    );

                    if (!fileId) {
                        throw new Error("File upload failed");
                    }

                    const publicUrl = await getPublicUrl(fileId);

                    if (!publicUrl) {
                        throw new Error("Failed to get public URL");
                    }

                    return {
                        src: publicUrl,
                        alt: file.name,
                        sizes: {
                            width: 0, // Replace with actual dimensions if needed
                            height: 0,
                        },
                    };
                } catch (error) {
                    console.error("Upload failed:", error);
                    throw error;
                }
            },
        },
    }),
    Video.extend({
        options: {
            async onUpload(file) {
                try {
                    // Use the underlying functions directly instead of the hook
                    const accessToken = getTokenFromCookie(TokenKey.accessToken);
                    const data = getTokenDecodedData(accessToken);
                    const INSTITUTE_ID = data && Object.keys(data.authorities)[0];
                    const fileId = await UploadFileInS3(
                        file,
                        () => {}, // setIsUploading
                        "your-user-id",
                        INSTITUTE_ID,
                        "STUDENTS",
                        true, // publicUrl
                    );

                    if (!fileId) {
                        throw new Error("File upload failed");
                    }

                    const publicUrl = await getPublicUrl(fileId);

                    if (!publicUrl) {
                        throw new Error("Failed to get public URL");
                    }

                    return {
                        src: publicUrl,
                        alt: file.name,
                        sizes: {
                            width: 0, // Replace with actual dimensions if needed
                            height: 0,
                        },
                    };
                } catch (error) {
                    console.error("Upload failed:", error);
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
                const fileId = await UploadFileInS3(
                    file,
                    () => {}, // setIsUploading
                    "your-user-id",
                    INSTITUTE_ID,
                    "STUDENTS",
                    true, // publicUrl
                );

                if (!fileId) {
                    throw new Error("File upload failed");
                }

                const publicUrl = await getPublicUrl(fileId);

                if (!publicUrl) {
                    throw new Error("Failed to get public URL");
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
