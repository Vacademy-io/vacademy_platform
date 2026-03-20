import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import {
    Plus,
    Droplet,
    Calendar,
    CheckCircle,
    Lock,
    ArrowRight,
    Pencil,
    Trash,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DripCondition } from '@/types/course-settings';
import { formatDripRule } from '@/utils/drip-conditions';
import { PackageDripConditionDialog } from './PackageDripConditionDialog';
import { MyButton } from '@/components/design-system/button';

interface PackageDripConditionsCardProps {
    packageId: string;
    packageName: string;
    conditions: DripCondition[];
    onAdd: (condition: DripCondition) => void;
    onUpdate: (condition: DripCondition) => void;
    onDelete: (id: string) => void;
}

export const PackageDripConditionsCard: React.FC<PackageDripConditionsCardProps> = ({
    packageId,
    packageName,
    conditions,
    onAdd,
    onUpdate,
    onDelete,
}) => {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingCondition, setEditingCondition] = useState<DripCondition | undefined>();
    const [editingTarget, setEditingTarget] = useState<'chapter' | 'slide' | undefined>();

    // Flatten conditions array for display - show each config as separate card
    const flattenedConditions: Array<{
        condition: DripCondition;
        config: DripCondition['drip_condition'][number];
        target: 'chapter' | 'slide';
    }> = [];

    conditions.forEach((condition) => {
        if (condition.level === 'package' && Array.isArray(condition.drip_condition)) {
            condition.drip_condition.forEach((config) => {
                flattenedConditions.push({
                    condition,
                    config,
                    target: config.target as 'chapter' | 'slide',
                });
            });
        }
    });

    const handleAddCondition = () => {
        // Find existing condition for this package (if any)
        const existingCondition = conditions.find(
            (c) => c.level === 'package' && c.level_id === packageId
        );
        setEditingCondition(existingCondition);
        setEditingTarget(undefined);
        setDialogOpen(true);
    };

    const handleEditCondition = (condition: DripCondition, target: 'chapter' | 'slide') => {
        setEditingCondition(condition);
        setEditingTarget(target);
        setDialogOpen(true);
    };

    const handleSaveCondition = (condition: DripCondition) => {
        if (editingCondition) {
            onUpdate(condition);
        } else {
            onAdd(condition);
        }
    };

    const handleDeleteCondition = (
        condition: DripCondition,
        target: 'chapter' | 'slide',
        config: DripCondition['drip_condition'][number]
    ) => {
        // Only allow deletion of disabled conditions
        if (config.is_enabled) {
            alert(
                `Cannot delete an enabled condition. Please disable the ${target} drip condition first.`
            );
            return;
        }

        if (confirm(`Are you sure you want to delete this ${target} drip condition?`)) {
            // If this is the only config, delete the entire condition
            if (condition.drip_condition.length === 1) {
                onDelete(condition.id);
            } else {
                // Remove only this config from the array
                const updatedConfigs = condition.drip_condition.filter((c) => c.target !== target);
                const updatedCondition: DripCondition = {
                    ...condition,
                    drip_condition: updatedConfigs,
                    updated_at: new Date().toISOString(),
                };
                onUpdate(updatedCondition);
            }
        }
    };

    const getBehaviorIcon = (behavior: string) => {
        switch (behavior) {
            case 'lock':
                return <Lock className="size-4" />;
            case 'hide':
                return <ArrowRight className="size-4" />;
            default:
                return <Droplet className="size-4" />;
        }
    };

    const getBehaviorColor = (behavior: string) => {
        switch (behavior) {
            case 'lock':
                return 'bg-red-100 text-red-800';
            case 'hide':
                return 'bg-gray-100 text-gray-800';
            default:
                return 'bg-blue-100 text-blue-800';
        }
    };

    return (
        <>
            <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <h1>Drip Conditions</h1>
                </div>
                <MyButton scale="small" onClick={handleAddCondition}>
                    <Plus className="mr-2 size-4" />
                    Add
                </MyButton>
            </div>

            {flattenedConditions.length === 0 ? (
                <div className="rounded-lg border border-dashed p-8 text-center">
                    <h3 className="mt-4 text-base font-medium">No drip conditions</h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                        Add conditions to control when content becomes available to learners.
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {flattenedConditions.map(({ condition, config, target }, index) => (
                        <div
                            key={`${condition.id}-${target}-${index}`}
                            className="rounded-lg border bg-white p-4 shadow-sm"
                        >
                            <div className="flex items-start gap-4">
                                <div className="min-w-0 flex-1 space-y-2">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Badge variant="outline" className="capitalize">
                                            {target}
                                        </Badge>
                                        <Badge className={getBehaviorColor(config.behavior)}>
                                            {getBehaviorIcon(config.behavior)}
                                            <span className="ml-1 capitalize">
                                                {config.behavior}
                                            </span>
                                        </Badge>
                                        {config.is_enabled !== undefined && !config.is_enabled && (
                                            <Badge
                                                variant="outline"
                                                className="bg-gray-100 text-gray-600"
                                            >
                                                Disabled
                                            </Badge>
                                        )}
                                    </div>

                                    <div className="space-y-1">
                                        {config.rules.map((rule, idx) => (
                                            <div
                                                key={idx}
                                                className="flex items-start gap-1 text-sm text-gray-700"
                                            >
                                                {rule.type === 'date_based' && (
                                                    <Calendar className="mt-0.5 size-4 shrink-0 text-blue-600" />
                                                )}
                                                {rule.type === 'completion_based' && (
                                                    <CheckCircle className="mt-0.5 size-4 shrink-0 text-green-600" />
                                                )}
                                                {rule.type === 'prerequisite' && (
                                                    <Lock className="mt-0.5 size-4 shrink-0 text-orange-600" />
                                                )}
                                                <span className="min-w-fit ">
                                                    {formatDripRule(rule)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex shrink-0 gap-1">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleEditCondition(condition, target)}
                                        className="size-8 p-0"
                                    >
                                        <Pencil className="size-4" />
                                    </Button>
                                    {!config.is_enabled && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() =>
                                                handleDeleteCondition(condition, target, config)
                                            }
                                            title="Delete condition"
                                            className="size-8 p-0"
                                        >
                                            <Trash className="size-4" />
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <PackageDripConditionDialog
                open={dialogOpen}
                onClose={() => {
                    setDialogOpen(false);
                    setEditingTarget(undefined);
                }}
                onSave={handleSaveCondition}
                packageId={packageId}
                packageName={packageName}
                condition={editingCondition}
                initialTarget={editingTarget}
            />
        </>
    );
};
