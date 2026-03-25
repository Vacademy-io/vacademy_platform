import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useSimpleEnrollmentStore } from '@/stores/students/simple-enrollment-store';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { enrollLearnerV2, searchPackages, fetchPackageSessionDetails } from '@/services/enrollment-actions';
import { toast } from 'sonner';
import { CircleNotch, CheckCircle, CurrencyInr, BookOpen, UserPlus, ShoppingCart, MagnifyingGlass, XCircle } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { useState, useEffect, useMemo } from 'react';
import { useDebounce } from 'use-debounce';
import { getAccessiblePackageFilters } from '@/lib/auth/facultyAccessUtils';

// Simplified Item Card Component
const ItemCard = ({ item, isSelected, onClick }: any) => (
    <div
        onClick={onClick}
        className={cn(
            'cursor-pointer rounded-xl border p-4 transition-all hover:shadow-md flex flex-col justify-between h-full bg-white',
            isSelected
                ? 'border-primary-500 bg-primary-50/10 ring-2 ring-primary-100'
                : 'border-neutral-200 hover:border-primary-200'
        )}
    >
        <div className="flex items-start justify-between gap-3">
            <div>
                <h4 className="font-semibold text-neutral-800 line-clamp-2" title={item.name}>{item.name}</h4>
                <div className="flex flex-wrap gap-2 mt-2">
                    <span className="inline-flex items-center rounded-md bg-neutral-100 px-2 py-1 text-xs font-medium text-neutral-600 ring-1 ring-inset ring-neutral-500/10">
                        {item.type}
                    </span>
                    <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                        {item.session}
                    </span>
                </div>
            </div>
            <div className={cn(
                "size-5 rounded-md border flex items-center justify-center transition-all",
                isSelected ? "bg-primary-600 border-primary-600 text-white" : "border-neutral-300"
            )}>
                {isSelected && <CheckCircle className="size-4" weight="bold" />}
            </div>
        </div>
        <div className="mt-4 flex items-center gap-2 text-sm font-medium text-neutral-700">
            <div className="flex items-center gap-1 rounded-lg bg-neutral-100 px-2.5 py-1.5 text-xs text-neutral-600">
                <CurrencyInr className="size-3" />
                {item.price > 0 ? item.price : 'Free'}
            </div>
        </div>
    </div>
);

