import { useState } from 'react';
import {
    ArrowsOut,
    Bell,
    DeviceMobile,
    EnvelopeSimple,
    Laptop,
    Lightbulb,
    PushPin,
    WhatsappLogo,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { MyButton } from '@/components/design-system/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MyDialog } from '@/components/design-system/dialog';
import type { MediumType, ModeType } from '@/services/announcement';
import type { WhatsAppTemplateDTO } from '@/routes/communication/whatsapp-templates/-services/template-api';
import type { PushConfig, WhatsAppConfig } from '../-types';
import { WHATSAPP_VALUE_SOURCES } from '../-utils/constants';
import { whatsAppVariableNames } from '../-utils/validation';

interface PreviewRailProps {
    title: string;
    previewText: string;
    htmlContent: string;
    contentText: string;
    modes: ModeType[];
    mediums: MediumType[];
    push: PushConfig;
    whatsapp: WhatsAppConfig;
    whatsappTemplate: WhatsAppTemplateDTO | null;
    senderName: string;
    tips: string[];
    /** Controlled full-screen preview, so the footer can open it on narrow screens. */
    expanded: boolean;
    onExpandedChange: (expanded: boolean) => void;
    /** Applied to the inline card — used to hide it below the xl breakpoint while the
     *  full-screen dialog stays mounted so the footer's Preview button still works. */
    cardClassName?: string;
}

const isFullDocument = (html: string) =>
    /<html[\s\S]*<\/html>/i.test(html) ||
    /<head[\s\S]*<\/head>/i.test(html) ||
    /<body[\s\S]*<\/body>/i.test(html);

/** Wrap fragment HTML so the iframe renders it the way an inbox would. */
const emailDocument = (html: string) =>
    isFullDocument(html)
        ? html
        : `<!doctype html><html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><style>*,*::before,*::after{box-sizing:border-box}body{margin:0;padding:16px;font-family:system-ui,Segoe UI,Roboto,Helvetica,Arial}img,video{max-width:100%;height:auto}.container,.ProseMirror{max-width:none!important}</style></head><body>${html}</body></html>`;

function PhoneFrame({ children }: { children: React.ReactNode }) {
    return (
        <div className="mx-auto w-full max-w-xs rounded-lg border bg-muted/40 p-3">{children}</div>
    );
}

function InAppPreview({
    title,
    contentText,
    modes,
}: {
    title: string;
    contentText: string;
    modes: ModeType[];
}) {
    const pinned = modes.includes('DASHBOARD_PIN');
    return (
        <PhoneFrame>
            <div className="rounded-md border bg-card p-3 shadow-sm">
                <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-caption font-semibold text-muted-foreground">
                        <Bell className="size-3.5" weight="fill" />
                        Announcement
                    </span>
                    {pinned && (
                        <span className="flex items-center gap-1 rounded-full bg-primary-50 px-2 py-0.5 text-caption text-primary-600">
                            <PushPin className="size-3" weight="fill" />
                            Pinned
                        </span>
                    )}
                </div>
                <p className="text-body font-semibold text-foreground">
                    {title || 'Your announcement title'}
                </p>
                <p className="mt-1 line-clamp-6 text-caption text-muted-foreground">
                    {contentText || 'Your message appears here as learners will read it.'}
                </p>
            </div>
        </PhoneFrame>
    );
}

function PushPreview({ push, senderName }: { push: PushConfig; senderName: string }) {
    return (
        <PhoneFrame>
            <div className="rounded-md border bg-card p-3 shadow-sm">
                <p className="text-caption text-muted-foreground">{senderName || 'Your app'}</p>
                <p className="mt-1 text-body font-semibold text-foreground">
                    {push.title || 'Push title'}
                </p>
                <p className="line-clamp-3 text-caption text-muted-foreground">
                    {push.body || 'Push body appears here.'}
                </p>
            </div>
        </PhoneFrame>
    );
}

function WhatsAppPreview({
    template,
    config,
    title,
    contentText,
    senderName,
}: {
    template: WhatsAppTemplateDTO | null;
    config: WhatsAppConfig;
    title: string;
    contentText: string;
    senderName: string;
}) {
    if (!template) {
        return (
            <p className="rounded-md border border-dashed bg-muted/40 px-3 py-6 text-center text-caption text-muted-foreground">
                Pick an approved WhatsApp template on the Delivery step to preview it here.
            </p>
        );
    }

    const resolve = (name: string) => {
        const binding = config.variables[name];
        if (!binding) return `{{${name}}}`;
        switch (binding.source) {
            case 'ANNOUNCEMENT_TITLE':
                return title || 'Announcement title';
            case 'ANNOUNCEMENT_CONTENT':
                return contentText.slice(0, 100) || 'Announcement content';
            case 'SENDER_NAME':
                return senderName || 'Sender';
            case 'RECIPIENT_NAME':
                return 'Riya Sharma';
            default:
                return (
                    binding.customValue ||
                    WHATSAPP_VALUE_SOURCES.find((s) => s.value === binding.source)?.label ||
                    `{{${name}}}`
                );
        }
    };

    let body = template.bodyText ?? '';
    whatsAppVariableNames(template).forEach((name) => {
        body = body.split(`{{${name}}}`).join(resolve(name));
    });

    return (
        <PhoneFrame>
            <div className="rounded-md border border-success-400 bg-card p-3 shadow-sm">
                {template.headerText && (
                    <p className="mb-1 text-body font-semibold">{template.headerText}</p>
                )}
                <p className="whitespace-pre-wrap text-caption text-foreground">{body}</p>
                {template.footerText && (
                    <p className="mt-2 text-caption text-muted-foreground">{template.footerText}</p>
                )}
                {(template.buttons ?? []).length > 0 && (
                    <div className="mt-2 space-y-1 border-t pt-2">
                        {(template.buttons ?? []).map((button) => (
                            <p key={button.text} className="text-center text-caption text-info-600">
                                {button.text}
                            </p>
                        ))}
                    </div>
                )}
            </div>
        </PhoneFrame>
    );
}

function EmailFrame({
    title,
    previewText,
    htmlContent,
    senderName,
    className,
}: {
    title: string;
    previewText: string;
    htmlContent: string;
    senderName: string;
    className?: string;
}) {
    return (
        <div
            className={cn(
                'mx-auto flex w-full flex-col overflow-hidden rounded-md border bg-card shadow-sm',
                className
            )}
        >
            <div className="shrink-0 border-b bg-muted/50 px-3 py-2">
                <p className="text-caption text-muted-foreground">
                    From: {senderName || 'Your institute'}
                </p>
                <p className="mt-0.5 truncate text-body font-semibold text-foreground">
                    {title || '(No subject)'}
                </p>
                {previewText && (
                    <p className="truncate text-caption text-muted-foreground">{previewText}</p>
                )}
            </div>
            <iframe
                title="Email preview"
                sandbox="allow-same-origin"
                className="size-full min-h-64 flex-1 border-0 bg-card"
                srcDoc={emailDocument(htmlContent)}
            />
        </div>
    );
}

export function PreviewRail(props: PreviewRailProps) {
    const { expanded, onExpandedChange, cardClassName } = props;
    const [device, setDevice] = useState<'mobile' | 'laptop'>('laptop');

    return (
        <>
            <Card className={cn('border-border/80 shadow-sm', cardClassName)}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                    <CardTitle className="text-subtitle font-semibold">Live preview</CardTitle>
                    <MyButton
                        buttonType="text"
                        scale="small"
                        onClick={() => onExpandedChange(true)}
                        aria-label="Open full preview"
                    >
                        <ArrowsOut className="mr-1 size-4" />
                        Expand
                    </MyButton>
                </CardHeader>
                <CardContent>
                    <Tabs defaultValue="in-app">
                        <TabsList className="grid w-full grid-cols-4">
                            <TabsTrigger value="in-app" className="text-caption">
                                In-app
                            </TabsTrigger>
                            <TabsTrigger value="push" className="text-caption">
                                Push
                            </TabsTrigger>
                            <TabsTrigger value="email" className="text-caption">
                                Email
                            </TabsTrigger>
                            <TabsTrigger value="whatsapp" className="text-caption">
                                WhatsApp
                            </TabsTrigger>
                        </TabsList>
                        <TabsContent value="in-app" className="mt-4">
                            <InAppPreview
                                title={props.title}
                                contentText={props.contentText}
                                modes={props.modes}
                            />
                        </TabsContent>
                        <TabsContent value="push" className="mt-4">
                            <PushPreview push={props.push} senderName={props.senderName} />
                        </TabsContent>
                        <TabsContent value="email" className="mt-4">
                            <EmailFrame
                                title={props.title}
                                previewText={props.previewText}
                                htmlContent={props.htmlContent}
                                senderName={props.senderName}
                                className="h-80"
                            />
                        </TabsContent>
                        <TabsContent value="whatsapp" className="mt-4">
                            <WhatsAppPreview
                                template={props.whatsappTemplate}
                                config={props.whatsapp}
                                title={props.title}
                                contentText={props.contentText}
                                senderName={props.senderName}
                            />
                        </TabsContent>
                    </Tabs>

                    {props.tips.length > 0 && (
                        <div className="mt-4 rounded-md border border-warning-400 bg-warning-50 p-3">
                            <p className="flex items-center gap-1.5 text-caption font-semibold text-warning-600">
                                <Lightbulb className="size-4" weight="fill" />
                                Quick tips
                            </p>
                            <ul className="mt-1 list-disc space-y-1 pl-5 text-caption text-warning-600">
                                {props.tips.map((tip) => (
                                    <li key={tip}>{tip}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </CardContent>
            </Card>

            <MyDialog
                heading="Preview"
                open={expanded}
                onOpenChange={onExpandedChange}
                dialogWidth="max-w-5xl"
            >
                <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                        <MyButton
                            buttonType={device === 'mobile' ? 'primary' : 'secondary'}
                            scale="small"
                            onClick={() => setDevice('mobile')}
                        >
                            <DeviceMobile className="mr-1 size-4" />
                            Mobile
                        </MyButton>
                        <MyButton
                            buttonType={device === 'laptop' ? 'primary' : 'secondary'}
                            scale="small"
                            onClick={() => setDevice('laptop')}
                        >
                            <Laptop className="mr-1 size-4" />
                            Desktop
                        </MyButton>
                        <span className="ml-auto flex items-center gap-1 text-caption text-muted-foreground">
                            <EnvelopeSimple className="size-4" />
                            Email rendering
                        </span>
                    </div>
                    <div className="rounded-md bg-muted/40 p-4">
                        <EmailFrame
                            title={props.title}
                            previewText={props.previewText}
                            htmlContent={props.htmlContent}
                            senderName={props.senderName}
                            className={cn('h-96', device === 'mobile' ? 'max-w-sm' : 'max-w-4xl')}
                        />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-3">
                        <div className="space-y-2">
                            <p className="text-caption font-semibold text-muted-foreground">
                                In-app
                            </p>
                            <InAppPreview
                                title={props.title}
                                contentText={props.contentText}
                                modes={props.modes}
                            />
                        </div>
                        <div className="space-y-2">
                            <p className="text-caption font-semibold text-muted-foreground">Push</p>
                            <PushPreview push={props.push} senderName={props.senderName} />
                        </div>
                        <div className="space-y-2">
                            <p className="flex items-center gap-1 text-caption font-semibold text-muted-foreground">
                                <WhatsappLogo className="size-3.5" />
                                WhatsApp
                            </p>
                            <WhatsAppPreview
                                template={props.whatsappTemplate}
                                config={props.whatsapp}
                                title={props.title}
                                contentText={props.contentText}
                                senderName={props.senderName}
                            />
                        </div>
                    </div>
                </div>
            </MyDialog>
        </>
    );
}
