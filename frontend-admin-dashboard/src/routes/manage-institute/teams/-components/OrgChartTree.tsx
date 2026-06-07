import { useState } from 'react';
import { CaretDown, CaretRight, UsersThree, Crown } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import type { OrgTeamNode } from '../-services/org-team-services';

interface Props {
    roots: OrgTeamNode[];
    selectedTeamId: string | null;
    onSelect: (teamId: string) => void;
}

/**
 * Friendly tree view of the org chart. Each row is a chunky, easy-to-click
 * card with the team's name, the head's name as a Crown badge, and a member
 * count. First level is expanded by default so the structure is visible
 * without any clicking.
 */
export function OrgChartTree({ roots, selectedTeamId, onSelect }: Props) {
    if (!roots || roots.length === 0) {
        return null;
    }
    return (
        <ul role="tree" className="space-y-1 p-2">
            {roots.map((n) => (
                <TreeNode
                    key={n.id}
                    node={n}
                    depth={0}
                    selectedTeamId={selectedTeamId}
                    onSelect={onSelect}
                />
            ))}
        </ul>
    );
}

interface NodeProps {
    node: OrgTeamNode;
    depth: number;
    selectedTeamId: string | null;
    onSelect: (id: string) => void;
}

function TreeNode({ node, depth, selectedTeamId, onSelect }: NodeProps) {
    const [open, setOpen] = useState(depth < 1);
    const hasChildren = node.children && node.children.length > 0;
    const selected = node.id === selectedTeamId;

    return (
        <li role="treeitem" aria-expanded={hasChildren ? open : undefined} aria-selected={selected}>
            <div
                className={cn(
                    'group flex items-center gap-2 rounded-md px-2 py-2 transition-colors',
                    selected
                        ? 'bg-primary-50 ring-1 ring-primary-200'
                        : 'hover:bg-neutral-50'
                )}
                style={{ paddingLeft: `${depth * 16 + 8}px` }}
            >
                {hasChildren ? (
                    <button
                        type="button"
                        onClick={() => setOpen((v) => !v)}
                        aria-label={open ? 'Collapse' : 'Expand'}
                        className="rounded p-0.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700"
                    >
                        {open ? <CaretDown size={14} /> : <CaretRight size={14} />}
                    </button>
                ) : (
                    <span className="w-[18px]" aria-hidden="true" />
                )}
                <button
                    type="button"
                    onClick={() => onSelect(node.id)}
                    className={cn(
                        'flex flex-1 items-center gap-2 truncate text-left',
                        selected ? 'text-primary-700' : 'text-neutral-800'
                    )}
                    aria-pressed={selected}
                >
                    <UsersThree
                        size={18}
                        weight={selected ? 'fill' : 'regular'}
                        className={selected ? 'text-primary-600' : 'text-neutral-500'}
                    />
                    <span className={cn('truncate text-body', selected && 'font-medium')}>
                        {node.name}
                    </span>
                    {node.head_user_id && (
                        <Crown
                            size={12}
                            weight="fill"
                            className="text-warning-500"
                            aria-label="This team has a head"
                        />
                    )}
                    <span
                        className={cn(
                            'ml-auto rounded-full px-2 py-0.5 text-caption font-medium',
                            selected
                                ? 'bg-primary-100 text-primary-700'
                                : 'bg-neutral-100 text-neutral-600'
                        )}
                    >
                        {node.member_count}
                    </span>
                </button>
            </div>
            {hasChildren && open && (
                <ul role="group" className="mt-1 space-y-1">
                    {node.children.map((c) => (
                        <TreeNode
                            key={c.id}
                            node={c}
                            depth={depth + 1}
                            selectedTeamId={selectedTeamId}
                            onSelect={onSelect}
                        />
                    ))}
                </ul>
            )}
        </li>
    );
}
