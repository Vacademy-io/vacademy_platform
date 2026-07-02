import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChatCircle, EnvelopeSimple, ChartLine } from '@phosphor-icons/react';
import { OverviewTab } from './overview/overview-tab';
import { InboxPage } from '../../inbox/-components/inbox-page';
import { EmailInboxPanel } from './email-inbox/email-inbox-panel';

type HubTab = 'overview' | 'whatsapp' | 'email';

export function NotificationHubPage() {
    const [activeTab, setActiveTab] = useState<HubTab>('overview');

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="px-4 py-3 border-b bg-white shrink-0">
                <h2 className="text-lg font-semibold text-gray-800">Notification Hub</h2>
                <p className="text-xs text-gray-400">
                    Stats, recent learner activity and inbox conversations
                </p>
            </div>

            {/* Tabs */}
            <Tabs
                value={activeTab}
                onValueChange={(v) => setActiveTab(v as HubTab)}
                className="flex flex-col flex-1 min-h-0"
            >
                <div className="px-4 pt-3 border-b bg-white shrink-0 overflow-x-auto">
                    <TabsList className="w-max">
                        <TabsTrigger value="overview" className="gap-2">
                            <ChartLine size={16} /> Overview
                        </TabsTrigger>
                        <TabsTrigger value="whatsapp" className="gap-2">
                            <ChatCircle size={16} /> WhatsApp Inbox
                        </TabsTrigger>
                        <TabsTrigger value="email" className="gap-2">
                            <EnvelopeSimple size={16} /> Email Inbox
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="overview" className="flex-1 min-h-0 overflow-y-auto m-0">
                    <OverviewTab />
                </TabsContent>

                <TabsContent value="whatsapp" className="flex-1 min-h-0 overflow-hidden m-0">
                    <InboxPage />
                </TabsContent>

                <TabsContent value="email" className="flex-1 min-h-0 overflow-hidden m-0">
                    <EmailInboxPanel />
                </TabsContent>
            </Tabs>
        </div>
    );
}
