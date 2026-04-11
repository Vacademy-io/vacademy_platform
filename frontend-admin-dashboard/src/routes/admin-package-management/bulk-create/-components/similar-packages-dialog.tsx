import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';
import { fetchPaginatedBatches } from '@/routes/manage-inventory/-services/inventory-service';
import { PaginatedBatchItem } from '@/routes/manage-inventory/-types/inventory-types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getTerminologyPlural } from '@/components/common/layout-container/sidebar/utils';
import { ContentTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';
import { DashboardLoader } from '@/components/core/dashboard-loader';

interface SimilarPackagesDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function SimilarPackagesDialog({ open, onOpenChange }: SimilarPackagesDialogProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [results, setResults] = useState<PaginatedBatchItem[]>([]);
    const [hasSearched, setHasSearched] = useState(false);

    const handleSearch = async () => {
        if (!searchTerm.trim()) return;
        setIsLoading(true);
        setHasSearched(true);
        try {
            const response = await fetchPaginatedBatches({ search: searchTerm }, 0, 50);
            setResults(response.content || []);
        } catch (error) {
            console.error('Error fetching packages:', error);
            setResults([]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Search Already Added {getTerminologyPlural(ContentTerms.Package, SystemTerms.Package)}</DialogTitle>
                    <DialogDescription>
                        Search to see if the {getTerminologyPlural(ContentTerms.Package, SystemTerms.Package).toLowerCase()} you are trying to add already exist in the system.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex items-center gap-2 mb-4">
                    <Input 
                        placeholder="Search by name..." 
                        value={searchTerm} 
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    />
                    <Button onClick={handleSearch} disabled={isLoading}>
                        <Search className="mr-2 h-4 w-4" />
                        Search
                    </Button>
                </div>

                <div className="flex-1 overflow-auto border rounded-md">
                    {isLoading ? (
                        <div className="flex justify-center items-center h-32">
                            <DashboardLoader />
                        </div>
                    ) : hasSearched && results.length === 0 ? (
                        <div className="flex justify-center items-center h-32 text-neutral-500">
                            No {getTerminologyPlural(ContentTerms.Package, SystemTerms.Package).toLowerCase()} found for "{searchTerm}".
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Package Name</TableHead>
                                    <TableHead>Level</TableHead>
                                    <TableHead>Session</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {results.map((item) => (
                                    <TableRow key={item.id}>
                                        <TableCell className="font-medium">{item.package_dto?.package_name || 'N/A'}</TableCell>
                                        <TableCell>{item.level?.level_name || 'N/A'}</TableCell>
                                        <TableCell>{item.session?.session_name || 'N/A'}</TableCell>
                                        <TableCell>{item.status || 'N/A'}</TableCell>
                                    </TableRow>
                                ))}
                                {!hasSearched && results.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                                            Enter a search term and click Search to see results.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
