/* eslint-disable no-warning-comments */
import React, { useState, useEffect, useRef } from 'react';
import { CheckSquare, Square } from 'lucide-react';
import './TodoList.css';
import { TODO_ITEMS } from './todoSeedData';

interface Todo {
    id: number;
    text: string;
    completed: boolean;
    path: string; // Backend/internal reference
}

// Sub-component to animate todo text
interface TodoItemProps {
    todo: Todo;
    onToggle: () => void;
    onComplete?: () => void; // Added for new logic
}

const CHAR_INTERVAL_MS = 25; // typing speed per character

const TodoItem: React.FC<TodoItemProps> = ({ todo, onToggle, onComplete }) => {
    const [displayText, setDisplayText] = useState('');
    const hasAnimated = useRef(false);

    useEffect(() => {
        if (hasAnimated.current) return; // Prevent re-animation on prop changes

        let i = 0;
        const interval = setInterval(() => {
            i += 1;
            setDisplayText(todo.text.slice(0, i));
            if (i >= todo.text.length) {
                clearInterval(interval);
                hasAnimated.current = true;
                onComplete?.(); // Notify parent once typing of this item is done
            }
        }, CHAR_INTERVAL_MS);

        return () => clearInterval(interval);
        // Dependency array intentionally empty – animation runs only once per mount
    }, []);

    return (
        <li className={todo.completed ? 'completed' : ''} onClick={onToggle}>
            {todo.completed ? <CheckSquare className="icon" /> : <Square className="icon" />}
            <span>{displayText}</span>
        </li>
    );
};

type SlideType = 'pdf' | 'text' | 'code' | 'youtube' | 'html' | 'assessment' | 'document' | 'video';

// Map of path -> content data (hard-coded for now)
const SLIDE_PAYLOADS: Record<string, { content: string; slideType: SlideType } | undefined> = {
    'C1.M2.CH6.SL6': {
        slideType: 'document',
        content: `## What are Variables?\n\nA **variable** is like a labeled box where you can store a piece of information. ...`, // truncated for brevity
    },
    // TODO: add the other slide payloads as needed
};

const TodoList: React.FC = () => {
    const [todos, setTodos] = useState<Todo[]>(() =>
        TODO_ITEMS.map((t) => ({ ...t, completed: false }))
    );
    const [activeIndex, setActiveIndex] = useState(0); // index of the last todo currently visible

    const handleItemComplete = (todo: Todo) => {
        // Decide slide type based on keyword inside todo text
        const lower = todo.text.toLowerCase();
        const slideType: SlideType = lower.includes('video') ? 'video' : 'document';

        const payload = SLIDE_PAYLOADS[todo.path] || {
            content: `Placeholder content for ${todo.text}`,
            slideType,
        };

        // Dispatch slide creation event
        window.dispatchEvent(
            new CustomEvent('create-slide', {
                detail: {
                    path: todo.path,
                    name: todo.text.replace(/^Generate '| Slide Content$/g, '').replace(/'/g, ''),
                    slideType: payload.slideType,
                    content: payload.content,
                },
            })
        );

        // Mark todo completed
        setTodos((prev) => prev.map((t) => (t.id === todo.id ? { ...t, completed: true } : t)));

        // Reveal next todo
        setActiveIndex((prev) => (prev + 1 < todos.length ? prev + 1 : prev));
    };

    const toggleTodo = (id: number) => {
        setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)));
    };

    return (
        <div className="todo-container">
            <h3 className="todo-title">TODOs</h3>
            <ul className="todo-list">
                {todos.slice(0, activeIndex + 1).map((todo, idx) => (
                    <TodoItem
                        key={todo.id}
                        todo={todo}
                        onToggle={() => toggleTodo(todo.id)}
                        onComplete={
                            idx === activeIndex ? () => handleItemComplete(todo) : undefined
                        }
                    />
                ))}
            </ul>
        </div>
    );
};

export default TodoList;