export const SimpleEnrollmentWizard = () => {
    const {
        isModalOpen,
        enrollmentType,
        closeModal,
        selectedStudentId,
        selectedItems,
        toggleItem,
        clearSelection
    } = useSimpleEnrollmentStore();

    const { instituteDetails } = useInstituteDetailsStore();
    const queryClient = useQueryClient();
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedQuery] = useDebounce(searchQuery, 300);

    const [levelFilter, setLevelFilter] = useState<string>('all');
    const [sessionFilter, setSessionFilter] = useState<string>('all');

    useEffect(() => {
        if (isModalOpen && enrollmentType && instituteDetails?.levels) {
            let targetLevelName = '';
            if (enrollmentType === 'BUY') targetLevelName = 'buy';
            else if (enrollmentType === 'RENT') targetLevelName = 'rent';
            else if (enrollmentType === 'MEMBERSHIP') targetLevelName = 'default';

            if (targetLevelName) {
                const level = instituteDetails.levels.find(l =>
                    l.level_name.toLowerCase() === targetLevelName.toLowerCase()
                );
                if (level) {
                    setLevelFilter(level.id);
                } else {
                    setLevelFilter('all');
                }
            } else {
                setLevelFilter('all');
            }

            setSessionFilter('all');
            setSearchQuery('');
        }
    }, [isModalOpen, enrollmentType, instituteDetails]);

    const instituteId = instituteDetails?.id || '';

    const { data: searchResults, isLoading: isSearching } = useQuery({
        queryKey: ['package-search', debouncedQuery, instituteId, levelFilter, sessionFilter],
        queryFn: () => searchPackages(debouncedQuery, instituteId, {
            level_id: levelFilter !== 'all' ? levelFilter : undefined,
            session_id: sessionFilter !== 'all' ? sessionFilter : undefined
        }),
        enabled: isModalOpen && !!debouncedQuery && !!instituteId,
        staleTime: 60000,
    });

    const { levels, sessions } = useMemo(() => {
        return {
            levels: instituteDetails?.levels || [],
            sessions: instituteDetails?.sessions || []
        };
    }, [instituteDetails]);

    // Sub-org admin: only show package sessions they have access to
    const accessibleFilters = useMemo(() => getAccessiblePackageFilters(), []);

    const [filteredItems, setFilteredItems] = useState<any[]>([]);

    useEffect(() => {
        // Source of truth: search results if available, otherwise fallback to local batches
        let rawSuggestions = [];
        if (searchResults) {
            if (Array.isArray(searchResults)) rawSuggestions = searchResults;
            else if (Array.isArray(searchResults.suggestions)) rawSuggestions = searchResults.suggestions;
            else if (Array.isArray(searchResults.content)) rawSuggestions = searchResults.content;
        }

        if (rawSuggestions.length > 0) {
            // Map directly from Autocomplete API results AND enrich with local batch data for missing IDs
            const normalized = rawSuggestions.map((pkg: any) => {
                const psId = pkg.package_session_id || pkg.packageSessionId || pkg.id;

                // 1. Try to find full metadata from the store as enrichment
                const batch = instituteDetails?.batches_for_sessions?.find(b => b.id === psId);
                const storeOptions = (batch?.package_dto as any)?.package_session_to_payment_options || [];
                const storeFirstOption = storeOptions[0];
                const storeFirstPlan = storeFirstOption?.payment_option?.payment_plans?.[0];

                // 2. Try to find metadata within the autocomplete record itself (it might be nested or have different casing)
                const apiOptions = pkg.package_session_to_payment_options || pkg.packageSessionToPaymentOptions || [];
                const apiFirstOption = apiOptions[0];
                const apiFirstPlan = apiFirstOption?.payment_option?.payment_plans?.[0] || apiFirstOption?.paymentPlan;

                return {
                    // Unique tracking ID
                    id: pkg.plan_id || pkg.planId || apiFirstPlan?.id || storeFirstPlan?.id || psId,
                    name: pkg.package_name || pkg.packageName || pkg.name,
                    type: pkg.level_name || pkg.levelName || batch?.level?.level_name || 'Level',
                    session: pkg.session_name || pkg.sessionName || batch?.session?.session_name || 'Session',
                    price: pkg.actual_price || pkg.price || apiFirstPlan?.actual_price || storeFirstPlan?.actual_price || 0,

                    // V2 API Payloads IDs - Checking multiple possible sources from Autocomplete API (snake and camelCase)
                    package_session_id: psId,
                    plan_id: pkg.plan_id || pkg.planId || apiFirstPlan?.id || storeFirstPlan?.id || '',
                    payment_option_id: pkg.payment_option_id || pkg.paymentOptionId || apiFirstOption?.payment_option?.id || apiFirstOption?.paymentOptionId || storeFirstOption?.payment_option?.id || '',
                    enroll_invite_id: pkg.enroll_invite_id || pkg.enrollInviteId || apiFirstOption?.enroll_invite_id || apiFirstOption?.enrollInviteId || storeFirstOption?.enroll_invite_id || ''
                };
            });
            const accessFiltered = accessibleFilters?.package_session_ids?.length
                ? normalized.filter((item: any) => accessibleFilters.package_session_ids.includes(item.package_session_id))
                : normalized;
            setFilteredItems(accessFiltered);
        } else if (instituteDetails?.batches_for_sessions && debouncedQuery) {
            // Fallback to local filtering if no results from search (or search is empty)
            let candidates = instituteDetails.batches_for_sessions.filter(b =>
                b.package_dto.package_name.toLowerCase().includes(debouncedQuery.toLowerCase())
            );

            // Sub-org admin: restrict to accessible package sessions
            if (accessibleFilters?.package_session_ids?.length) {
                candidates = candidates.filter(b => accessibleFilters.package_session_ids.includes(b.id));
            }

            const final = candidates.filter((batch) => {
                const matchesLevel = levelFilter === 'all' || batch.level?.id === levelFilter;
                const matchesSession = sessionFilter === 'all' || batch.session?.id === sessionFilter;
                return matchesLevel && matchesSession;
            }).map(batch => {
                const options = (batch.package_dto as any)?.package_session_to_payment_options || [];
                const firstOption = options[0];
                const firstPlan = firstOption?.payment_option?.payment_plans?.[0];

                return {
                    id: firstPlan?.id || batch.id,
                    name: batch.package_dto.package_name,
                    type: batch.level.level_name,
                    session: batch.session.session_name,
                    price: firstPlan?.actual_price || 0,
                    package_session_id: batch.id,
                    plan_id: firstPlan?.id || '',
                    payment_option_id: firstOption?.payment_option?.id || '',
                    enroll_invite_id: firstOption?.enroll_invite_id || ''
                };
            });
            setFilteredItems(final);
        } else {
            setFilteredItems([]);
        }
    }, [instituteDetails, debouncedQuery, searchResults, levelFilter, sessionFilter, accessibleFilters]);

    const enrollMutation = useMutation({
        mutationFn: async () => {
            if (!selectedStudentId || selectedItems.length === 0 || !instituteId) throw new Error("Selection missing");

            // 1. Fetch details for all selected package sessions using the API specified by user
            const sessionIds = selectedItems.map(i => i.package_session_id).filter(Boolean);
            let enrichmentData: any[] = [];

            try {
                if (sessionIds.length > 0) {
                    const enrichmentResponse = await fetchPackageSessionDetails(sessionIds, instituteId);
                    if (enrichmentResponse && enrichmentResponse.content) {
                        enrichmentData = enrichmentResponse.content;
                    }
                }
            } catch (error) {
                console.warn("Failed to fetch package session details for enrichment", error);
                // We continue with local data as fallback
            }

            // 2. Build map for easy lookup
            // Keying by package_session_id if available in the enriched data
            const enrichmentMap = new Map();
            enrichmentData.forEach((item: any) => {
                if (item.package_session_id) {
                    enrichmentMap.set(item.package_session_id, item);
                }
            });

            // 3. Construct Payload
            const payload = {
                userId: selectedStudentId,
                institute_id: instituteId,
                enrollmentType: "MANUAL",
                learner_package_session_enrollments: selectedItems.map(item => {
                    // Try to find enriched data
                    const enriched = enrichmentMap.get(item.package_session_id);

                    // Prioritize Enriched Data -> Then Local Item Data -> Then Defaults
                    return {
                        package_session_id: item.package_session_id,
                        // Fix mapping based on user feedback:
                        // plan_id is the root 'id' of the response item
                        plan_id: enriched?.id || item.plan_id || '',
                        // payment_option_id is inside the 'payment_option' object
                        payment_option_id: enriched?.payment_option?.id || item.payment_option_id || '',
                        enroll_invite_id: enriched?.enroll_invite_id || enriched?.enrollInviteId || item.enroll_invite_id || ''
                    };
                })
            };

            return enrollLearnerV2(payload as any);
        },
        onSuccess: () => {
            toast.success("Enrolled successfully!");
            queryClient.invalidateQueries({ queryKey: ['user-plans', selectedStudentId] });
            closeModal();
        },
        onError: (err) => {
            toast.error("Enrollment failed. Please check the console for details.");
            console.error(err);
        }
    });

    const getTitleAndIcon = () => {
        if (enrollmentType === 'RENT') return { title: 'Rent Books', icon: <BookOpen className="size-5 text-blue-600" /> };
        if (enrollmentType === 'BUY') return { title: 'Buy Books', icon: <ShoppingCart className="size-5 text-emerald-600" /> };
        return { title: 'Assign Memberships', icon: <UserPlus className="size-5 text-primary-600" /> };
    };

    const { title, icon } = getTitleAndIcon();

    return (
        <Dialog open={isModalOpen} onOpenChange={closeModal}>
            <DialogContent className="max-w-xl p-0 gap-0 overflow-hidden rounded-2xl">
                <div className="bg-neutral-50 px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white rounded-lg shadow-sm border border-neutral-200">
                            {icon}
                        </div>
                        <DialogTitle className="text-lg font-bold text-neutral-800">
                            {title}
                        </DialogTitle>
                    </div>
                </div>

                <div className="p-4 flex flex-col gap-4">
                    <div className="flex flex-col gap-3 bg-neutral-50/50 p-3 rounded-xl border border-neutral-100">
                        <div className="relative">
                            <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-neutral-400" />
                            <input
                                type="text"
                                placeholder="Search packages..."
                                className="w-full h-9 rounded-lg border border-neutral-200 pl-9 pr-4 py-2 text-xs focus:border-primary-500 focus:outline-none"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                autoFocus
                            />
                            {isSearching && (
                                <CircleNotch className="absolute right-3 top-1/2 -translate-y-1/2 size-3 animate-spin text-primary-500" />
                            )}
                        </div>

                        <div className="flex gap-2">
                            <select
                                className="flex-1 h-8 rounded-lg border border-neutral-200 px-2 text-[11px] font-medium bg-white focus:outline-none focus:border-primary-500"
                                value={levelFilter}
                                onChange={(e) => setLevelFilter(e.target.value)}
                            >
                                <option value="all">Levels: All</option>
                                {levels.map(l => <option key={l.id} value={l.id}>{l.level_name}</option>)}
                            </select>

                            <select
                                className="flex-1 h-8 rounded-lg border border-neutral-200 px-2 text-[11px] font-medium bg-white focus:outline-none focus:border-primary-500"
                                value={sessionFilter}
                                onChange={(e) => setSessionFilter(e.target.value)}
                            >
                                <option value="all">Sessions: All</option>
                                {sessions.map(s => <option key={s.id} value={s.id}>{s.session_name}</option>)}
                            </select>

                            {(levelFilter !== 'all' || sessionFilter !== 'all') && (
                                <button onClick={() => { setLevelFilter('all'); setSessionFilter('all'); }} className="p-1 text-neutral-400 hover:text-rose-500 transition-colors">
                                    <XCircle className="size-5" weight="fill" />
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="min-h-[250px] flex flex-col mt-1">
                        <div className="flex items-center justify-between mb-2 px-1">
                            <h3 className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
                                {filteredItems.length} Result{filteredItems.length !== 1 ? 's' : ''}
                            </h3>
                        </div>

                        <div className="flex-1 overflow-y-auto pr-1 max-h-[240px] custom-scrollbar">
                            {filteredItems.length > 0 ? (
                                <div className="space-y-2">
                                    {filteredItems.map((item) => (
                                        <div
                                            key={item.id}
                                            onClick={() => toggleItem(item)}
                                            className={cn(
                                                'cursor-pointer rounded-xl border px-3 py-2.5 transition-all flex items-center gap-3',
                                                selectedItems.some(i => i.id === item.id)
                                                    ? 'border-primary-500 bg-primary-50/20 ring-1 ring-primary-100'
                                                    : 'border-neutral-100 bg-white hover:border-neutral-200'
                                            )}
                                        >
                                            <div className={cn(
                                                "size-5 rounded-md border flex items-center justify-center transition-all shrink-0",
                                                selectedItems.some(i => i.id === item.id) ? "bg-primary-600 border-primary-600 text-white" : "border-neutral-300"
                                            )}>
                                                {selectedItems.some(i => i.id === item.id) && <CheckCircle className="size-3.5" weight="bold" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h4 className="text-[13px] font-semibold text-neutral-800 truncate">{item.name}</h4>
                                                <div className="flex gap-2 mt-0.5">
                                                    <span className="text-[10px] font-medium text-neutral-500">{item.type}</span>
                                                    <span className="text-[10px] text-neutral-300">•</span>
                                                    <span className="text-[10px] font-medium text-blue-600">{item.session}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="h-[200px] flex flex-col items-center justify-center text-neutral-400 border-2 border-dashed border-neutral-100 rounded-2xl">
                                    <MagnifyingGlass className="size-8 mb-2 opacity-10" />
                                    <p className="text-xs">{debouncedQuery ? "No matches found" : "Search to see packages"}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {selectedItems.length > 0 && (
                        <div className="px-4 py-3 bg-primary-50/30 border-y border-primary-100/50">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-bold text-primary-700 uppercase tracking-tight">SELECTED PACKAGES ({selectedItems.length})</span>
                                <button onClick={clearSelection} className="text-[10px] font-bold text-rose-500 hover:underline">Remove All</button>
                            </div>
                            <div className="flex flex-wrap gap-1.5 max-h-[80px] overflow-y-auto custom-scrollbar">
                                {selectedItems.map(item => (
                                    <div key={item.id} className="flex items-center gap-1.5 px-2 py-1 bg-white border border-primary-200 rounded-lg shadow-sm animate-in fade-in zoom-in duration-200">
                                        <span className="text-[11px] font-medium text-neutral-700 truncate max-w-[120px]">{item.name}</span>
                                        <button onClick={(e) => { e.stopPropagation(); toggleItem(item); }} className="text-neutral-400 hover:text-rose-500 transition-colors">
                                            <XCircle className="size-3.5" weight="fill" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="px-5 py-4 border-t border-neutral-100 bg-neutral-50/50 flex justify-between items-center mt-auto">
                    <div className="text-xs font-semibold text-neutral-500">
                        {selectedItems.length > 0 ? (
                            <span className="text-primary-600 font-bold">{selectedItems.length} selected</span>
                        ) : (
                            "No items selected"
                        )}
                    </div>
                    <div className="flex gap-2">
                        <button onClick={closeModal} className="px-4 py-2 rounded-lg text-xs font-bold text-neutral-600 hover:bg-neutral-200/50 transition-colors">
                            Cancel
                        </button>
                        <button
                            onClick={() => enrollMutation.mutate()}
                            disabled={selectedItems.length === 0 || enrollMutation.isPending}
                            className={cn(
                                "px-6 py-2 rounded-lg text-xs font-bold text-white shadow-md transition-all active:scale-95 flex items-center gap-2",
                                selectedItems.length === 0 || enrollMutation.isPending ? "bg-neutral-300 cursor-not-allowed text-neutral-500 shadow-none" : "bg-primary-600 hover:bg-primary-700"
                            )}
                        >
                            {enrollMutation.isPending ? <CircleNotch className="animate-spin size-3" /> : `Enroll ${selectedItems.length > 0 ? `(${selectedItems.length})` : ''}`}
                        </button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

