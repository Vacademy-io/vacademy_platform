import React, { useEffect, useState } from 'react';
import {
    Loader2,
    Trash2,
    CheckCircle,
    AlertCircle,
    ArrowRightLeft,
    ArrowRight,
    ArrowLeft,
    Ban,
} from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

import {
    fetchEntityTypes,
    fetchAvailableSystemFields,
    fetchMappings,
    createMapping,
    updateMapping,
    deleteMapping,
    fetchSimpleCustomFields,
    type SystemField,
    type ExistingMapping,
    type CustomField,
} from '@/services/system-custom-field-mapping';

const SyncDirectionIcon = ({ direction }: { direction: string }) => {
    switch (direction) {
        case 'BIDIRECTIONAL':
            return <ArrowRightLeft className="size-4" />;
        case 'TO_SYSTEM':
            return <ArrowRight className="size-4" />;
        case 'TO_CUSTOM':
            return <ArrowLeft className="size-4" />;
        case 'NONE':
            return <Ban className="size-4" />;
        default:
            return <ArrowRightLeft className="size-4" />;
    }
};

export const SystemToCustomFieldMapping = () => {
    const [entityTypes, setEntityTypes] = useState<string[]>([]);
    const [selectedEntityType, setSelectedEntityType] = useState<string>('');
    const [systemFields, setSystemFields] = useState<SystemField[]>([]);
    const [mappings, setMappings] = useState<ExistingMapping[]>([]);
    const [customFields, setCustomFields] = useState<CustomField[]>([]);
    const [isFieldsLoading, setIsFieldsLoading] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // Track loading states for specific actions
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    useEffect(() => {
        loadEntityTypes();
    }, []);

    useEffect(() => {
        if (selectedEntityType) {
            loadDataForEntity(selectedEntityType);
        }
    }, [selectedEntityType]);

    const loadEntityTypes = async () => {
        try {
            setIsLoading(true);
            const types = await fetchEntityTypes();
            setEntityTypes(types);
            const firstType = types[0];
            if (firstType) {
                setSelectedEntityType(firstType);
            }
        } catch (error) {
            console.error('Failed to load entity types', error);
            toast.error('Failed to load entity types');
        } finally {
            setIsLoading(false);
        }
    };

    const loadDataForEntity = async (entityType: string) => {
        try {
            setIsFieldsLoading(true);
            const [sysFields, maps, custFields] = await Promise.all([
                fetchAvailableSystemFields(entityType),
                fetchMappings(entityType),
                fetchSimpleCustomFields(),
            ]);
            setSystemFields(sysFields);
            setMappings(maps);
            setCustomFields(custFields);
        } catch (error) {
            console.error('Failed to load mapping data', error);
            toast.error('Failed to load mapping data');
        } finally {
            setIsFieldsLoading(false);
        }
    };

    const handleCreateMapping = async (systemFieldName: string, customFieldId: string) => {
        if (!systemFieldName || !customFieldId) return;

        const loadingKey = `create-${systemFieldName}`;
        setActionLoading(loadingKey);

        try {
            const newMapping = await createMapping({
                entityType: selectedEntityType,
                systemFieldName,
                customFieldId,
                syncDirection: 'BIDIRECTIONAL',
            });

            setMappings((prev) => [...prev, newMapping]);
            toast.success('Mapping created successfully');

            // Update the system field's isMapped status locally
            setSystemFields((prev) =>
                prev.map((f) =>
                    f.fieldName === systemFieldName
                        ? { ...f, isMapped: true, mappedCustomFieldId: customFieldId }
                        : f
                )
            );
        } catch (error) {
            console.error('Failed to create mapping', error);
            toast.error('Failed to create mapping');
        } finally {
            setActionLoading(null);
        }
    };

    const handleUpdateMapping = async (
        mappingId: string,
        direction: 'BIDIRECTIONAL' | 'TO_SYSTEM' | 'TO_CUSTOM' | 'NONE'
    ) => {
        const loadingKey = `update-${mappingId}`;
        setActionLoading(loadingKey);

        try {
            const updatedMapping = await updateMapping(mappingId, {
                syncDirection: direction,
            });

            setMappings((prev) => prev.map((m) => (m.id === mappingId ? updatedMapping : m)));
            toast.success('Mapping updated');
        } catch (error) {
            console.error('Failed to update mapping', error);
            toast.error('Failed to update mapping');
        } finally {
            setActionLoading(null);
        }
    };

    const handleDeleteMapping = async (mappingId: string, systemFieldName: string) => {
        const loadingKey = `delete-${mappingId}`;
        setActionLoading(loadingKey);

        try {
            await deleteMapping(mappingId);
            setMappings((prev) => prev.filter((m) => m.id !== mappingId));

            // Update the system field's isMapped status locally
            setSystemFields((prev) =>
                prev.map((f) =>
                    f.fieldName === systemFieldName
                        ? { ...f, isMapped: false, mappedCustomFieldId: null }
                        : f
                )
            );

            toast.success('Mapping deleted');
        } catch (error) {
            console.error('Failed to delete mapping', error);
            toast.error('Failed to delete mapping');
        } finally {
            setActionLoading(null);
        }
    };

    return (
        <Card className="mt-8 border-t-4 border-t-primary-500 shadow-sm">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-xl">
                            System Field ↔ Custom Field Mapping
                        </CardTitle>
                        <CardDescription className="mt-2">
                            Link system fields (like Full Name) with your custom fields to keep data
                            in sync automatically.
                        </CardDescription>
                    </div>
                    {/* Entity Type Selector */}
                    <div className="w-[200px]">
                        <Select
                            value={selectedEntityType}
                            onValueChange={setSelectedEntityType}
                            disabled={isLoading}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select Entity" />
                            </SelectTrigger>
                            <SelectContent>
                                {Array.isArray(entityTypes) &&
                                    entityTypes.map((type) => (
                                        <SelectItem key={type} value={type}>
                                            {type}
                                        </SelectItem>
                                    ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {isFieldsLoading ? (
                    <div className="flex h-40 items-center justify-center">
                        <Loader2 className="size-8 animate-spin text-primary-500" />
                    </div>
                ) : (
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-gray-50/50">
                                    <TableHead className="w-[250px] font-semibold">
                                        System Field
                                    </TableHead>
                                    <TableHead className="w-[300px] font-semibold">
                                        Custom Field
                                    </TableHead>
                                    <TableHead className="font-semibold">Sync Direction</TableHead>
                                    <TableHead className="w-[100px] text-right font-semibold">
                                        Actions
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {systemFields.map((field) => {
                                    const mapping = mappings.find(
                                        (m) => m.systemFieldName === field.fieldName
                                    );
                                    const isMapped = !!mapping;

                                    return (
                                        <TableRow key={field.fieldName}>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="font-medium">
                                                        {field.displayName}
                                                    </span>
                                                    <div className="mt-1 flex items-center gap-2">
                                                        <Badge
                                                            variant="outline"
                                                            className={`text-[10px] ${
                                                                isMapped
                                                                    ? 'border-green-200 bg-green-50 text-green-700'
                                                                    : 'border-gray-200 bg-gray-50 text-gray-500'
                                                            }`}
                                                        >
                                                            {isMapped ? (
                                                                <span className="flex items-center gap-1">
                                                                    <CheckCircle className="size-3" />{' '}
                                                                    Mapped
                                                                </span>
                                                            ) : (
                                                                <span className="flex items-center gap-1">
                                                                    <AlertCircle className="size-3" />{' '}
                                                                    Not Mapped
                                                                </span>
                                                            )}
                                                        </Badge>
                                                        <span className="font-mono text-xs text-muted-foreground">
                                                            {field.fieldName}
                                                        </span>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {isMapped ? (
                                                    <div className="flex items-center justify-between rounded-md border bg-gray-50 px-3 py-2 text-sm font-medium">
                                                        {mapping.customFieldName ||
                                                            customFields.find(
                                                                (c) =>
                                                                    c.id === mapping.customFieldId
                                                            )?.name ||
                                                            'Unknown Field'}
                                                    </div>
                                                ) : (
                                                    <Select
                                                        onValueChange={(value) =>
                                                            handleCreateMapping(
                                                                field.fieldName,
                                                                value
                                                            )
                                                        }
                                                        disabled={!!actionLoading}
                                                    >
                                                        <SelectTrigger className="w-full">
                                                            <SelectValue placeholder="Select Custom Field" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {customFields.map((cf) => {
                                                                // Filter out fields that are already mapped to OTHER system fields
                                                                const isAlreadyMapped =
                                                                    mappings.some(
                                                                        (m) =>
                                                                            m.customFieldId ===
                                                                                cf.id &&
                                                                            m.systemFieldName !==
                                                                                field.fieldName
                                                                    );
                                                                if (isAlreadyMapped) return null;

                                                                return (
                                                                    <SelectItem
                                                                        key={cf.id}
                                                                        value={cf.id}
                                                                    >
                                                                        {cf.name}
                                                                    </SelectItem>
                                                                );
                                                            })}
                                                        </SelectContent>
                                                    </Select>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {isMapped ? (
                                                    <Select
                                                        value={mapping.syncDirection}
                                                        onValueChange={(
                                                            val:
                                                                | 'BIDIRECTIONAL'
                                                                | 'TO_SYSTEM'
                                                                | 'TO_CUSTOM'
                                                                | 'NONE'
                                                        ) => handleUpdateMapping(mapping.id, val)}
                                                        disabled={!!actionLoading}
                                                    >
                                                        <SelectTrigger className="w-[180px]">
                                                            <div className="flex items-center gap-2">
                                                                <SyncDirectionIcon
                                                                    direction={
                                                                        mapping.syncDirection
                                                                    }
                                                                />
                                                                <SelectValue />
                                                            </div>
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="BIDIRECTIONAL">
                                                                Bidirectional
                                                            </SelectItem>
                                                            <SelectItem value="TO_SYSTEM">
                                                                Custom → System
                                                            </SelectItem>
                                                            <SelectItem value="TO_CUSTOM">
                                                                System → Custom
                                                            </SelectItem>
                                                            <SelectItem value="NONE">
                                                                Disabled
                                                            </SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                ) : (
                                                    <span className="text-sm text-muted-foreground">
                                                        -
                                                    </span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {isMapped && (
                                                    <TooltipProvider>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="text-red-500 hover:bg-red-50 hover:text-red-700"
                                                                    onClick={() =>
                                                                        handleDeleteMapping(
                                                                            mapping.id,
                                                                            field.fieldName
                                                                        )
                                                                    }
                                                                    disabled={
                                                                        actionLoading ===
                                                                        `delete-${mapping.id}`
                                                                    }
                                                                >
                                                                    {actionLoading ===
                                                                    `delete-${mapping.id}` ? (
                                                                        <Loader2 className="size-4 animate-spin" />
                                                                    ) : (
                                                                        <Trash2 className="size-4" />
                                                                    )}
                                                                </Button>
                                                            </TooltipTrigger>
                                                            <TooltipContent>
                                                                Remove Mapping
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                )}
                                                {!isMapped &&
                                                    actionLoading ===
                                                        `create-${field.fieldName}` && (
                                                        <div className="flex justify-end">
                                                            <Loader2 className="size-4 animate-spin text-primary-500" />
                                                        </div>
                                                    )}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};
