/// <reference types="react" />
/// <reference types="react-dom" />

declare namespace JSX {
    interface IntrinsicElements {
        [elemName: string]: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    }
}
