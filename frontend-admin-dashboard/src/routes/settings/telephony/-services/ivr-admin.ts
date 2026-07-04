import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import {
    TELEPHONY_IVR_MENUS,
    TELEPHONY_IVR_MENUS_BASE,
    TELEPHONY_IVR_MENU_BY_ID,
} from '@/constants/urls';

/** The node kinds an IVR tree is built from (mirrors backend IvrNodeType). */
export type IvrNodeType = 'PLAY' | 'GATHER' | 'DIAL' | 'VOICEMAIL' | 'HANGUP' | 'AI_AGENT';

/** One node in an IVR tree. `id` is a client-generated UUID that other nodes and
 *  the menu's `rootNodeId` reference, so the tree's links survive reloads. */
export interface IvrNodeDTO {
    id: string;
    nodeType: IvrNodeType;
    label?: string | null;
    /** TTS prompt spoken to the caller. */
    promptText?: string | null;
    /** Optional recorded-prompt URL/file id (played instead of TTS). */
    promptAudioId?: string | null;
    /** GATHER: pressed digit -> next node id. */
    digitMap?: Record<string, string> | null;
    /** DIAL: E.164 numbers to ring. */
    dialTargets?: string[] | null;
    /** DIAL: counsellor user ids to ring (resolved to their mobiles at call time). */
    dialUserIds?: string[] | null;
    /** PLAY: next node after the prompt. */
    nextNodeId?: string | null;
    /** AI_AGENT: the AI agent (Settings > AI Calling > AI Agents) that takes the call. */
    aiAgentId?: string | null;
    timeoutSeconds?: number | null;
    maxRetries?: number | null;
}

/** A whole IVR menu (tree). `id` is null on create, set on update. */
export interface IvrMenuDTO {
    id?: string | null;
    instituteId: string;
    name: string;
    /** The DID this IVR answers; empty/null = the institute's default menu. */
    dialedNumber?: string | null;
    /** Entry node id — must match one of `nodes[].id`. */
    rootNodeId?: string | null;
    enabled?: boolean | null;
    nodes: IvrNodeDTO[];
}

/** Human labels for node types (system-fixed — IVR/Calling have no configurable terms). */
export const IVR_NODE_TYPE_LABELS: Record<IvrNodeType, string> = {
    PLAY: 'Play a message',
    GATHER: 'Menu (collect a key press)',
    DIAL: 'Connect to a number',
    VOICEMAIL: 'Take a voicemail',
    HANGUP: 'Hang up',
    AI_AGENT: 'Talk to AI agent',
};

export const fetchIvrMenus = async (instituteId: string): Promise<IvrMenuDTO[]> => {
    const { data } = await authenticatedAxiosInstance.get<IvrMenuDTO[]>(
        TELEPHONY_IVR_MENUS(instituteId)
    );
    return data ?? [];
};

export const fetchIvrMenu = async (menuId: string): Promise<IvrMenuDTO> => {
    const { data } = await authenticatedAxiosInstance.get<IvrMenuDTO>(
        TELEPHONY_IVR_MENU_BY_ID(menuId)
    );
    return data;
};

export const upsertIvrMenu = async (menu: IvrMenuDTO): Promise<IvrMenuDTO> => {
    const { data } = await authenticatedAxiosInstance.post<IvrMenuDTO>(
        TELEPHONY_IVR_MENUS_BASE,
        menu
    );
    return data;
};

export const deleteIvrMenu = async (menuId: string): Promise<void> => {
    await authenticatedAxiosInstance.delete(TELEPHONY_IVR_MENU_BY_ID(menuId));
};
