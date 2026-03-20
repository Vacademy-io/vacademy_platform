declare module 'mjml-browser' {
    export default function mjml2html(mjml: string, options?: any): { html: string; errors: any[] };
}

