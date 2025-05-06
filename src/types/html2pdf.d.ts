declare module 'html2pdf.js' {
    interface Options {
        margin?: number;
        filename?: string;
        image?: {
            type?: string;
            quality?: number;
        };
        html2canvas?: {
            scale?: number;
            [key: string]: unknown;
        };
        jsPDF?: {
            unit?: string;
            format?: string;
            orientation?: string;
            [key: string]: unknown;
        };
    }

    interface Html2PdfInstance {
        set(options: Options): Html2PdfInstance;
        from(element: HTMLElement): Html2PdfInstance;
        save(): Promise<void>;
    }

    export default function html2pdf(): {
        set: (opt: unknown) => unknown;
        from: (element: HTMLElement) => unknown;
        save: () => Promise<void>;
    };
}
