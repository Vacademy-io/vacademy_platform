import { useCallback, useMemo, useState } from 'react';
import * as ReactDOM from 'react-dom';
import {
    $getSelection,
    $isRangeSelection,
    $createParagraphNode,
    type ElementNode,
    type LexicalEditor,
    type TextNode,
} from 'lexical';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
    LexicalTypeaheadMenuPlugin,
    MenuOption,
    useBasicTypeaheadTriggerMatch,
} from '@lexical/react/LexicalTypeaheadMenuPlugin';
import { $setBlocksType } from '@lexical/selection';
import { $createHeadingNode, $createQuoteNode, type HeadingTagType } from '@lexical/rich-text';
import {
    INSERT_ORDERED_LIST_COMMAND,
    INSERT_UNORDERED_LIST_COMMAND,
    INSERT_CHECK_LIST_COMMAND,
} from '@lexical/list';
import { INSERT_TABLE_COMMAND } from '@lexical/table';
import { INSERT_HORIZONTAL_RULE_COMMAND } from '@lexical/react/LexicalHorizontalRuleNode';
import {
    TextAa,
    TextHOne,
    TextHTwo,
    TextHThree,
    Quotes,
    ListBullets,
    ListNumbers,
    CheckSquare,
    Table,
    Minus,
    type Icon,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

export class SlashMenuOption extends MenuOption {
    title: string;
    description: string;
    menuIcon: Icon;
    keywords: string[];
    onSelect: (editor: LexicalEditor, queryString: string) => void;

    constructor(
        title: string,
        options: {
            description: string;
            menuIcon: Icon;
            keywords?: string[];
            onSelect: (editor: LexicalEditor, queryString: string) => void;
        }
    ) {
        super(title);
        this.title = title;
        this.description = options.description;
        this.menuIcon = options.menuIcon;
        this.keywords = options.keywords ?? [];
        this.onSelect = options.onSelect;
    }
}

const formatBlock = (editor: LexicalEditor, createNode: () => ElementNode) => {
    editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
            $setBlocksType(selection, createNode);
        }
    });
};

/** Core (standard rich-text) options. Custom block options are appended by
 *  buildSlashMenuOptions callers as they are implemented. */
export function buildCoreSlashOptions(): SlashMenuOption[] {
    return [
        new SlashMenuOption('Text', {
            description: 'Start writing plain text.',
            menuIcon: TextAa,
            keywords: ['paragraph', 'text', 'plain'],
            onSelect: (editor) => formatBlock(editor, () => $createParagraphNode()),
        }),
        ...(['1', '2', '3'] as const).map(
            (level) =>
                new SlashMenuOption(`Heading ${level}`, {
                    description:
                        level === '1'
                            ? 'Big section heading'
                            : level === '2'
                              ? 'Medium section heading'
                              : 'Small section heading',
                    menuIcon: level === '1' ? TextHOne : level === '2' ? TextHTwo : TextHThree,
                    keywords: ['heading', `h${level}`, 'title'],
                    onSelect: (editor) =>
                        formatBlock(editor, () =>
                            $createHeadingNode(`h${level}` as HeadingTagType)
                        ),
                })
        ),
        new SlashMenuOption('Quote', {
            description: 'Capture a quote',
            menuIcon: Quotes,
            keywords: ['quote', 'blockquote'],
            onSelect: (editor) => formatBlock(editor, () => $createQuoteNode()),
        }),
        new SlashMenuOption('Bulleted list', {
            description: 'Simple bulleted list',
            menuIcon: ListBullets,
            keywords: ['list', 'bullet', 'ul'],
            onSelect: (editor) => editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined),
        }),
        new SlashMenuOption('Numbered list', {
            description: 'Numbered list',
            menuIcon: ListNumbers,
            keywords: ['list', 'numbered', 'ol'],
            onSelect: (editor) => editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined),
        }),
        new SlashMenuOption('To-do list', {
            description: 'List with checkboxes',
            menuIcon: CheckSquare,
            keywords: ['todo', 'check', 'task'],
            onSelect: (editor) => editor.dispatchCommand(INSERT_CHECK_LIST_COMMAND, undefined),
        }),
        new SlashMenuOption('Table', {
            description: 'Add simple table',
            menuIcon: Table,
            keywords: ['table', 'grid'],
            onSelect: (editor) =>
                editor.dispatchCommand(INSERT_TABLE_COMMAND, { columns: '3', rows: '3' }),
        }),
        new SlashMenuOption('Divider', {
            description: 'Divide your blocks',
            menuIcon: Minus,
            keywords: ['divider', 'hr', 'separator', 'line'],
            onSelect: (editor) => editor.dispatchCommand(INSERT_HORIZONTAL_RULE_COMMAND, undefined),
        }),
    ];
}

export function SlashMenuPlugin({ extraOptions = [] }: { extraOptions?: SlashMenuOption[] }) {
    const [editor] = useLexicalComposerContext();
    const [queryString, setQueryString] = useState<string | null>(null);

    const checkForTriggerMatch = useBasicTypeaheadTriggerMatch('/', { minLength: 0 });

    const options = useMemo(() => {
        const all = [...buildCoreSlashOptions(), ...extraOptions];
        if (!queryString) return all;
        const q = queryString.toLowerCase();
        return all.filter(
            (o) =>
                o.title.toLowerCase().includes(q) ||
                o.keywords.some((k) => k.toLowerCase().includes(q))
        );
    }, [queryString, extraOptions]);

    const onSelectOption = useCallback(
        (
            option: SlashMenuOption,
            nodeToRemove: TextNode | null,
            closeMenu: () => void,
            matchingString: string
        ) => {
            editor.update(() => {
                nodeToRemove?.remove();
            });
            option.onSelect(editor, matchingString);
            closeMenu();
        },
        [editor]
    );

    return (
        <LexicalTypeaheadMenuPlugin<SlashMenuOption>
            onQueryChange={setQueryString}
            onSelectOption={onSelectOption}
            triggerFn={checkForTriggerMatch}
            options={options}
            menuRenderFn={(
                anchorElementRef,
                { selectedIndex, selectOptionAndCleanUp, setHighlightedIndex }
            ) =>
                anchorElementRef.current && options.length > 0
                    ? ReactDOM.createPortal(
                          <div className="z-50 mt-6 max-h-80 w-72 overflow-y-auto rounded-lg border border-neutral-200 bg-white py-2 shadow-lg">
                              {options.map((option, i) => {
                                  const IconComp = option.menuIcon;
                                  return (
                                      <button
                                          key={option.key}
                                          type="button"
                                          tabIndex={-1}
                                          role="option"
                                          aria-selected={selectedIndex === i}
                                          className={cn(
                                              'flex w-full items-center gap-3 px-3 py-2 text-left',
                                              selectedIndex === i && 'bg-neutral-100'
                                          )}
                                          ref={option.setRefElement}
                                          onMouseEnter={() => setHighlightedIndex(i)}
                                          onClick={() => {
                                              setHighlightedIndex(i);
                                              selectOptionAndCleanUp(option);
                                          }}
                                      >
                                          <span className="flex size-9 items-center justify-center rounded-md border border-neutral-200 bg-white">
                                              <IconComp size={18} />
                                          </span>
                                          <span className="flex flex-col">
                                              <span className="text-subtitle font-medium text-neutral-700">
                                                  {option.title}
                                              </span>
                                              <span className="text-caption text-neutral-500">
                                                  {option.description}
                                              </span>
                                          </span>
                                      </button>
                                  );
                              })}
                          </div>,
                          anchorElementRef.current
                      )
                    : null
            }
        />
    );
}
