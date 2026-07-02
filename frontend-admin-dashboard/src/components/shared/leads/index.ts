// Shared "leads" presentational layer — used by the Recent Leads page (native
// MyTable + board) and the Audience Lists page (slim stat strip).

export * from './lead-view-model';
export * from './lead-actions';
export { LeadAvatar } from './lead-avatar';
export { LeadStageChip, resolveStage, type StageAccent } from './lead-stage-chip';
export { LeadScoreBar } from './lead-score-bar';
export { LeadCounsellor } from './lead-counsellor';
export { LeadActionsMenu } from './lead-actions-menu';
export { LeadEmptyState } from './lead-empty-state';
export { LeadSourcePill } from './lead-source-pill';
export { LeadTable, type LeadTableExtraColumn } from './lead-table';
export { LeadPagination } from './lead-pagination';
export {
    LeadInlineSelect,
    LEAD_STATUS_OPTIONS,
    LEAD_TIER_OPTIONS,
    type LeadInlineOption,
} from './lead-inline-select';
export { LeadRowActions } from './lead-row-actions';
export { useLeadKpiCounts, LEAD_KPI_METRICS, type LeadKpiMetric } from './use-lead-kpi-counts';
export { LeadStatTabs, type LeadStatTab } from './lead-stat-tabs';
export { LeadCard } from './lead-card';
export { LeadBoard } from './lead-board';
export { LeadBoardColumn } from './lead-board-column';
export { DEFAULT_BOARD_COLUMNS, type LeadBoardColumnConfig } from './lead-board-config';
export { LeadViewToggle, type LeadView } from './lead-view-toggle';
export { useUpdateLeadTier } from './use-update-lead-tier';
export { useUpdateLeadStatus } from './use-update-lead-status';
export { usePlaceCall } from './use-place-call';
export { usePlaceAiCall } from './use-place-ai-call';
export { useAiCallButtonEnabled } from './use-ai-calling-settings';
export {
    openPostCallDisposition,
    isPostCallAutoOpenDisabled,
    type PostCallDispositionPayload,
    type PostCallTerminalStatus,
} from './post-call-disposition-sheet';
export {
    LeadCallHistory,
    CallStatusPill,
    CallRecordingPlayButton,
    formatCallDuration,
} from './lead-call-history';
export {
    CompleteFollowUpPopover,
    fetchLeadFollowups,
    type LeadFollowup,
} from './complete-followup-popover';
export {
    fetchCallHistory,
    fetchCallRecordingUrl,
    type CallLogItem,
    type PagedCallLog,
} from './services/call-history';
export { CallIntelligencePanel } from './call-intelligence-panel';
export { CallIntelligenceSummary } from './call-intelligence-summary';
export { LeadCallIntelligenceSummary } from './lead-call-intelligence-summary';
export { TeamCoachingSection } from './team-coaching-section';
export { useCallIntelligenceEnabled } from './use-call-intelligence-enabled';
export { ManualCallUploadDialog } from './manual-call-upload-dialog';
export {
    fetchCallIntelligence,
    triggerCallIntelligence,
    fetchLeadCallIntelligence,
    fetchCounsellorCallIntelligence,
    fetchTeamCallIntelligence,
    type CallIntelligenceDto,
    type CallIntelligenceAnalyticsDto,
    type CounsellorStat,
} from './services/call-intelligence';
export { CallPickerPopover } from './call-picker-popover';
export {
    fetchCallOptions,
    type CallOptionsResponse,
    type NumberChoice,
} from './services/call-options';
